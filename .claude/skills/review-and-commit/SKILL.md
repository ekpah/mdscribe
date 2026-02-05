---
name: review-and-commit
description: Review unstaged changes, verify they work, and create a meaningful commit. Use this when you have local changes ready to commit and want to ensure quality before committing.
license: MIT
metadata:
  author: nils
  version: "1.0.0"
---

# Review and Commit

Review local changes, verify they work, and commit with a meaningful message.

## Workflow

### 1. Survey Changes

```bash
# Check unstaged changes (main focus)
git diff

# Check staged changes (if any)
git diff --cached

# Get current branch and status
git status
```

Present a summary:
- What files changed
- Brief description of what each change does
- Any concerns or issues spotted

### 2. Analyze Changes

For each modified file:
1. Read the diff carefully
2. Understand the purpose of the change
3. Check for:
   - Logic correctness
   - Potential bugs
   - Security issues
   - Code style consistency

Summarize findings in a table:

| File | Purpose | Status |
|------|---------|--------|
| path/to/file.ts | Description of change | OK / Issue |

### 3. Verify Changes Work

Run appropriate verification based on the project:

```bash
# TypeScript check (if applicable)
bun run tsc --noEmit 2>&1 | head -50

# Build test
bun run build 2>&1 | tail -30

# Lint (if configured)
bun run lint 2>&1 | head -30
```

**If verification fails:** Report issues and offer to fix them before committing.

### 4. Check Commit Style

```bash
# Review recent commits for message style
git log --oneline -10
```

Note the project's commit message conventions:
- Prefix style (feat:, fix:, refactor:, etc.)
- Message capitalization
- Description format

### 5. Stage and Commit

Stage specific files (prefer explicit file names over `git add -A`):

```bash
git add <file1> <file2> ...
```

Create commit with descriptive message:

```bash
git commit -m "$(cat <<'EOF'
<type>: <short description>

- Key change 1
- Key change 2

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

### 6. Verify Commit

```bash
git status
git log --oneline -3
```

---

## Commit Message Guidelines

### Types
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring (no behavior change)
- `perf`: Performance improvement
- `docs`: Documentation only
- `chore`: Maintenance tasks
- `test`: Adding/updating tests

### Good Messages
- `feat: add user authentication flow`
- `fix: handle null values in date parser`
- `refactor: simplify switch tag to use attributes`
- `perf: optimize template search with caching`

### Bad Messages
- `fix stuff` (too vague)
- `WIP` (not ready to commit)
- `asdf` (meaningless)

---

## Quick Reference

```bash
# View changes
git diff                    # Unstaged changes
git diff --cached           # Staged changes
git diff HEAD               # All changes vs last commit

# Selective staging
git add -p <file>           # Interactive staging (patches)
git add <file1> <file2>     # Stage specific files

# Commit
git commit -m "message"     # Simple commit
git commit                  # Opens editor

# Undo (if needed)
git checkout -- <file>      # Discard unstaged changes
git reset HEAD <file>       # Unstage a file
git reset HEAD~1 --soft     # Undo commit, keep changes
```

---

## When to Use This Skill

- After making local changes you want to commit
- When reviewing work done by yourself or another agent
- Before creating a PR to ensure commits are clean
- To verify changes work before pushing
