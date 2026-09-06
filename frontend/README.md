# FluxGrid OS — Smart Micro-Grid Energy & P2P Trading Engine

FluxGrid OS by Akul Powers monitors renewable energy generation and consumption, registered grid nodes, dynamic energy pricing, P2P energy trades, and audit records.

The four main modules are **Control Room**, **Node Registry**, **P2P Energy Trading**, and **Audit Logs**. They include pricing breakdowns, grid stability and load-shedding displays, node priorities and filters, and backend-provided trade results. Power uses kW, energy uses kWh, and financial values use ₹.

The frontend uses React, TypeScript, Vite, Tailwind CSS, React Query, Wouter, and Radix UI. Shared API hooks and schemas are generated from OpenAPI with Orval. pnpm manages the workspace. The existing directory layout is retained to preserve imports and builds: application code is in `artifacts/microgrid-trading-engine/src`, assets in its `public` directory, and the API client in `lib/api-client-react`.

The final production architecture is **React → Java backend → JDBC → PostgreSQL**. The TypeScript demo service is for read-only frontend development; it does not execute production transactions.

## Install and run locally

Use Node.js 22.12+ and pnpm 10. From the repository root:

```powershell
cd frontend
pnpm install --frozen-lockfile
pnpm --filter @workspace/microgrid-trading-engine dev
```

Open `http://localhost:5173`. The development server forwards `/api` to `http://localhost:8080`. Set `JAVA_API_ORIGIN` in the shell to change that target. For a separately hosted API, set `VITE_API_BASE_URL` at build time to its origin (an optional trailing `/api` is supported). The Java service must allow the frontend origin via CORS when using a separate origin. In production, route `/api` to Java through your web server or use that build-time URL.

```powershell
pnpm --filter @workspace/microgrid-trading-engine typecheck
pnpm --filter @workspace/microgrid-trading-engine build
```

Run `pnpm --filter @workspace/api-spec codegen` after changing `lib/api-spec/openapi.yaml`. It generates the shared React Query client and response schemas. Run `pnpm typecheck` for the workspace.

After building the frontend and demo service, run `node scripts/demo-smoke.mjs` and `node scripts/browser-smoke.mjs` to check read-only enforcement and browser interactions. The browser test uses isolated canned HTTP responses, requires Node 22+ and Chrome, and accepts `CHROME_PATH` for another Chromium executable. Neither test uses a production service.

## Read-only UI demo

The existing Express package is a **read-only fixture service**, not the production backend. From `frontend`, in one terminal:

```powershell
pnpm --filter @workspace/api-server build
$env:PORT = '8081'
pnpm --filter @workspace/api-server start
```

In another terminal:

```powershell
$env:JAVA_API_ORIGIN = 'http://localhost:8081'
pnpm --filter @workspace/microgrid-trading-engine dev
```

Fixtures live only in `artifacts/api-server/src/data/demo-grid.ts`. The health endpoint identifies this service with `{ "status": "demo" }`; the UI displays a demo banner and disables writes. POST requests also return HTTP 503, without changing nodes or audit records. Fixtures never replace a failed Java request. Stop the demo and use the Java target to enable actual registration and trading.

## Backend contract

`lib/api-spec/openapi.yaml` defines the request and response shapes:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/healthz` | `{ "status": "ok" }` for the connected Java service |
| `GET /api/grid/summary` | Power metrics, reserve, status, daily energy, pricing factors and explanation, history |
| `GET /api/nodes` | Nodes, available energy, maximum capacity, signed power, INR balance, priority, status |
| `POST /api/nodes` | Register using name, type, location, maximum energy capacity (`capacity`, kWh), and priority |
| `POST /api/trades` | Submit only sellerNodeId, buyerNodeId, energyAmount (kWh) |
| `GET /api/audit-logs` | Recorded backend events with optional trade fields |

Java owns validation, pricing, energy/account updates, grid calculations, load-shedding decisions, IDs, and timestamps. Java uses JDBC `connection.setAutoCommit(false)`, `connection.commit()`, and `connection.rollback()` with PostgreSQL. PostgreSQL stores nodes, meter readings, energy trades, balances, grid metrics, and audit logs. No JavaScript business logic performs these operations.

Power fields and chart series are kW. Available/maximum/traded/daily energy are kWh. All financial fields are INR. `currentOutputKw` is positive for generation and negative for consumption. `netReserveKw` is the backend's total generation minus consumption. The UI only multiplies requested energy by the displayed price for a non-authoritative estimate.

A successful trade returns HTTP 201 with a `TradeResult`, including `id` (for example `TX-1001`), `status: "COMMITTED"`, seller/buyer IDs, energy amount, authoritative `pricePerKwh`, `totalCost`, `settledAt` (ISO timestamp), and `message`. Committed results must include price and total. Rejected trades may omit those amounts when no price was established.

A recorded rollback/error returns HTTP 400, 409, or 500 with `{ "error": "real reason", "code": "...", "trade": { ...TradeResult, "status": "ROLLED_BACK" } }`. Use `FAILED` where appropriate. The UI also supports a recorded non-committed `TradeResult` in a successful HTTP response. Only a backend-provided result can establish transaction status. A transport error or an error without `trade` displays an unconfirmed outcome; it does not claim rollback. Check audit logs before resubmitting an uncertain request. Mutation requests are not automatically retried, and the UI refreshes server data after every trade outcome.

Node statuses are `ONLINE`, `OFFLINE`, `THROTTLED`; types are `SOLAR_PRODUCER`, `CONSUMER`, `EV_STATION`, `BATTERY_STORAGE`. Priority 1 is essential, 2 high, 3 residential, 4 non-essential. Sorting and protected labels are presentation only; Java decides which nodes are throttled. Grid statuses are `STABLE`, `WARNING`, `LOAD SHEDDING ACTIVE`.
