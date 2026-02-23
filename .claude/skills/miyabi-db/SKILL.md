---
name: miyabi-db
description: Database operations via CLI. Use when querying SQLite, PostgreSQL, or MySQL databases, listing tables, describing schemas, exporting data, or running SQL commands.
allowed-tools:
  - mcp__miyabi-mcp-bundle__db_*
---

# Miyabi Database Tools

6 tools for database operations via CLI wrappers.

## Available Tools

| Tool | Description |
|------|-------------|
| `db_sqlite_query` | Execute SQL query on SQLite database |
| `db_sqlite_tables` | List all tables in SQLite database |
| `db_sqlite_schema` | Show table schema (CREATE statement) |
| `db_pg_query` | Execute SQL query on PostgreSQL |
| `db_pg_tables` | List PostgreSQL tables |
| `db_mysql_query` | Execute SQL query on MySQL |

## Supported Databases

| Database | CLI Tool | Connection |
|----------|----------|------------|
| SQLite | `sqlite3` | File path |
| PostgreSQL | `psql` | Connection string |
| MySQL | `mysql` | Host/user/password |

## Workflow Patterns

### Database exploration
1. `db_sqlite_tables` — list all tables
2. `db_sqlite_schema` — inspect table structure
3. `db_sqlite_query` — query data

### Data investigation
1. `db_pg_tables` — find relevant tables
2. `db_pg_query` — run SELECT queries
3. Export results for analysis

## Common Uses

- "Show all tables in the SQLite DB" → `db_sqlite_tables`
- "Query users table" → `db_sqlite_query` (query: "SELECT * FROM users LIMIT 10")
- "Describe the schema of orders table" → `db_sqlite_schema`
- "Run a PostgreSQL query" → `db_pg_query`
