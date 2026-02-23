---
name: api-conventions
description: API design patterns for this codebase. Use when designing endpoints, writing API code, or reviewing API contracts.
---

# API Conventions

When writing API endpoints, follow these patterns:

## Naming

- Collections: `/resources` (plural)
- Items: `/resources/{id}`
- Actions: `/resources/{id}/action-name`

## Response Format

### Success
```json
{
  "data": {},
  "meta": { "timestamp": "ISO8601" }
}
```

### Error
```json
{
  "error": "Human-readable message",
  "code": "ERROR_CODE",
  "details": {}
}
```

## Validation

Every endpoint must validate:
1. Required fields are present
2. Field types match schema
3. Values are within allowed ranges
