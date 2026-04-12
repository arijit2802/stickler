# Task: Implement a Specific Spec

## Input
The spec filename or path is provided as `$ARGUMENTS`.
Examples: `04-blog-qa-feedback-loop`, `SPECS/planned/04-blog-qa-feedback-loop.md`

If `$ARGUMENTS` is empty, tell the user to provide a spec filename and stop.

## Pre-flight Checks

1. **Resolve the spec file**:
   - Accept any of: bare name (`04-blog-qa-feedback-loop`), filename with extension, or full path
   - Search `SPECS/planned/`, `SPECS/active/`, and `SPECS/done/` for a match
   - If not found, tell the user and stop
   - If found in `SPECS/done/`, warn the user this spec is already completed and stop

2. **Check for active spec conflict**:
   - List files in `SPECS/active/`
   - If a DIFFERENT spec is already active, tell the user which one is active and stop — only one spec can be implemented at a time

3. **Move spec to active** (if currently in `SPECS/planned/`):
   - Move the file to `SPECS/active/`
   - Update the spec header: `status: ACTIVE`

## Implementation

4. **Read the spec fully** before writing any code

5. **Read `CLAUDE.md`** for established patterns, constraints, and tech stack

6. **Implement file by file** following the Feature Development Workflow in CLAUDE.md:
   - DB schema changes first (then `npm run db:generate && npm run db:migrate`)
   - Types → Models → Services → API routes → Components → Pages
   - Pause after each file for user confirmation before proceeding

7. **Verify**: run `npm run build` — fix all type errors before continuing

## Wrap Up

8. **Move spec to done**:
   - Move file from `SPECS/active/` to `SPECS/done/`
   - Update header: `status: DONE`, `completed: YYYY-MM-DD`

9. **Update `CLAUDE.md`**:
   - Mark the feature as `DONE` in the Top-Level Features table
   - Add established patterns under `## Established Patterns`
   - Add a row to the Change Log

10. **Report** to the user: files created/modified, routes available, and how to verify in the browser
