# Task: Create a New Planned Spec

## Input
The requirement abstract is provided as `$ARGUMENTS`.
If empty, ask the user to provide the requirement before proceeding.

## Steps

1. **Read context**:
   - Read `CLAUDE.md` for tech stack, patterns, and the Top-Level Features table
   - List all files in `SPECS/planned/`, `SPECS/active/`, and `SPECS/done/` to determine the next spec number and avoid duplication

2. **Determine filename**:
   - Next spec number = highest existing number + 1 (e.g. existing `06-...` → new is `07`)
   - Slug = feature name in lowercase-hyphenated form (e.g. `bookmark-manager`)
   - Output path: `SPECS/planned/[NN]-[slug].md`

3. **Write the spec** to `SPECS/planned/[NN]-[slug].md` following the exact header and section format used in existing specs:

```markdown
---
feature  : [Feature Name]
status   : PLANNED
created  : YYYY-MM-DD
completed: —
replaces : none
---

# Feature [N] — [Feature Name]

## Goal
[1–2 sentences: what this does and why it matters]

---

## User Stories
- As a [role], I want [action] so that [benefit].

---

## [Flow — name it appropriately: e.g. "Processing Flow", "Interaction Flow"]
[Numbered steps describing the end-to-end happy path]

---

## Data Model
[New tables or schema changes, using same SQL comment style as existing specs]

---

## API Routes
| Method | Route | Description |
|---|---|---|

---

## Service Layer
[Key service files and functions with brief descriptions]

---

## Edge Cases
| Case | Handling |
|---|---|

---

## Acceptance Criteria
- [ ] ...
```

4. **Update `CLAUDE.md`**:
   - Add a new row to the Top-Level Features table: `| N | [Feature Name] | PLANNED |`

5. **Confirm** to the user:
   - The spec file path created
   - A one-line summary of what was specced
   - Remind them: run `/next-feature` when ready to implement
