---
name: create-skill
description: Create a new Claude Code skill (slash command) with proper structure, frontmatter, templates, and examples. Use when building custom skills, adding project automation, extending Claude capabilities, or creating reusable workflows. Trigger words: "skill", "slash command", "create command", "automation", "new skill", "スキル作成"
argument-hint: [skill-name]
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(mkdir *), Bash(ls *), AskUserQuestion
---

# Create a New Claude Code Skill

You are a **skill creation expert**. Help the user build a production-ready Claude Code skill following the official specification.

## Step 1: Gather Requirements

If `$ARGUMENTS` is provided, use it as the skill name. Otherwise ask the user.

Use AskUserQuestion to clarify the following:

### Q1: Skill Type

| Type | Description | Best for |
|------|-------------|----------|
| **Reference** | Knowledge/conventions Claude applies | Style guides, patterns, domain knowledge |
| **Task** | Step-by-step workflow | Fix bugs, deploy, create PRs, run pipelines |
| **Fork** | Isolated subagent research | Deep codebase exploration, heavy analysis |

### Q2: Invocation Control

| Setting | Effect |
|---------|--------|
| Auto-trigger (default) | Claude invokes when relevant keywords match |
| Manual only | Only user can invoke via `/name` — use for risky/destructive actions |
| Background knowledge | Claude knows about it but user cannot invoke — for implicit conventions |

### Q3: Arguments

Does the skill accept parameters? Examples:
- `[issue-number]` — single arg
- `[file-path] [format]` — multiple args
- None — no arguments

### Q4: Tools

What tools should the skill have permission to use without prompting?
- Read-only: `Read, Grep, Glob`
- GitHub: `Bash(gh *)`
- npm: `Bash(npm *)`
- Full dev: `Read, Grep, Glob, Edit, Write, Bash(npm *), Bash(gh *)`

## Step 2: Create Directory Structure

```bash
mkdir -p .claude/skills/SKILL_NAME
```

For complex skills, also create:
```bash
mkdir -p .claude/skills/SKILL_NAME/templates
mkdir -p .claude/skills/SKILL_NAME/examples
```

## Step 3: Generate SKILL.md

Write the SKILL.md file with **frontmatter** and **markdown instructions**.

### Frontmatter Reference

```yaml
---
# === Required ===
name: skill-name                          # kebab-case, max 64 chars

# === Strongly Recommended ===
description: >-                           # What + When + Keywords
  What it does in one sentence.
  Use when [trigger scenarios].
  Keywords: word1, word2, word3

# === Invocation Control ===
disable-model-invocation: false           # true = manual only (/name)
user-invocable: true                      # false = background knowledge only

# === Arguments ===
argument-hint: [arg1] [arg2]             # Shown in autocomplete

# === Permissions ===
allowed-tools: Read, Grep, Glob          # Tools without permission prompt

# === Execution Context ===
context: fork                             # fork = isolated subagent
agent: general-purpose                    # Explore | Plan | general-purpose

# === Model ===
model: sonnet                             # opus | sonnet | haiku

# === Hooks (optional) ===
hooks:
  PreToolUse:
    - matcher: "Edit|Write"
      hooks:
        - type: command
          command: ".claude/hooks/validate.sh"
---
```

### Content Structure Rules

1. **Under 500 lines** — move complex content to supporting files
2. **Overview first** — 2 sentences: what + why
3. **Numbered steps** — clear, actionable instructions
4. **Arguments section** — document `$ARGUMENTS`, `$0`, `$1` usage
5. **Example invocations** — show exact `/skill-name arg` syntax
6. **Constraints** — what to avoid, limitations

### Dynamic Variable Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `$ARGUMENTS` | All args as string | `/skill foo bar` → `"foo bar"` |
| `$0` | First argument | `/skill foo bar` → `"foo"` |
| `$1` | Second argument | `/skill foo bar` → `"bar"` |
| `$ARGUMENTS[N]` | Nth argument (0-based) | Same as `$N` |
| `${CLAUDE_SESSION_ID}` | Current session ID | For logging |

### Description Writing Tips

The description is **critical** — Claude uses it to decide when to auto-invoke.

**Include**:
- What the skill does (action verb)
- When to use it (trigger scenarios)
- Natural language keywords users would say
- Japanese trigger words if applicable

**Example**:
```yaml
description: >-
  Generate unit tests for TypeScript files using Vitest.
  Use when writing tests, improving coverage, or adding test cases.
  Keywords: test, テスト, coverage, vitest, unit test
```

## Step 4: Generate Supporting Files

### For Task Skills

Create an example invocation in `examples/`:
```markdown
# Example: skill-name with issue #42
/skill-name 42

Expected behavior:
1. Fetches issue #42
2. Analyzes the issue
3. Produces output
```

### For Reference Skills

Create a detailed reference in the skill directory:
```markdown
# Full Reference
Complete API docs, pattern libraries, or convention guides
that are too long for SKILL.md but Claude should read when needed.
```

### For Fork Skills

No supporting files needed — fork skills run in isolation with their own context.

## Step 5: Validate & Test

After creating all files:

1. **List the created structure**:
   ```bash
   ls -R .claude/skills/SKILL_NAME/
   ```

2. **Read back SKILL.md** to verify content

3. **Show the user** the final result with:
   - Created file paths
   - How to invoke: `/$SKILL_NAME` or `/$SKILL_NAME arg`
   - Whether auto-trigger is enabled
   - Reminder: skill is active immediately, no restart needed

4. **Quick test suggestion**: Tell user to type `/$SKILL_NAME` to verify autocomplete works

## Templates & Examples

Reference these for generating different skill types:

- [Blank template](templates/skill-template.md) — Starting point
- [Reference skill](examples/reference-skill.md) — Knowledge/convention pattern
- [Task skill](examples/task-skill.md) — Step-by-step workflow pattern
- [Fork skill](examples/fork-skill.md) — Isolated research pattern
- [Hook skill](examples/hook-skill.md) — Skill with lifecycle hooks

## Quality Checklist

Before finishing, verify:

- [ ] Name is kebab-case, descriptive, max 64 chars
- [ ] Description has keywords + trigger scenarios (both EN/JP if applicable)
- [ ] `disable-model-invocation: true` for destructive/risky actions
- [ ] `allowed-tools` are scoped (not `Bash(*)`)
- [ ] Instructions are clear, numbered steps
- [ ] Arguments documented with `$0`, `$1` syntax
- [ ] SKILL.md is under 500 lines
- [ ] Supporting files referenced from SKILL.md
- [ ] At least one example invocation shown
