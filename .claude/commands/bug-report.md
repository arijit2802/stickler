# Task: Create a Bug / Defect Report

## Screenshot Handling (check this first)
- If the user has attached a screenshot or image to this prompt, **read and analyse it visually** before asking any questions.
- Extract as much as you can from the screenshot: visible error messages, broken UI, wrong data, affected page/route.
- Pre-fill answers from the screenshot so you only ask the user for information you could not determine from the image.
- Store the screenshot path in the bug file under `## Screenshot` if one was provided.

## Steps

1. **Gather information** — for anything not answerable from the screenshot, ask the user these questions **one at a time**, waiting for each answer:
   - What is the defect? (describe what you observed) — skip if clear from screenshot
   - What did you expect to happen instead?
   - Which page or feature is affected? (e.g. /discovery, /calendar, onboarding) — skip if clear from screenshot
   - How do you reproduce it? (step-by-step)
   - How severe is it? (critical / high / medium / low)

2. **Determine the next bug ID**:
   - List all files in `BUGS/open/` and `BUGS/fixed/`
   - Find the highest existing bug number (e.g. BUG-003)
   - Increment by 1 for the new ID; start at BUG-001 if none exist

3. **Analyse root cause** — before writing the file:
   - Read the files most likely involved (check Fix Scope)
   - Form a hypothesis about the root cause

4. **Write the bug file** to `BUGS/open/[BUG-ID]-[short-slug].md` using this template:

```markdown
---
id       : BUG-XXX
title    : [one-line description]
status   : OPEN          ← OPEN | IN_PROGRESS | FIXED
severity : [critical|high|medium|low]
feature  : [affected feature / route]
created  : YYYY-MM-DD
fixed    : —
---

## Observed Behaviour
[what the user saw]

## Expected Behaviour
[what should have happened]

## Steps to Reproduce
1. ...
2. ...
3. ...

## Screenshot
[path to screenshot file, or "none"]

## Root Cause Hypothesis
[your analysis of likely cause based on code review]

## Fix Scope
[list of files likely involved in the fix]
```

5. **Confirm** — tell the user the bug ID and file path, then say:
   > Run `/bug-fix` to fix the next highest-priority bug, or `/bug-fix BUG-XXX` to fix this one specifically.
