# Smart Micro-Grid frontend

The Northstar frontend displays grid metrics, registered nodes, P2P energy trades, and audit logs. See [README.md](README.md) for current setup and the Java API contract.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Production data and writes are owned by the Java/JDBC/PostgreSQL service. The bundled Express service serves read-only UI fixtures and needs no database connection.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Production API: Java + JDBC + PostgreSQL
- UI demo only: Express 5, no transaction execution
- Contract validation: generated Zod 3 schemas
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
