---
name: prepare-focused-session
description: Prepare for a focused 1-2 hour review session. Lists open PRs from background agents, helps select and organize commits for review, and guides through the review-improve-merge workflow.
license: MIT
metadata:
  author: nils
  version: "2.0.0"
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

Ask: "Which PR to review? (number or 'all bug-fixes')"

---

## Detect Context

After user selects a PR, check their current state:

```bash
# Check current branch and uncommitted changes
git branch --show-current
git status --short
```

### Scenario A: Already on PR branch with local changes
User has been working on this PR. Skip to **Review Mode Selection**.

### Scenario B: On different branch, PR exists
```bash
gh pr checkout <number>
```
Then proceed to **Review Mode Selection**.

### Scenario C: Need to create review branch (multi-PR session)
```bash
git fetch origin
git checkout -b "review/session-$(date +%Y%m%d)" origin/staging
# Cherry-pick from selected PRs
```

---

## Review Mode Selection

Ask upfront:

> **How would you like to review?**
> 1. **Combined diff** (recommended) - See all changes from staging at once
> 2. **Commit-by-commit** - Review each commit separately
> 3. **Files only** - Just list changed files, you guide the review

---

## Combined Diff Review (Default)

```bash
# Stats overview
git diff origin/staging --stat

# Full diff per directory/file as needed
git diff origin/staging -- <path>
```

### Review Template

```markdown
## PR #XX: [Title]

### Summary
[2-3 sentences on what this PR does]

### Files Changed
| File | Lines | Purpose |
|------|-------|---------|
| path/file.ts | +50/-20 | Description |

### Architecture Review
[Key patterns, data flow, new types introduced]

### Review Checklist
| Check | Status | Notes |
|-------|--------|-------|
| Logic correct | ✅/⚠️/❌ | |
| Error handling | ✅/⚠️/❌ | |
| Security | ✅/⚠️/❌ | |
| Conventions | ✅/⚠️/❌ | |

### Issues Found
| Severity | Issue | Suggestion |
|----------|-------|------------|
| Low/Med/High | Description | Fix approach |

### Questions
- [Clarifications needed before proceeding]
```

After presenting review, ask:
> "Any issues to address, or ready to validate?"

---

## Implement Improvements

When user identifies issues to fix:

1. Read the relevant file(s)
2. Discuss approach briefly
3. Make the edit
4. Repeat for other issues

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
# TypeScript (required)
bunx tsc --noEmit 2>&1 | grep -E "(error|\.tsx?)" | head -20

# Lint (best effort - may have config issues)
bun run lint 2>&1 | head -20 || echo "Lint skipped (config issue)"

# Build (if time permits)
bun run build 2>&1 | tail -10
```

**If lint fails due to config:** Skip it, note in commit. TypeScript passing is sufficient for review.

**If TypeScript fails:** Fix errors before committing.

---

## Commit

Only commit files related to this PR:

```bash
# Stage specific files (not unrelated changes)
git add <file1> <file2> ...

# Commit with descriptive message
git commit -m "$(cat <<'EOF'
<type>: <short description>

- Bullet point of key change
- Another key change

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

**Commit types:** feat, fix, refactor, perf, docs, chore

**Good commit messages:**
- `refactor: consolidate refs in Inputs component`
- `fix: handle empty date values in InfoInput`
- `feat: add SuggestionBadge component`

---

## After Commit

Options to present:

1. **Push to update PR** - `git push`
2. **Continue to next PR** - Loop back to survey
3. **End session** - Show summary

---

## Session Summary

At session end:

```markdown
## Session Summary

### Reviewed
- PR #66: Input suggested values
  - Commits: 2 (1 original + 1 improvement)
  - Changes: Consolidated refs, simplified date utils

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

# Review diffs
git diff origin/staging --stat
git diff origin/staging -- <path>
git log origin/staging..HEAD --oneline

# Commit operations
git add <files>
git commit -m "message"
git push

# Undo
git checkout -- <file>      # Discard file changes
git reset HEAD~1 --soft     # Undo last commit, keep changes
```
