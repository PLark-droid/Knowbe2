---
name: miyabi-system
description: System monitoring and diagnostics. Use when checking CPU, memory, disk usage, system load, processes, battery, temperature, log analysis, error investigation, or performance troubleshooting.
allowed-tools:
  - mcp__miyabi__resource_*
  - mcp__miyabi__process_*
  - mcp__miyabi__log_*
---

# Miyabi System Monitor

31 tools for resource monitoring, process management, and log analysis.

## Resource Monitor (10 tools)

| Tool | Description |
|------|-------------|
| `resource_cpu` | CPU usage (overall and per-core) |
| `resource_memory` | RAM and swap usage |
| `resource_disk` | Disk space per filesystem |
| `resource_load` | System load average (1/5/15 min) |
| `resource_overview` | Comprehensive system overview |
| `resource_processes` | Top processes by CPU/memory |
| `resource_uptime` | System uptime and boot time |
| `resource_network_stats` | Network interface traffic stats |
| `resource_battery` | Battery status and charge level |
| `resource_temperature` | CPU/system temperatures |

## Process Manager (14 tools)

| Tool | Description |
|------|-------------|
| `process_list` | Running processes with CPU/memory |
| `process_info` | Detailed info by PID |
| `process_search` | Find processes by name/command |
| `process_tree` | Parent-child process hierarchy |
| `process_top` | Top N processes by resource usage |
| `process_children` | Child processes of a parent PID |
| `process_ports` | Network ports used by a process |
| `process_file_descriptors` | Open files/sockets for a process |
| `process_environment` | Environment variables of a process |
| `process_cpu_history` | CPU usage trend for a process |
| `process_memory_detail` | Detailed memory breakdown (RSS/virtual) |
| `process_threads` | Threads within a process |
| `process_io_stats` | Disk I/O stats (Linux only) |
| `process_kill` | Terminate a process (requires confirm=true) |

## Log Aggregator (7 tools)

| Tool | Description |
|------|-------------|
| `log_sources` | Available log files |
| `log_get_recent` | Recent log entries (filter by source/time) |
| `log_search` | Search logs for pattern |
| `log_get_errors` | Error-level entries |
| `log_get_warnings` | Warning-level entries |
| `log_tail` | Last N lines from a log |
| `log_stats` | Log file statistics |

## Diagnostic Workflows

### Performance investigation
1. `resource_overview` — get full system snapshot
2. `resource_processes` — find top resource consumers
3. `process_info` — deep dive into suspect process
4. `process_cpu_history` — check CPU trend
5. `log_get_errors` — look for correlated errors

### Memory leak detection
1. `resource_memory` — check current memory usage
2. `process_list` (sort: memory) — find memory hogs
3. `process_memory_detail` — RSS/virtual breakdown
4. `process_children` — check for leaking subprocesses

### Error investigation
1. `log_get_errors` — recent errors
2. `log_search` — search for specific patterns
3. `process_search` — find related processes
4. `resource_overview` — check if resource-related
