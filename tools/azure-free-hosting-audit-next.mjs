#!/usr/bin/env node
// tools/azure-free-hosting-audit-next.mjs
// Audits this Next.js repo and decides the best FREE Azure hosting plan.
//   A = Static Web Apps (Free) — Static Export
//   B = Static Web Apps (Free) — Hybrid SSR (Preview)
//   C = App Service F1 (last resort, not auto-provisioned)

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const j = (p) => path.join(root, p);
const exists = (p) => fs.existsSync(j(p));
const readText = (p) => {
  try {
    return fs.readFileSync(j(p), "utf8");
  } catch {
    return "";
  }
};
const readJson = (p) => {
  try {
    return JSON.parse(readText(p));
  } catch {
    return null;
  }
};

function findFiles(dirRel, max = 5000) {
  const out = [];
  const start = j(dirRel);
  if (!fs.existsSync(start)) return out;
  const stack = [start];
  while (stack.length && out.length < max) {
    const cur = stack.pop();
    const st = fs.statSync(cur);
    if (st.isDirectory()) {
      for (const e of fs.readdirSync(cur)) {
        if (
          ["node_modules", ".git", ".next", "out", "dist", "build"].includes(e)
        )
          continue;
        stack.push(path.join(cur, e));
      }
    } else out.push(cur);
  }
  return out;
}

// ── Detect Next.js ──────────────────────────────────────────────────────────
const pkg = readJson("package.json") || {};
const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
if (
  !deps.next &&
  !exists("next.config.js") &&
  !exists("next.config.mjs") &&
  !exists("next.config.ts")
) {
  console.error("❌ Next.js not detected. This script is for Next.js repos.");
  process.exit(1);
}

// ── Read next.config ────────────────────────────────────────────────────────
const nextConfigPath = exists("next.config.mjs")
  ? "next.config.mjs"
  : exists("next.config.js")
    ? "next.config.js"
    : exists("next.config.ts")
      ? "next.config.ts"
      : null;

const nextConfig = nextConfigPath ? readText(nextConfigPath) : "";
const scripts = pkg.scripts || {};

// ── Signals ─────────────────────────────────────────────────────────────────
const hasStaticExport =
  nextConfig.includes("output: 'export'") ||
  nextConfig.includes('output: "export"') ||
  !!scripts.export ||
  Object.values(scripts).some(
    (s) => typeof s === "string" && s.includes("next export")
  );

const hasMiddleware =
  exists("middleware.ts") ||
  exists("middleware.js") ||
  exists("src/middleware.ts") ||
  exists("src/middleware.js");

const hasApiRoutes =
  exists("app/api") ||
  exists("src/app/api") ||
  exists("pages/api") ||
  exists("src/pages/api");

const appFiles = findFiles("app").filter((p) =>
  /\.(ts|tsx|js|jsx)$/.test(p)
);
const hasServerActions = appFiles.some((p) => {
  const t = fs.readFileSync(p, "utf8");
  return t.includes("'use server'") || t.includes('"use server"');
});

const hasDynamicRoutes = appFiles.some((p) => {
  const t = fs.readFileSync(p, "utf8");
  return (
    t.includes("force-dynamic") ||
    t.includes("revalidate") ||
    t.includes("generateStaticParams") === false
  );
});

const requiresServer = hasMiddleware || hasApiRoutes || hasServerActions;

// ── Decision ────────────────────────────────────────────────────────────────
let decision, reason;
if (hasStaticExport && !requiresServer) {
  decision = "A";
  reason =
    "Static export is configured and no server-only Next.js features detected. Use SWA static hosting.";
} else if (requiresServer) {
  decision = "B";
  reason =
    "Server features detected (middleware / API routes / server actions). Use SWA Hybrid (Preview).";
} else {
  decision = "B";
  reason =
    "No explicit static export configured; SWA Hybrid is the safer default unless you refactor to `output: 'export'`.";
}

// ── Node hint ───────────────────────────────────────────────────────────────
const nodeHint =
  pkg.engines?.node ||
  (exists(".nvmrc") ? readText(".nvmrc").trim() : null) ||
  (exists(".node-version") ? readText(".node-version").trim() : null);

// ── Report ──────────────────────────────────────────────────────────────────
const report = {
  decision,
  reason,
  nodeHint,
  signals: {
    hasStaticExport,
    hasMiddleware,
    hasApiRoutes,
    hasServerActions,
    hasDynamicRoutes,
  },
  nextVersion: deps.next || "unknown",
  repo: path.basename(root),
};

const outPath = j(".azure-free-hosting-plan.json");
fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");

console.log("✅ Wrote .azure-free-hosting-plan.json\n");
console.log(JSON.stringify(report, null, 2));
