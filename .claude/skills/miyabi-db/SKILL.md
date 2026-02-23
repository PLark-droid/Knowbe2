---
name: miyabi-db
description: Database inspection and read-only querying for SQLite, PostgreSQL, and MySQL. Use to test connections, list tables, inspect schemas, explain queries, and run safe SELECTs.
allowed-tools:
  - mcp__miyabi-mcp-bundle__db_*
---

# Miyabi Database Tools

6 tools for database connectivity checks, inspection, and safe querying.

## Available Tools

| Tool | Description |
|------|-------------|
| `db_connect` | Test database connectivity for SQLite, PostgreSQL, or MySQL (connection string or host/port/database/user/password). |
| `db_tables` | List all tables with row counts for SQLite, PostgreSQL, or MySQL. |
| `db_schema` | Retrieve table schema (columns, types, keys, constraints) across supported databases. |
| `db_query` | Run read-only SELECT queries (defaults to 100 row limit for safety) on SQLite, PostgreSQL, or MySQL. |
| `db_explain` | Return the execution plan for a SQL query on SQLite, PostgreSQL, or MySQL. |
| `db_health` | Check database health: connectivity, size, and basic performance stats. |

## Supported Databases

| Database | Support | Connection options |
|----------|----------|-------------------|
| SQLite | Yes | `type: "sqlite"` with `connection` set to the database file path. |
| PostgreSQL | Yes | `type: "postgresql"` plus either a connection string or host/port/database/user/password. |
| MySQL | Yes | `type: "mysql"` plus either a connection string or host/port/database/user/password. |

## Workflow Patterns

### Database exploration
1. `db_connect` - verify access
2. `db_tables` - list all tables
3. `db_schema` - inspect table structure
4. `db_query` - query data

### Data investigation
1. `db_tables` - find relevant tables
2. `db_query` - run SELECT queries (adjust `limit` as needed)
3. `db_explain` - analyze execution plans for performance
4. `db_health` - check overall status if performance issues persist

## Common Uses

- "Test the database connection" -> `db_connect` (supply `type` and connection details)
- "Show all tables in the database" -> `db_tables`
- "Describe the schema of orders table" -> `db_schema` (table: "orders")
- "Run a read-only query" -> `db_query` (query: "SELECT * FROM users LIMIT 10")
- "Explain a slow query" -> `db_explain`
- "Check database health" -> `db_health`
