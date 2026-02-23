---
name: miyabi-network
description: Network diagnostics and monitoring. Use when checking network interfaces, connections, ports, DNS, ping, traceroute, SSL certificates, bandwidth, WiFi, routing, or debugging connectivity issues.
allowed-tools:
  - mcp__miyabi-mcp-bundle__network_*
---

# Miyabi Network Inspector

15 tools for comprehensive network diagnostics.

## Available Tools

| Tool | Description |
|------|-------------|
| `network_interfaces` | Network interfaces with IP/MAC/status |
| `network_connections` | Active TCP/UDP connections |
| `network_listening_ports` | Ports services are listening on |
| `network_stats` | I/O statistics per interface |
| `network_gateway` | Default gateway IP and interface |
| `network_bandwidth` | Current bandwidth usage (bytes/sec) |
| `network_overview` | Complete network overview |
| `network_ping` | Ping host for connectivity/latency |
| `network_dns_lookup` | Resolve hostname to IP |
| `network_port_check` | Check if TCP port is open |
| `network_public_ip` | Your public IP address |
| `network_wifi_info` | WiFi SSID, signal, channel |
| `network_route_table` | IP routing table |
| `network_ssl_check` | SSL/TLS certificate health |
| `network_traceroute` | Trace network path to host |

## Diagnostic Workflows

### Connectivity troubleshooting
1. `network_interfaces` — check interface status
2. `network_gateway` — verify gateway
3. `network_ping` — test connectivity
4. `network_dns_lookup` — verify DNS resolution

### Service debugging
1. `network_listening_ports` — find port conflicts
2. `network_connections` — active connections
3. `network_port_check` — test remote port

### Security audit
1. `network_ssl_check` — certificate expiry/validity
2. `network_public_ip` — verify external IP
3. `network_connections` — detect unusual connections
