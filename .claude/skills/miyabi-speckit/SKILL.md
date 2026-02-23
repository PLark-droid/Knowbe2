---
name: miyabi-speckit
description: Spec-Kit specification-driven development. Use when initializing specs, creating feature specifications, generating implementation plans, creating task lists, checklists, or analyzing spec-to-code consistency.
allowed-tools:
  - mcp__miyabi-mcp-bundle__speckit_*
---

# Miyabi Spec-Kit

9 tools for specification-driven development.

## Available Tools

| Tool | Description |
|------|-------------|
| `speckit_init` | Initialize Spec-Kit in project (.speckit/) |
| `speckit_status` | Project status (features, specs, coverage) |
| `speckit_constitution` | Read/update project constitution |
| `speckit_specify` | Create formal specification from feature description |
| `speckit_plan` | Generate implementation plan with dependencies |
| `speckit_tasks` | Generate actionable task list from plan |
| `speckit_checklist` | Create pre-implementation QA checklist |
| `speckit_analyze` | Analyze spec-to-implementation consistency |
| `speckit_list_features` | List all features with status |

## Workflow: Feature Development

1. `speckit_init` — initialize (first time only)
2. `speckit_specify` — write formal spec from description
3. `speckit_plan` — generate implementation plan
4. `speckit_tasks` — break plan into actionable tasks
5. `speckit_checklist` — create QA checklist
6. (implement the feature)
7. `speckit_analyze` — verify implementation matches spec
