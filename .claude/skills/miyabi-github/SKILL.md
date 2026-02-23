---
name: miyabi-github
description: GitHub repository management via API. Use when working with GitHub issues, pull requests, labels, milestones, branches, releases, workflows, code reviews, or repository information.
allowed-tools:
  - mcp__miyabi__github_*
---

# Miyabi GitHub Integration

20 tools for GitHub operations via the Octokit API.

## Available Tools

### Issues
| Tool | Description |
|------|-------------|
| `github_list_issues` | List issues (filter by state/labels/assignee) |
| `github_get_issue` | Get full issue details |
| `github_create_issue` | Create issue with markdown body and labels |
| `github_update_issue` | Update title/body/state/assignees |
| `github_add_comment` | Add markdown comment to issue/PR |

### Pull Requests
| Tool | Description |
|------|-------------|
| `github_list_prs` | List PRs (filter by state) |
| `github_get_pr` | PR details with diff stats and merge status |
| `github_create_pr` | Create PR from head to base branch |
| `github_merge_pr` | Merge PR (merge/squash/rebase) |
| `github_list_pr_reviews` | List PR reviews with approval status |
| `github_submit_review` | Submit pending PR review |

### Repository
| Tool | Description |
|------|-------------|
| `github_repo_info` | Repo metadata (stars, forks, language) |
| `github_list_branches` | Branches with protection status |
| `github_compare_commits` | Compare branches/commits |
| `github_list_releases` | Releases with tags and assets |
| `github_list_labels` | All repository labels |
| `github_add_labels` | Add labels to issue/PR |
| `github_list_milestones` | Milestones for release tracking |

### CI/CD
| Tool | Description |
|------|-------------|
| `github_list_workflows` | GitHub Actions workflows |
| `github_list_workflow_runs` | Recent workflow runs and status |

## Workflow Patterns

### Issue triage
1. `github_list_issues` — list open issues
2. `github_get_issue` — read issue details
3. `github_add_labels` — categorize with labels

### PR review workflow
1. `github_list_prs` — find open PRs
2. `github_get_pr` — review PR details
3. `github_list_pr_reviews` — check review status
4. `github_submit_review` — approve or request changes
