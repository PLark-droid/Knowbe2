---
name: miyabi-containers
description: Docker, Docker Compose, and Kubernetes container management. Use when working with containers, images, volumes, Compose services, pods, deployments, or container orchestration.
allowed-tools:
  - mcp__miyabi__docker_*
  - mcp__miyabi__compose_*
  - mcp__miyabi__k8s_*
---

# Miyabi Container Operations

20 tools for Docker, Compose, and Kubernetes.

## Docker (10 tools)

| Tool | Description |
|------|-------------|
| `docker_ps` | List containers (all=true for stopped) |
| `docker_images` | List images with size/tags |
| `docker_logs` | Container logs (tail, since, timestamps) |
| `docker_inspect` | Detailed container/image config |
| `docker_stats` | Live CPU/memory usage |
| `docker_exec` | Execute command inside container |
| `docker_start` | Start stopped container |
| `docker_stop` | Stop running container |
| `docker_restart` | Restart container |
| `docker_build` | Build image from Dockerfile |

## Docker Compose (4 tools)

| Tool | Description |
|------|-------------|
| `compose_ps` | Compose service status |
| `compose_up` | Start services (detach, build options) |
| `compose_down` | Stop services (remove volumes/orphans) |
| `compose_logs` | Combined service logs |

## Kubernetes (6 tools)

| Tool | Description |
|------|-------------|
| `k8s_get_pods` | List pods (namespace/label filter) |
| `k8s_get_deployments` | Deployments with replica status |
| `k8s_logs` | Pod logs (container, tail, since) |
| `k8s_describe` | Detailed resource info |
| `k8s_apply` | Apply manifest (dryRun option) |
| `k8s_delete` | Delete resource (dryRun option) |

## Workflow Patterns

### Container debugging
1. `docker_ps` — find the container
2. `docker_logs` — check recent logs
3. `docker_inspect` — review config
4. `docker_exec` — run diagnostic command

### Compose deployment
1. `compose_up` (build=true, detach=true) — deploy
2. `compose_ps` — verify status
3. `compose_logs` — monitor output

### K8s troubleshooting
1. `k8s_get_pods` — check pod status
2. `k8s_logs` — read pod logs
3. `k8s_describe` — events and conditions
