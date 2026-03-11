# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Dameng (达梦) database MCP (Model Context Protocol) server that provides secure database query capabilities to LLM clients. It uses the stdio transport protocol for communication.

## Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript to dist/
npm start            # Run server (tsx src/index.ts)
npm run dev          # Run with watch mode
npm run install-driver  # Install Dameng database driver
```

## Architecture

### Entry Point
- `src/index.ts` - MCP server initialization, tool registration (`query_database`), and lifecycle management

### Database Layer
- `src/database/dameng-adapter.ts` - Contains:
  - `DatabaseAdapter` interface with `connect()`, `disconnect()`, `query()` methods
  - `MockDamengAdapter` - Development/testing mock implementation
  - `RealDamengAdapter` - Production implementation using `dmdb` driver

### Adapter Selection
The adapter is selected via `USE_REAL_DB` environment variable:
- `USE_REAL_DB=false` (default) → MockDamengAdapter
- `USE_REAL_DB=true` → RealDamengAdapter

### Security Model
- By default, only SELECT queries are allowed
- INSERT/UPDATE/DELETE/DDL operations require `allowAdvancedOperations: true` parameter
- SQL validation happens in both adapter implementations before execution

## Configuration

Database connection configured via `.env` file:
```
DM_HOST=localhost
DM_PORT=5236
DM_USER=SYSDBA
DM_PASS=SYSDBA
DM_DB=SYSTEM
USE_REAL_DB=false
```

## Testing Utilities

Several standalone test scripts exist:
- `test-mcp-plugin.ts` - Tests MCP SDK loading and MockDamengAdapter
- `query-tables.ts` - Tests real database connection with table queries
- `connection-test.ts` - Connection verification script

Run with: `npx tsx <script-name>.ts`