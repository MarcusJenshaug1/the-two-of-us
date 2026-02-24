#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# Azure Free Hosting Auto-Provisioner for Next.js
#
# Creates an Azure Static Web App (Free SKU) with GitHub Actions deploy,
# plus optional guardrails (budget alerts, deny-policy).
#
# Usage:
#   APP_NAME="myapp-free" BUDGET_EMAIL="me@example.com" ./tools/azure-free-hosting-provision.sh
###############################################################################

# ========= USER CONFIG (override via environment) ===========================
APP_NAME="${APP_NAME:-us2-next-free}"        # must be globally unique
RG_NAME="${RG_NAME:-rg-${APP_NAME}}"
LOCATION="${LOCATION:-westeurope}"
BRANCH="${BRANCH:-main}"

# Optional guardrails
ENABLE_RG_BUDGET="${ENABLE_RG_BUDGET:-1}"     # 1=on, 0=off (alerts only)
BUDGET_AMOUNT="${BUDGET_AMOUNT:-1}"           # USD — budgets are alerts, NOT hard stops
BUDGET_EMAIL="${BUDGET_EMAIL:-}"              # set to your email for alerts

ENABLE_LOCKDOWN_POLICY="${ENABLE_LOCKDOWN_POLICY:-0}" # 1=deny non-allowed types in RG

# ========= COLOUR HELPERS ===================================================
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { printf "${CYAN}==> %s${NC}\n" "$*"; }
ok()    { printf "${GREEN}✅  %s${NC}\n" "$*"; }
warn()  { printf "${YELLOW}⚠️   %s${NC}\n" "$*"; }
fail()  { printf "${RED}❌  %s${NC}\n" "$*"; exit 1; }

# ========= PRECHECKS ========================================================
info "Checking prerequisites…"

command -v az  >/dev/null 2>&1 || fail "Azure CLI (az) is required.  https://aka.ms/install-azure-cli"
command -v gh  >/dev/null 2>&1 || fail "GitHub CLI (gh) is required.  https://cli.github.com"
command -v git >/dev/null 2>&1 || fail "git is required."
command -v node >/dev/null 2>&1 || fail "Node.js is required."

info "Checking Azure login…"
az account show >/dev/null 2>&1 || az login >/dev/null

info "Checking GitHub login…"
gh auth status >/dev/null 2>&1 || fail "Run: gh auth login"

ORIGIN_URL="$(git remote get-url origin 2>/dev/null || true)"
[[ "$ORIGIN_URL" == *"github.com"* ]] || fail "Origin remote must be GitHub. Found: ${ORIGIN_URL:-<none>}"

# Normalise owner/repo slug (handles SSH + HTTPS)
REPO_SLUG="$(echo "$ORIGIN_URL" | sed -E 's#(git@github.com:|https://github.com/)##; s#\.git$##')"
info "GitHub repo: $REPO_SLUG"

ok "All prerequisites satisfied."

# ========= AUDIT ============================================================
if [[ ! -f ".azure-free-hosting-plan.json" ]]; then
  info "Running hosting audit…"
  node tools/azure-free-hosting-audit-next.mjs
fi

PLAN="$(node -p "JSON.parse(require('fs').readFileSync('.azure-free-hosting-plan.json','utf8')).decision")"
REASON="$(node -p "JSON.parse(require('fs').readFileSync('.azure-free-hosting-plan.json','utf8')).reason")"
NODE_HINT="$(node -p "JSON.parse(require('fs').readFileSync('.azure-free-hosting-plan.json','utf8')).nodeHint || '18'")"

info "Plan: ${PLAN}  —  ${REASON}"

# ========= RESOURCE GROUP ===================================================
info "Creating resource group '$RG_NAME' in '$LOCATION' (FREE)…"
az group create -n "$RG_NAME" -l "$LOCATION" -o none

ok "Resource group ready."

# ========= OPTIONAL: LOCKDOWN POLICY ========================================
if [[ "$ENABLE_LOCKDOWN_POLICY" == "1" ]]; then
  info "Applying RG lockdown policy (deny non-allowed resource types)…"

  # Policy RULE (only the rule, not full definition)
  POLICY_RULE='{"if":{"not":{"field":"type","in":"[parameters('\''allowedTypes'\'')]"}},"then":{"effect":"Deny"}}'
  POLICY_PARAMS='{"allowedTypes":{"type":"Array","metadata":{"displayName":"Allowed resource types"},"defaultValue":["Microsoft.Web/staticSites"]}}'

  POLICY_DEF_ID="$(az policy definition create \
    --name "deny-nonfree-types-${APP_NAME}" \
    --rules "$POLICY_RULE" \
    --params "$POLICY_PARAMS" \
    --mode All \
    --display-name "Deny non-allowed resource types (Free guardrail)" \
    --query id -o tsv 2>/dev/null)" || warn "Policy definition creation failed (may need Owner role)."

  if [[ -n "${POLICY_DEF_ID:-}" ]]; then
    az policy assignment create \
      --name "deny-nonfree-types-${APP_NAME}" \
      --policy "$POLICY_DEF_ID" \
      --scope "$(az group show -n "$RG_NAME" --query id -o tsv)" -o none \
      2>/dev/null || warn "Policy assignment failed (may require Owner or Policy Contributor)."
    ok "Lockdown policy applied — only Microsoft.Web/staticSites allowed in $RG_NAME."
  fi
fi

# ========= PROVISION SWA ====================================================
if [[ "$PLAN" == "A" || "$PLAN" == "B" ]]; then

  info "Creating Azure Static Web App '$APP_NAME' (sku: Free)…"
  az staticwebapp create \
    -n "$APP_NAME" \
    -g "$RG_NAME" \
    -l "$LOCATION" \
    --sku Free \
    -o none

  ok "Static Web App created."

  info "Fetching SWA deployment token…"
  SWA_TOKEN="$(az staticwebapp secrets list \
    -n "$APP_NAME" \
    -g "$RG_NAME" \
    --query properties.apiKey -o tsv)"

  info "Setting GitHub secret: AZURE_STATIC_WEB_APPS_API_TOKEN"
  echo "$SWA_TOKEN" | gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN -R "$REPO_SLUG"

  ok "GitHub secret set."

  # ── Generate GitHub Actions Workflow ───────────────────────────────────────
  info "Writing GitHub Actions workflow…"
  mkdir -p .github/workflows

  if [[ "$PLAN" == "A" ]]; then
    # ── Plan A: Static Export ────────────────────────────────────────────────
    cat > .github/workflows/azure-static-web-apps.yml <<YAML
name: Azure Static Web Apps CI/CD (Free)

on:
  push:
    branches: [ "${BRANCH}" ]
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches: [ "${BRANCH}" ]

jobs:
  build_and_deploy:
    if: github.event_name != 'pull_request' || github.event.action != 'closed'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "${NODE_HINT}"

      - run: npm ci
      - run: npm run build

      - name: Deploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: \${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: \${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "/"
          api_location: ""
          output_location: "out"

  close_pull_request:
    if: github.event_name == 'pull_request' && github.event.action == 'closed'
    runs-on: ubuntu-latest
    steps:
      - name: Close PR staging env
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: \${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          action: "close"
YAML

  else
    # ── Plan B: Hybrid SSR (middleware + API routes) ─────────────────────────
    cat > .github/workflows/azure-static-web-apps.yml <<YAML
name: Azure Static Web Apps CI/CD (Free – Next.js Hybrid)

on:
  push:
    branches: [ "${BRANCH}" ]
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches: [ "${BRANCH}" ]

jobs:
  build_and_deploy:
    if: github.event_name != 'pull_request' || github.event.action != 'closed'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "${NODE_HINT}"

      - run: npm ci
      - run: npm run build

      - name: Deploy (Hybrid SSR)
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: \${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: \${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "/"
          api_location: ""
          output_location: ""
        env:
          IS_STATIC_EXPORT: "false"

  close_pull_request:
    if: github.event_name == 'pull_request' && github.event.action == 'closed'
    runs-on: ubuntu-latest
    steps:
      - name: Close PR staging env
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: \${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          action: "close"
YAML
  fi

  ok "Workflow written to .github/workflows/azure-static-web-apps.yml"

  # ── Git commit + push ─────────────────────────────────────────────────────
  info "Committing & pushing workflow…"
  git add \
    .github/workflows/azure-static-web-apps.yml \
    tools/azure-free-hosting-audit-next.mjs \
    tools/azure-free-hosting-provision.sh \
    .azure-free-hosting-plan.json \
    2>/dev/null || true

  git commit -m "chore: add free Azure Static Web Apps deploy workflow" --no-verify 2>/dev/null || warn "Nothing new to commit."
  git push origin "$BRANCH" 2>/dev/null || warn "Push failed — you may need to push manually."

  # ── SWA environment variables hint ─────────────────────────────────────────
  echo ""
  warn "Set runtime env vars for your SWA (values from your .env.local / secrets):"
  echo "  az staticwebapp appsettings set -n $APP_NAME -g $RG_NAME \\"
  echo "    --setting-names NEXT_PUBLIC_SUPABASE_URL=<value> NEXT_PUBLIC_SUPABASE_ANON_KEY=<value> …"
  echo ""

  # ========= OPTIONAL: BUDGET ALERT ==========================================
  if [[ "$ENABLE_RG_BUDGET" == "1" ]]; then
    if [[ -z "$BUDGET_EMAIL" ]]; then
      warn "ENABLE_RG_BUDGET=1 but BUDGET_EMAIL is empty — skipping budget creation."
    else
      info "Creating RG budget alert (\$${BUDGET_AMOUNT}/month, alerts only)…"

      # Cross-platform start date (works on macOS + GNU)
      START_DATE="$(date -u +%Y-%m-01)"
      # End date: +1 year  (macOS = -v, GNU = -d)
      if date -v+1y +%Y-%m-%d >/dev/null 2>&1; then
        END_DATE="$(date -u -v+1y +%Y-%m-%d)"          # macOS
      else
        END_DATE="$(date -u -d '+1 year' +%Y-%m-%d)"   # GNU/Linux
      fi

      RG_ID="$(az group show -n "$RG_NAME" --query id -o tsv)"

      az rest \
        --method PUT \
        --url "${RG_ID}/providers/Microsoft.Consumption/budgets/${APP_NAME}-budget?api-version=2023-11-01" \
        --body "{
          \"properties\": {
            \"category\": \"Cost\",
            \"amount\": ${BUDGET_AMOUNT},
            \"timeGrain\": \"Monthly\",
            \"timePeriod\": { \"startDate\": \"${START_DATE}\", \"endDate\": \"${END_DATE}\" },
            \"notifications\": {
              \"near\": {
                \"enabled\": true,
                \"operator\": \"GreaterThanOrEqualTo\",
                \"threshold\": 50,
                \"contactEmails\": [\"${BUDGET_EMAIL}\"]
              },
              \"hit\": {
                \"enabled\": true,
                \"operator\": \"GreaterThanOrEqualTo\",
                \"threshold\": 100,
                \"contactEmails\": [\"${BUDGET_EMAIL}\"]
              }
            }
          }
        }" -o none 2>/dev/null \
        && ok "Budget alert created (\$${BUDGET_AMOUNT}/month → ${BUDGET_EMAIL})." \
        || warn "Budget creation failed. Create it manually in the Azure Portal."
    fi
  fi

  # ========= VERIFICATION ====================================================
  echo ""
  info "Verification summary:"
  az staticwebapp show -n "$APP_NAME" -g "$RG_NAME" \
    --query "{name:name, sku:sku.name, defaultHostname:defaultHostname, location:location}" -o jsonc

  echo ""
  info "All resources in resource group '$RG_NAME':"
  az resource list -g "$RG_NAME" \
    --query "[].{Name:name, Type:type, SKU:sku.name, Location:location}" -o table

  echo ""
  printf "${GREEN}══════════════════════════════════════════════════════════════${NC}\n"
  ok "DONE — Azure Static Web App provisioned with FREE SKU."
  echo ""
  echo "  📌 Default URL:  https://${APP_NAME}.azurestaticapps.net  (or see defaultHostname above)"
  echo "  📌 GitHub push to '${BRANCH}' triggers deploy automatically."
  echo ""
  printf "${YELLOW}  ⚠️  COST SAFETY REMINDERS:${NC}\n"
  echo "  • Budgets are ALERTS ONLY — they do NOT stop spend."
  echo "  • Free tier limits: SWA Free = 100 GB bandwidth, 2 custom domains, 0.5 GB app size."
  echo "  • If you exceed limits, Azure may throttle but NOT charge (Free SKU)."
  echo "  • NEVER add paid resources to this RG unless you accept the cost."
  echo "  • Use a subscription with a spending limit for absolute $0 guarantee."
  printf "${GREEN}══════════════════════════════════════════════════════════════${NC}\n"

  exit 0
fi

# ========= PLAN C (NOT AUTO-PROVISIONED) =====================================
echo ""
fail "Plan C (App Service F1) is not auto-provisioned by this script.
If you truly need it, create an F1 App Service Plan manually and add the deny policy for other SKUs.
Reason the audit chose Plan C: ${REASON}"
