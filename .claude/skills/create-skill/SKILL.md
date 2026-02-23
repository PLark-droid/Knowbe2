---
name: create-skill
description: Create a new custom skill (slash command) for Claude Code. Use when someone wants to build a slash command, add project-specific automation, or extend Claude's capabilities with reusable workflows. Trigger words: "skill", "slash command", "command", "automation"
argument-hint: [skill-name]
allowed-tools: Read, Glob, Grep, Bash(mkdir *), Bash(ls *)
---

# Create a New Claude Code Skill

You are helping the user create a custom skill for Claude Code.

## Step 1: Gather Information

Ask the user the following (use AskUserQuestion tool):

1. **Skill name** (kebab-case, e.g., `fix-issue`, `generate-docs`, `deploy-staging`)
2. **Description** (1-2 sentences: what it does, when to use it)
3. **Invocation type**:
   - Manual only (`disable-model-invocation: true`) — for risky/destructive actions like deploy
   - Auto-triggerable (`false` or omit) — Claude can auto-invoke when relevant
4. **Purpose**:
   - Reference skill — provides knowledge/conventions Claude applies (e.g., coding style guide)
   - Task skill — executes a workflow step-by-step (e.g., fix a bug, create PR)
   - Fork skill — runs in isolated subagent context for heavy research
5. **Arguments**: Does it accept parameters? (e.g., issue number, file path)
6. **Allowed tools**: What tools should Claude be permitted to use?

If the user provided `$ARGUMENTS` as a skill name, use that directly and ask the remaining questions.

## Step 2: Create Directory Structure

```bash
mkdir -p .claude/skills/$SKILL_NAME
```

Optionally create supporting directories:
```bash
mkdir -p .claude/skills/$SKILL_NAME/templates
mkdir -p .claude/skills/$SKILL_NAME/examples
```

## Step 3: Generate SKILL.md

Create `.claude/skills/$SKILL_NAME/SKILL.md` with proper frontmatter and instructions.

### Frontmatter Fields

```yaml
---
name: $SKILL_NAME                        # Required: kebab-case, max 64 chars
description: $DESCRIPTION                # Recommended: keywords + when to trigger
disable-model-invocation: true/false     # Optional: prevent auto-triggering
argument-hint: [arg-name]               # Optional: hint for autocomplete
allowed-tools: Read, Grep, Bash(cmd *)  # Optional: tools without permission prompt
user-invocable: true/false              # Optional: hide from / menu if false
context: fork                           # Optional: run in isolated subagent
agent: general-purpose                  # Optional: subagent type (with context: fork)
---
```

### Content Structure

Write clear markdown instructions that Claude follows when the skill is invoked:

1. **Overview** — What the skill does
2. **Steps** — Step-by-step workflow
3. **Arguments** — How to use `$ARGUMENTS`, `$0`, `$1` for dynamic input
4. **Examples** — Expected input/output
5. **Constraints** — What to avoid

### Dynamic Variables

| Variable | Description |
|----------|-------------|
| `$ARGUMENTS` | All arguments passed to the skill |
| `$0`, `$1`, `$2` | Individual arguments by index |
| `${CLAUDE_SESSION_ID}` | Current session ID |

## Step 4: Create Supporting Files (if needed)

For complex skills, add:
- `templates/` — Blank templates users can copy
- `examples/` — Real-world usage examples
- `reference/` — Detailed documentation

Reference them from SKILL.md so Claude knows when to load them.

## Step 5: Verify

After creating the skill:
1. List the created files to confirm structure
2. Show the user the final SKILL.md content
3. Tell the user they can invoke it with `/$SKILL_NAME`
4. Remind them to test it

## Templates and Examples

Reference these for guidance:
- [Blank skill template](templates/skill-template.md) — Starting point for any skill
- [Reference skill example](examples/reference-skill.md) — Knowledge/conventions skill
- [Task skill example](examples/task-skill.md) — Step-by-step workflow skill

## Quick Checklist

- [ ] Skill name is kebab-case and descriptive
- [ ] Description includes keywords users would naturally say
- [ ] `disable-model-invocation` set appropriately (true for risky actions)
- [ ] Allowed tools listed in frontmatter
- [ ] Clear, step-by-step instructions in markdown
- [ ] Arguments documented if applicable
- [ ] Supporting files added for complex skills
