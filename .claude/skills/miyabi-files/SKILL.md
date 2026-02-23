---
name: miyabi-files
description: File system inspection and analysis. Use when checking file metadata, finding recently changed files, searching files by pattern, viewing directory trees, comparing files, calculating checksums, finding duplicates, or analyzing directory sizes.
allowed-tools:
  - mcp__miyabi__file_*
---

# Miyabi File Inspector

10 tools for file system analysis.

## Available Tools

| Tool | Description |
|------|-------------|
| `file_stats` | File metadata (size, permissions, mtime) |
| `file_recent_changes` | Recently modified files (time window) |
| `file_search` | Find files by glob pattern |
| `file_tree` | Directory tree structure (default depth: 3) |
| `file_compare` | Compare two files (size, timestamps, hash) |
| `file_changes_since` | Files modified after a timestamp |
| `file_read` | Read text file (max 100KB) |
| `file_checksum` | File hash (MD5/SHA256/SHA512) |
| `file_size_summary` | Directory size breakdown |
| `file_duplicates` | Find duplicate files by content hash |

## Workflow Patterns

### Project exploration
1. `file_tree` — visualize directory structure
2. `file_search` — find specific file types
3. `file_stats` — check file properties

### Change tracking
1. `file_recent_changes` — what changed recently
2. `file_changes_since` — changes since specific time
3. `file_compare` — compare file versions

### Cleanup
1. `file_size_summary` — find space usage
2. `file_duplicates` — identify redundant files
