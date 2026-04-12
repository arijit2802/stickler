# Task: Fix a Bug

## Argument Handling
- This command accepts an optional bug ID argument (e.g. `/bug-fix BUG-003`).
- Check `$ARGUMENTS` for a bug ID:
  - **If a bug ID is provided**: find and fix that specific bug only. If it doesn't exist or is already FIXED, tell the user and stop.
  - **If no bug ID is provided**: pick the next bug using the priority rules below.

## Priority Rules (when no ID provided)
1. If any bug is already `IN_PROGRESS`, continue with that one first.
2. Otherwise sort open bugs by severity: **critical > high > medium > low**
3. Within the same severity, pick the **lowest bug number** (chronological order — oldest first).

## Hard Rules
- Fix **ONE bug at a time** — never fix multiple bugs in one session.
- There must be a bug file in `BUGS/open/` to proceed — if none exist, tell the user and stop.
- **NEVER** modify files in `/db/migrations` — create new migrations only.
- **NEVER** use `console.log` — use the logger utility.
- Follow all code style rules in CLAUDE.md.

## Steps

1. **Select the bug**:
   - List all files in `BUGS/open/`
   - Apply the argument handling and priority rules above
   - Read the selected bug file fully
   - If a screenshot path is listed, read and analyse the image

2. **Analyse**:
   - Read every file listed in "Fix Scope"
   - Read any additional files needed for full context
   - Confirm or revise the root cause hypothesis in the bug file

3. **Update bug status** — edit the bug file: set `status: IN_PROGRESS`

4. **Implement the fix** — work file by file:
   - Make the minimal change that fixes the issue
   - Do not refactor surrounding code unless directly necessary
   - Pause after each file and confirm with the user before proceeding

5. **Verify**:
   - Run `npm run build` — fix any type errors before continuing
   - If tests exist for the affected area, run: `npm run test`

6. **Wrap up**:
   - Move the bug file from `BUGS/open/` to `BUGS/fixed/`
   - Update the bug file header: `status: FIXED`, `fixed: YYYY-MM-DD`
   - Append a `## Fix Applied` section describing what was changed and why

7. **Report** to the user:
   - Bug ID and title fixed
   - Root cause (confirmed)
   - Files changed
   - How to verify the fix in the browser
