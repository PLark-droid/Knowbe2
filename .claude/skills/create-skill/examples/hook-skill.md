---
name: safe-deploy
description: >-
  Deploy to production with pre-deploy validation hooks.
  Use when deploying, releasing, or pushing to production.
  Keywords: deploy, release, production, ship, デプロイ
disable-model-invocation: true
argument-hint: [environment]
allowed-tools: Bash(npm run *), Bash(gh *), Read
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: ".claude/hooks/validate-typescript.sh"
          timeout: 30
---

# Safe Deploy

Deploy to **$ARGUMENTS** environment with full validation.

## Pre-flight Checks

These are enforced automatically by hooks:
- TypeScript compilation must pass (via PreToolUse hook)
- No uncommitted changes allowed

## Steps

1. **Verify environment**
   - Confirm target: `$0` (staging / production)
   - Check current branch is `main`

2. **Run quality gate**
   ```bash
   npm run typecheck && npm test && npm run lint
   ```

3. **Build**
   ```bash
   npm run build
   ```

4. **Deploy**
   ```bash
   npm run deploy -- --env=$0
   ```

5. **Health check**
   - Verify deployment is healthy
   - If unhealthy, trigger rollback

6. **Report**
   - Create GitHub deployment status
   - Notify via webhook if configured

## Example

```
/safe-deploy staging
/safe-deploy production
```

## Constraints

- Production deploys require explicit user confirmation
- Always run full test suite before deploy
- Never skip TypeScript validation
