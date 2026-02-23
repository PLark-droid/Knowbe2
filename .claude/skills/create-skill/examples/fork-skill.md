---
name: deep-research
description: >-
  Deep research a codebase topic in isolated context.
  Use when exploring architecture, understanding complex systems, or investigating dependencies.
  Keywords: research, explore, investigate, analyze, 調査
context: fork
agent: Explore
argument-hint: [topic]
allowed-tools: Read, Grep, Glob
---

# Deep Research

Research "$ARGUMENTS" thoroughly in this codebase.

## Steps

1. **Identify scope**
   - Use Glob to find files matching the topic
   - Use Grep to search for related keywords

2. **Read & analyze**
   - Read each relevant file
   - Note patterns, dependencies, and data flow

3. **Map relationships**
   - How components connect
   - What depends on what
   - Entry points and exit points

4. **Summarize findings**
   - Key files and their roles
   - Architecture patterns discovered
   - Potential issues or tech debt
   - Recommendations

## Example

```
/deep-research authentication flow
/deep-research DAG execution engine
```

## Output

Return a structured summary with:
- File references (path:line)
- Architecture diagram (ASCII)
- Key insights
- Suggestions for improvement
