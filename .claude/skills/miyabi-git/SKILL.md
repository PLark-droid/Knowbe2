---
name: miyabi-git
description: Git repository inspection and analysis. Use when checking git status, viewing commit history, comparing diffs, tracking file changes, viewing blame, managing branches, stashes, tags, worktrees, submodules, or resolving merge conflicts.
allowed-tools:
  - mcp__miyabi-mcp-bundle__git_*
---

# Miyabi Git Inspector

19 tools for comprehensive git repository analysis.

## Available Tools

| Tool | Description |
|------|-------------|
| `git_status` | Working tree status (modified, staged, untracked) |
| `git_branch_list` | All local/remote branches with tracking info |
| `git_current_branch` | Current branch name |
| `git_log` | Commit history (default: 20 commits) |
| `git_diff` | Unstaged changes (optionally for specific file) |
| `git_staged_diff` | Changes staged for commit |
| `git_show` | Commit details with diff (default: HEAD) |
| `git_blame` | Line-by-line author info for a file |
| `git_file_history` | Commit history for a specific file |
| `git_branch_ahead_behind` | Commits ahead/behind upstream |
| `git_remote_list` | Configured remotes with URLs |
| `git_stash_list` | All stashed changes |
| `git_tag_list` | All tags with associated commits |
| `git_contributors` | Contributors ranked by commit count |
| `git_conflicts` | Files with merge conflicts |
| `git_worktree_list` | Git worktrees for parallel development |
| `git_submodule_status` | Submodule commit hash and sync state |
| `git_lfs_status` | Git LFS tracked files |
| `git_hooks_list` | Git hooks in .git/hooks |

## Workflow Patterns

### Pre-commit review
1. `git_status` — see all changes
2. `git_diff` — review unstaged changes
3. `git_staged_diff` — confirm what will be committed

### Branch analysis
1. `git_branch_list` — see all branches
2. `git_branch_ahead_behind` — check sync status
3. `git_log` — review recent commits

### Debug investigation
1. `git_blame` — find who changed specific lines
2. `git_file_history` — track file modification history
3. `git_show` — inspect specific commit details

### Merge conflict resolution
1. `git_conflicts` — identify conflicted files
2. `git_diff` — review conflict markers
3. `git_log` — understand divergent history
