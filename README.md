# FluxGrid OS / AkulPowers

FluxGrid OS is a database-backed smart micro-grid simulation for a college Java project. Solar producers, consumers, batteries and EV stations register as nodes and exchange stored energy through real PostgreSQL transactions.

## Architecture

HTML/CSS/vanilla JavaScript -> Java HttpServer API -> Java services/DAOs -> JDBC -> PostgreSQL

No application framework or build tool is needed. The PostgreSQL JDBC driver is already in `lib/`, and the existing VS Code library configuration is preserved. Use JDK 17 or newer.

## Features and data sources

| Feature | Implementation |
| --- | --- |
| Node registry and filters | Real PostgreSQL nodes; browser filters the returned records |
| Grid stability | Java `GridStabilityService`, using only ONLINE nodes |
| Dynamic pricing | Java `PricingEngine` with live supply/demand and simple simulation factors |
| P2P trading | Java `TradingEngine`, JDBC row locks and atomic PostgreSQL updates |
| Audit trail | Real `audit_log` records, newest first; normal operational history |
| Node registration | Real database insert and audit event |
| Load shedding | Java service updates PostgreSQL statuses and audit events |
| Refresh | Fetches nodes, grid status, pricing and audit logs together |
| Interface | Existing dashboard, chart, themes, navigation, receipts and modal |

Only labelled historical chart points and daily summary cards use sample values. The chart's **Now** point comes from the Java API. No frontend simulation changes balances, energy or node records. Connection failures are shown explicitly; previous readings may remain visible as stale data.

## Database

The application uses the existing database configured in `backend/DBConnection.java`. Its connection settings have not been changed. Do not replace them with guessed credentials.

- `nodes`: identity, name, type, location, stored energy, capacity, live output/load, balance, priority, status and update time.
- `energy_trades`: seller, buyer, energy, unit price, total cost, status, failure reason and trade time.
- `audit_log`: event type, related trade/node, description, status and event time.

The existing schema requires positive capacity, nonnegative balances and stored energy, stored energy no greater than capacity, and priorities 1-4. Numeric energy/power values support two decimal places. Rejected trades are recorded in the audit trail; they do not create fictitious committed trades.

The `database/` directory currently has no bootstrap SQL. This checkout uses your already-created PostgreSQL database. A fresh computer needs that existing schema restored before running the application.

## Run locally (Windows PowerShell)

1. Start PostgreSQL using Windows Services or your normal PostgreSQL tools. On the tested machine the service is `postgresql-x64-18`. If it is stopped, an administrator PowerShell can run:

   ```powershell
   Start-Service postgresql-x64-18
   ```

   Keep the existing database and login configured in `DBConnection.java`. There is no schema reset or automatic seeding.

2. In the repository root, compile and check the connection:

   ```powershell
   javac -encoding UTF-8 -cp "lib/*" -d build backend/*.java
   java -cp "build;lib/*" TestConnection
   ```

3. Start the API in that terminal and leave it running:

   ```powershell
   java -cp "build;lib/*" ApiServer
   ```

   The server listens on `http://localhost:8080`. Stop it with Ctrl+C. If the port is already occupied, stop the previous API instance first.

4. Open `frontend/index.html` in Chrome/Edge, or use **Open with Live Server** in VS Code. No frontend build or package installation is needed. CORS allows either option. The sidebar should show **Connected**.

5. Register nodes in Node Registry. Supply positive capacity and initial stored energy for a seller. Consumers can use negative output/load. Select ONLINE seller/buyer nodes, choose an energy amount and execute a trade. The receipt shows the actual execution-time price. Use **Refresh** to reload data and **Run Load Shedding** to handle a deficit.

`Main.java` and the original test examples remain available. `Main`, `TestGridNodeDAO`, `TestTradingEngine` and `TestLoadShedding` perform actual database writes; they are console demonstrations rather than isolated tests.

## API

All responses use JSON with UTF-8. POST node/trade bodies use `application/x-www-form-urlencoded`. OPTIONS preflight is supported. Success is HTTP 200; invalid input 400; missing route/trade node 404; wrong method 405; database failure 500.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/nodes` | List nodes using the existing backend field names |
| POST | `/api/nodes` | Register a node and save its audit event |
| GET | `/api/grid-status` | `generation`, `consumption`, `netReserve`, `status` |
| GET | `/api/pricing` | `basePrice`, `supplyDemandFactor`, `peakFactor`, `weatherFactor`, `pricePerKwh` |
| POST | `/api/trade` | Execute a real trade and return its receipt/error |
| GET | `/api/audit-logs` | Audit entries, with trade details when available |
| POST | `/api/load-shedding` | Shed eligible loads and return affected IDs, reduced load and resulting status |

Trade fields: `sellerNodeId`, `buyerNodeId`, `energyKwh`.

Registration fields: `name`, `type`, `location`, `maxCapacityKwh`, `currentOutputKw`, `balance`, `priority`. Optional `availableEnergyKwh` defaults to zero; optional `nodeId` is generated if omitted. New nodes start ONLINE. Types are `SOLAR_PRODUCER`, `CONSUMER`, `BATTERY_STORAGE`, `EV_STATION`.

Example read request:

```powershell
Invoke-RestMethod http://localhost:8080/api/grid-status
```

## Java rules and ACID transaction

Grid status is STABLE when reserve exceeds 5 kW, WARNING from 0 through 5 kW, and DEFICIT below zero. THROTTLED and OFFLINE nodes are excluded from live power totals.

The existing pricing formula is base price INR 8.00 multiplied by supply/demand (clamped to 0.75-1.50), peak factor and weather factor. Peak hours use the server's local clock: 18:00 up to 22:00, multiplier 1.20; otherwise 1.00. Weather is a neutral simulated 1.00. Prices and total charges are rounded to two decimal places. The displayed estimate can differ from the execution-time receipt if inputs change.

A trade opens **one JDBC connection**, disables auto-commit, and locks both nodes with `SELECT ... FOR UPDATE` in node-ID order. Java validates status, energy, buyer funds and capacity. It then updates both nodes, inserts the trade and inserts the success audit on that same connection before `commit()`.

An exception before commit triggers `rollback()`, preventing partial energy/fund transfers. A failure audit uses a fresh connection after rollback. Row locks prevent simultaneous trades from overselling the same stored energy. `current_output_kw` is never changed by trading, so grid power can remain unchanged after a successful trade.

Load shedding locks its node snapshot, protects Priority 1, and sheds ONLINE consumers in priority order 4, 3, 2 until the deficit is covered or eligible loads run out. Status updates and audit events commit together. THROTTLED represents fully excluded demand. No deficit means no changes. Restoring shed nodes is currently a manual database/console operation.

## Verification

With ApiServer running, use a second terminal in the repository root:

```powershell
java -cp "build;lib/*" TestServiceRules
java -cp "build;lib/*" TestIntegration
```

`TestServiceRules` runs nine database-free boundary/JSON checks. `TestIntegration` uses unique temporary nodes, exercises the API and actual JDBC persistence, and removes its own nodes/trades/audits in a `finally` block. Run it while nobody else is changing the simulation: it compares all original node records before and after. Its live shedding scenario requires an initially positive reserve and uses a first-sorted Priority 4 test load, leaving original nodes unchanged.

Verified in this environment: compilation, 9 service checks, 59 integration checks, all API routes, CORS/preflight, successful/rejected trades, concurrent oversell prevention, registration, audit retrieval, stable/deficit states and load shedding. Twenty headless Chrome checks also verified live rendering, themes, filters, navigation, the modal, mobile width, disconnected state and refresh recovery without JavaScript exceptions, plus real form registration, a committed trade/receipt/audit and a rejected trade. Browser test fixtures were removed afterward.

## Project structure

```text
backend/
  ApiServer.java              HTTP routing, form validation and responses
  Json.java                   Small response JSON writer
  DBConnection.java           Existing PostgreSQL connection
  GridNode.java               Node model
  GridNodeDAO.java             Node persistence
  EnergyTrade.java             Existing trade model
  TradeResult.java             Receipt returned by the trading service
  TradingEngine.java           Atomic energy/fund transfers
  PricingEngine.java           Tariff calculation
  GridStabilityService.java    Power totals and status
  LoadSheddingService.java     Priority-based demand shedding
  AuditLogDAO.java             Audit insertion/retrieval
  Main.java, Test*.java        Console examples and checks
frontend/
  index.html, style.css, app.js
lib/
  postgresql-42.7.3.jar
database/                     Existing schema managed in PostgreSQL
build/                        Local compiled/test artifacts (ignored)
```

This is an educational smart micro-grid simulation. It models stored energy and power separately; it does not model real electrical dispatch or use real weather telemetry. A lost HTTP response can leave the client unsure whether a write completed: refresh and inspect the audit trail before retrying. Deliberate mid-commit database/network failure injection and physical-device testing were not performed.
