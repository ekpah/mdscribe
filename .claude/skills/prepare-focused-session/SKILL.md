---
name: prepare-focused-session
description: Prepare for a focused 1-2 hour review session. Lists open PRs from background agents, helps select and organize commits for review, and guides through the review-improve-merge workflow.
license: MIT
metadata:
  author: nils
  version: "3.0.0"
---

# Prepare Focused Session

Review and improve PRs from background agents. Adapts to your current context.

## Quick Start

Run this command to survey open PRs:

```bash
gh pr list --state open --json number,title,body,headRefName,author,createdAt,additions,deletions,commits --jq '.[] | "PR #\(.number): \(.title)\n  Branch: \(.headRefName)\n  Author: \(.author.login)\n  Created: \(.createdAt | split("T")[0])\n  Changes: +\(.additions)/-\(.deletions) (\(.commits | length) commits)\n  \(.body | split("\n")[0:3] | join("\n  "))\n"'
```

Present as table:

| # | PR | Category | Summary | Changes | Risk |
|---|-----|----------|---------|---------|------|
| 1 | #66 | Feature | Add user auth | +407/-40 | Low |

**Categories:** Feature, Bug-fix, Improvement, Docs, Chore
**Risk:** Low (isolated), Medium (multi-file), High (core changes)

Ask: "Which PR to review? (number, range like '69-70', or 'all bug-fixes')"

---

## Multi-PR Review (Default when user selects multiple PRs)

When the user asks to review multiple PRs together, **always create a local review branch and cherry-pick each PR as a separate commit**. This is the default behavior — do NOT just show diffs.

### Steps:

1. **Fetch all PR branches:**
```bash
git fetch origin <branch1> <branch2> ...
```

2. **Create review branch from staging:**
```bash
git checkout -b "review/prs-<numbers>" origin/staging
```

3. **Cherry-pick each PR as a separate commit with a clean message:**
```bash
git cherry-pick <sha> --no-commit
git commit -m "<type>: <concise description>

<1-2 line summary of what the PR does>

(cherry-picked from PR #XX)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

4. **Present the review** using the Review Template below for each PR.

5. **Show the final commit log:**
```bash
git log --oneline origin/staging..HEAD
```

6. After presenting reviews, ask:
> "Any issues to address, or ready to merge into staging?"

### Merging after approval

When the user approves, merge the review branch into staging:
```bash
git checkout staging
git merge review/prs-<numbers>
git branch -d review/prs-<numbers>
```

Then close the original PRs (they're now merged via the review branch):
```bash
gh pr close <number> --comment "Merged via review branch into staging"
```

After merging/pushing, check Linear for issues related to the merged PRs (look for issue IDs in branch names like `SCR-XX`) and mark them as done.

---

## Single PR Review

For a single PR, checkout the PR branch directly:

```bash
gh pr checkout <number>
```

Then proceed to the Review Template.

---

## Review Template

For each PR, present:

```markdown
## PR #XX: [Title]

### Summary
[2-3 sentences on what this PR does]

### Files Changed
| File | Lines | Purpose |
|------|-------|---------|
| path/file.ts | +50/-20 | Description |

### Review Checklist
| Check | Status | Notes |
|-------|--------|-------|
| Logic correct | pass/warn/fail | |
| Error handling | pass/warn/fail | |
| Security | pass/warn/fail | |
| Conventions | pass/warn/fail | |

### Issues Found
| Severity | Issue | Suggestion |
|----------|-------|------------|
| Low/Med/High | Description | Fix approach |
```

---

## Implement Improvements

When user identifies issues to fix:

1. Read the relevant file(s)
2. Discuss approach briefly
3. Make the edit
4. **Leave changes unstaged** — NEVER commit without explicit user confirmation

**IMPORTANT:** After making edits, do NOT stage or commit. Present what was changed and wait for the user to confirm. Only commit when the user explicitly says to commit/merge/looks good.

Track changes:
```markdown
| Issue | Fix Applied |
|-------|-------------|
| 3 refs + 3 effects | Consolidated to single stateRef |
```

---

## Validate

Run validation, handle failures gracefully:

```bash
# TypeScript (required) — use per-package typecheck
bun run typecheck

# Lint (best effort)
bun run lint 2>&1 | head -20 || echo "Lint skipped (config issue)"

# Build (if time permits)
bun run build 2>&1 | tail -10
```

**If lint fails due to config:** Skip it, note in commit. TypeScript passing is sufficient for review.

**If TypeScript fails:** Fix errors before committing.

---

## Session Summary

At session end:

```markdown
## Session Summary

### Reviewed & Merged
- PR #66: Input suggested values — merged via review/prs-66
- PR #74, #75, #76: Context helper, pricing, error reporting — merged via review/prs-74-75-76

### Deferred
- PR #71: Needs dependency review first

### Next Session
- [ ] Review PR #71 after checking dependencies
```

---

## Quick Reference

```bash
# PR operations
gh pr list --state open
gh pr view <number>
gh pr checkout <number>
gh pr diff <number>
gh pr close <number> --comment "message"

# Review diffs
git diff origin/staging --stat
git diff origin/staging -- <path>
git log origin/staging..HEAD --oneline

# Cherry-pick
git cherry-pick <sha> --no-commit
git commit -m "message"

# Merge
git checkout staging
git merge review/prs-<numbers>

# Undo
git checkout -- <file>      # Discard file changes
git reset HEAD~1 --soft     # Undo last commit, keep changes
```
