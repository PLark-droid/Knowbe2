---
name: miyabi-tmux
description: Tmux terminal multiplexer management. Use when listing sessions, managing windows and panes, sending commands to terminals, capturing output, or monitoring running processes in tmux.
allowed-tools:
  - mcp__miyabi-mcp-bundle__tmux_*
---

# Miyabi Tmux Monitor

10 tools for tmux session and pane management.

## Available Tools

| Tool | Description |
|------|-------------|
| `tmux_list_sessions` | All sessions with window count/status |
| `tmux_list_windows` | Windows in a session |
| `tmux_list_panes` | Panes with dimensions and commands |
| `tmux_session_info` | Detailed session info (creation time, clients) |
| `tmux_send_keys` | Send keystrokes/text to a pane |
| `tmux_pane_capture` | Capture terminal output (scrollback) |
| `tmux_pane_search` | Search pane content for pattern |
| `tmux_pane_tail` | Last N lines from pane output |
| `tmux_pane_is_busy` | Check if pane is running a command |
| `tmux_pane_current_command` | Currently running command in pane |

## Workflow Patterns

### Monitor running services
1. `tmux_list_sessions` — find sessions
2. `tmux_list_panes` — see all panes
3. `tmux_pane_is_busy` — check if processes running
4. `tmux_pane_tail` — see recent output

### Send commands to services
1. `tmux_list_sessions` — find target session
2. `tmux_send_keys` — send command to pane
3. `tmux_pane_tail` — verify output

### Search for output
1. `tmux_pane_capture` — capture full output
2. `tmux_pane_search` — find specific pattern
