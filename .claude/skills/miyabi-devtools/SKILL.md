---
name: miyabi-devtools
description: Developer utilities including time/timezone conversion, math calculations, unit conversion, statistics, UUID generation, random numbers, hashing, and structured thinking sessions.
allowed-tools:
  - mcp__miyabi__time_*
  - mcp__miyabi__calc_*
  - mcp__miyabi__gen_*
  - mcp__miyabi__think_*
---

# Miyabi Developer Tools

14 tools for time, math, generation, and thinking.

## Time (4 tools)

| Tool | Description |
|------|-------------|
| `time_current` | Current time in any timezone |
| `time_convert` | Convert between timezones |
| `time_format` | Format datetime with custom pattern |
| `time_diff` | Calculate time difference |

## Calculator (3 tools)

| Tool | Description |
|------|-------------|
| `calc_expression` | Evaluate math (sqrt, sin, cos, PI) |
| `calc_unit_convert` | Convert units (km/miles, kg/lb, C/F) |
| `calc_statistics` | Mean, median, stddev, variance, etc. |

## Generator (3 tools)

| Tool | Description |
|------|-------------|
| `gen_uuid` | Generate UUID v1/v4 (up to 100) |
| `gen_random` | Random integers or floats |
| `gen_hash` | Hash string (MD5/SHA1/SHA256/SHA512) |

## Thinking (3 tools)

| Tool | Description |
|------|-------------|
| `think_*` | Start structured thinking session |
| `think_branch` | Create alternative thinking branch |
| `think_summarize` | Summarize session with insights |

## Common Uses

- "What time is it in Tokyo?" → `time_current` (timezone: Asia/Tokyo)
- "Convert 100 miles to km" → `calc_unit_convert`
- "Generate a UUID" → `gen_uuid`
- "Calculate standard deviation of [1,2,3,4,5]" → `calc_statistics`
