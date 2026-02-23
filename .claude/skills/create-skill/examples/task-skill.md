---
name: fix-issue
description: Fix a GitHub issue following project standards. Use when resolving a specific issue by number.
disable-model-invocation: true
argument-hint: [issue-number]
allowed-tools: Bash(gh *), Read, Grep, Glob
---

# Fix GitHub Issue

Fix GitHub issue #$ARGUMENTS following project standards.

## Steps

1. **Understand the issue**
   ```bash
   gh issue view $0 -R OWNER/REPO
   ```
   - Read the issue description and comments
   - Check labels for priority and type

2. **Find relevant code**
   - Use Grep to locate related files
   - Read surrounding context to understand the codebase

3. **Implement the fix**
   - Make minimal, focused changes
   - Follow existing code style and patterns
   - Do not introduce unrelated changes

4. **Write tests**
   - Add tests that cover the fix
   - Verify existing tests still pass

5. **Commit**
   - Use conventional commit message: `fix: description (#issue-number)`
   - Reference the issue number in the commit
