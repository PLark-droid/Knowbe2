---
name: fix-issue
description: >-
  Fix a GitHub issue following project standards.
  Use when resolving a specific issue by number.
  Keywords: fix, issue, bug, resolve, 修正
disable-model-invocation: true
argument-hint: [issue-number]
allowed-tools: Bash(gh *), Read, Grep, Glob, Edit, Write
---

# Fix GitHub Issue

Fix GitHub issue #$ARGUMENTS following project standards.

## Steps

1. **Understand the issue**
   ```bash
   gh issue view $0 --json title,body,labels,comments
   ```
   - Read the description and comments
   - Check labels for priority and type

2. **Find relevant code**
   - Use Grep to locate related files
   - Read surrounding context

3. **Implement the fix**
   - Make minimal, focused changes
   - Follow existing code patterns
   - No unrelated changes

4. **Write tests**
   - Add tests covering the fix
   - Verify existing tests pass: `npm test`

5. **Commit**
   - `fix: description (#$0)`
   - Reference the issue number

## Example

```
/fix-issue 42
```

## Constraints

- Only fix the specific issue, no drive-by refactors
- If blocked, escalate rather than hack around it
