# AI Mode Test Prompts

Use these prompts to verify each mode produces the expected style and format. For modes that work on selected text, select the sample text first, then run the prompt.

---

## Friendly
*Expected: Warm, conversational, approachable tone*

- Write a short welcome message for new team members
- Explain what this app does in a friendly way
- **Select text:** "The meeting has been rescheduled." → *Make this sound friendlier*

---

## Professional
*Expected: Formal, polished, business-appropriate*

- Draft a brief email declining a meeting invitation
- Write 2–3 sentences introducing our product to enterprise clients
- **Select text:** "Hey, just wanted to check in about the project" → *Make this more professional*

---

## Concise
*Expected: Minimal words, no filler*

- In one sentence, what is machine learning?
- **Select text:** "In my personal opinion, I think that we should probably consider the possibility of maybe starting the project sometime next week." → *Make this concise*
- Summarize the benefits of remote work in 3 short bullet points

---

## Summary
*Expected: Full summary that keeps key info and structure*

- **Select a long paragraph or note** → *Summarize this*
- **Select 2–3 paragraphs** → *Give me a comprehensive summary*
- Summarize the main takeaways from this text

---

## Key Points
*Expected: Bullet/numbered list of distinct, important points only*

- **Select a paragraph or article** → *Extract the key points*
- **Select meeting notes** → *What are the main action items and decisions?*
- List the key points from this text

---

## List
*Expected: Clear, structured list (bullets or numbers), parallel structure*

- List 5 best practices for code reviews
- **Select a block of text** → *Convert this into a structured list*
- Give me a numbered list of steps to set up a new project

---

## Table
*Expected: Valid markdown table with headers and aligned columns*

- **Select a list or paragraph** → *Convert this into a markdown table*
- Create a comparison table: Feature A vs Feature B vs Feature C (with columns: Feature, A, B, C)
- **Select product names and short descriptions** → *Format as a table with columns: Name, Description*

---

## Code
*Expected: Clean code in a fenced block with language tag, good practices*

- Write a TypeScript function that reverses a string
- **Select code** → *Add comments and fix any issues*
- Write a small utility to parse a comma-separated string into an array (JavaScript)

---

## Proofread
*Expected: Same meaning, fixed grammar/spelling/clarity, no extra commentary*

- **Select text with errors:** "Their going to the store to get there groceries. Its important to check you're list."
- **Select a rough paragraph** → *Proofread this*
- Fix any grammar and spelling in the selected text

---

## Rewrite
*Expected: Same message, fresh wording, better flow*

- **Select a paragraph** → *Rewrite this to be clearer and more engaging*
- **Select text** → *Rewrite in a different style but keep the meaning*
- Rewrite the selected text for a younger audience

---

## Quick copy-paste samples (for selection tests)

**For Summary / Key Points / List:**
> Our quarterly results showed a 15% increase in revenue compared to last year. The main drivers were the new product launch and expansion into two new markets. Customer retention improved by 8%. We plan to invest more in R&D next quarter and hire 20 new engineers.

**For Proofread:**
> Their are many reasons why one should learn to code. It helps you think logical and solve problems. You can build cool stuff and maybe even get a better job. Theres lots of free resources online to get started.

**For Table (convert to table):**
> React: UI library by Meta. Vue: Progressive framework. Angular: Full framework by Google. Svelte: Compiler-based approach.

**For Code:**
> function add(a,b){return a+b}

---

*Tip: Run the same prompt in 2–3 different modes (e.g. Friendly vs Professional, or Summary vs Key Points) to compare outputs.*
