# Prompt for Question Generation (AI Agent)

Copy and paste the following prompt into ChatGPT, Claude, or any other AI agent to generate your questions:

---

**System Prompt / Context:**
I am building a mobile-first PWA for couples called "The Two of Us". The app sends one question every morning to help couples connect, spark deep conversations, and share fun memories. The target audience is couples in all stages of relationships.

**Task:**
Generate a list of 365 unique questions, one for each day of the year. The questions should be in **Norwegian**.

**Categorization:**
Mix the questions so they cover the following categories throughout the year:
1. **Dype spørsmål**: Verdier, fremtid, frykt og drømmer.
2. **Morsomme/Lette**: Hypotetiske scenarioer, morsomme vaner.
3. **Nostalgi**: Barndom, vårt første møte, felles minner.
4. **Hverdag & Intimitet**: Hvordan vi fungerer sammen, hva vi setter pris på nå.
5. **Utfordrende**: Hvordan vi løser konflikter, hva vi kan bli bedre på.

**Format Requirements:**
- Return the result as a raw **SQL INSERT statement** for a table named `questions` with columns `id` (UUID) and `text` (TEXT).
- Ensure the tone is warm, engaging, and modern.
- Avoid clichés like "What is your favorite color?".
- Make them specific to a couple's dynamic.

**Example of tone:**
- "Hvis vi kunne flyttet til et helt annet land i morgen, hvor ville vi dratt og hvorfor?"
- "Hva er det minste lille tingen jeg gjør som får deg til å føle deg mest elsket?"

**Output:**
Provide the 365 questions in a block of SQL commands so I can run them directly in my database.

---

## How to use this:
1. Run the prompt.
2. Copy the resulting SQL.
3. Go to your **Supabase SQL Editor**.
4. Paste and run!
