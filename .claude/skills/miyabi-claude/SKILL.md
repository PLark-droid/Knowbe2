---
name: miyabi-claude
description: Claude Code integration, MCP server management, and system health checks. Use when checking Claude config, MCP server status, Claude logs, background shells, searching MCP tools, or running health diagnostics.
allowed-tools:
  - mcp__miyabi-mcp-bundle__claude_*
  - mcp__miyabi-mcp-bundle__mcp_*
  - mcp__miyabi-mcp-bundle__health_*
  - mcp__miyabi-mcp-bundle__linux_*
  - mcp__miyabi-mcp-bundle__windows_*
---

# Miyabi Claude & MCP Integration

15 tools for Claude Code, MCP management, health checks, and OS services.

## Claude Integration (8 tools)

| Tool | Description |
|------|-------------|
| `claude_config` | Claude Desktop configuration |
| `claude_mcp_status` | MCP server connection status |
| `claude_session_info` | Session details (CPU, memory) |
| `claude_logs` | Recent Claude Code logs |
| `claude_log_search` | Search logs for patterns |
| `claude_log_files` | List all log files |
| `claude_background_shells` | Background shell processes |
| `claude_status` | Complete Claude status overview |

## MCP Self-Discovery (3 tools)

| Tool | Description |
|------|-------------|
| `mcp_search_tools` | Search tools by name/description |
| `mcp_list_categories` | List all tool categories with counts |
| `mcp_get_tool_info` | Detailed tool info with parameters |

## Health & OS (4 tools)

| Tool | Description |
|------|-------------|
| `health_check` | Comprehensive health check |
| `linux_systemd_units` | Systemd units status (Linux) |
| `linux_systemd_status` | Detailed systemd unit status (Linux) |
| `windows_service_status` | Windows service status |

## Workflow Patterns

### MCP tool discovery
1. `mcp_list_categories` — see all categories
2. `mcp_search_tools` — find tools by keyword
3. `mcp_get_tool_info` — get usage details

### Claude debugging
1. `claude_status` — overview of everything
2. `claude_logs` — recent activity
3. `claude_log_search` — find specific errors
4. `claude_mcp_status` — verify MCP servers

### System health
1. `health_check` — run full diagnostics
