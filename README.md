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
| Interface | Dashboard, themes, navigation, transaction receipts and node registration modal |

Dashboard readings come from the Java API. Connection failures are shown explicitly; previous readings may remain visible as stale data.

## Database

The application connects through `backend/DBConnection.java` using environment variables. `DB_URL` defaults to `jdbc:postgresql://localhost:5432/AkulPower`, and `DB_USER` defaults to `postgres`. `DB_PASSWORD` is required: a missing or blank value produces a clear configuration error before a connection is opened. No password is stored in source code.

- `nodes`: identity, name, type, location, stored energy, capacity, live output/load, balance, priority, status and update time.
- `energy_trades`: seller, buyer, energy, unit price, total cost, status, failure reason and trade time.
- `audit_log`: event type, related trade/node, description, status and event time.

The existing schema requires positive capacity, nonnegative balances and stored energy, stored energy no greater than capacity, and priorities 1-4. Numeric energy/power values support two decimal places. Rejected trades are recorded in the audit trail; they do not create fictitious committed trades.

The repository does not include bootstrap SQL. This checkout uses your already-created PostgreSQL database. A fresh computer needs that existing schema restored before running the application.

## Run locally (Windows PowerShell)

1. Start PostgreSQL using Windows Services or your normal PostgreSQL tools. On the tested machine the service is `postgresql-x64-18`. If it is stopped, an administrator PowerShell can run:

   ```powershell
   Start-Service postgresql-x64-18
   ```

   Use your existing database and login. There is no schema reset or automatic seeding.

2. In the repository root, configure the database for this PowerShell session, then compile and run the read-only console demo:

   ```powershell
   $env:DB_PASSWORD="your_password" # Replace with your PostgreSQL password
   # Optional: these are the defaults
   $env:DB_USER="postgres"
   $env:DB_URL="jdbc:postgresql://localhost:5432/AkulPower"
   javac -encoding UTF-8 -cp "lib/*" -d build backend/*.java
   java -cp "build;lib/*" Main
   ```

3. Start the API in that terminal and leave it running:

   ```powershell
   java -cp "build;lib/*" ApiServer
   ```

   The server listens on `http://localhost:8080`. Stop it with Ctrl+C. If the port is already occupied, stop the previous API instance first.

4. Open `frontend/index.html` in Chrome/Edge, or use **Open with Live Server** in VS Code. No frontend build or package installation is needed. CORS allows either option. The sidebar should show **Connected**.

5. Register nodes in Node Registry. Supply positive capacity and initial stored energy for a seller. Consumers can use negative output/load. Select ONLINE seller/buyer nodes, choose an energy amount and execute a trade. The receipt shows the actual execution-time price. Use **Refresh** to reload data and **Run Load Shedding** to handle a deficit.

`Main.java` is a read-only console demo: it prints generation, consumption, net reserve, grid classification, dynamic price and pricing factors using the existing services. It does not change database records. Environment variables apply to the current terminal and its child processes; configure them again in a new terminal before running Java. Do not put your password in source files or commit a credentials file.

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

The existing pricing formula is base price INR 8.00 multiplied by supply/demand (clamped to 0.75-1.50), peak factor and weather factor. Peak hours use the server's local clock: 18:00 up to 22:00, multiplier 1.20; otherwise 1.00. The weather factor is intentionally simulated as a neutral factor of 1.0. Prices and total charges are rounded to two decimal places. The displayed estimate can differ from the execution-time receipt if inputs change.

A trade opens **one JDBC connection**, disables auto-commit, and locks both nodes with `SELECT ... FOR UPDATE` in node-ID order. Java validates status, energy, buyer funds and capacity. It then updates both nodes, inserts the trade and inserts the success audit on that same connection before `commit()`.

An exception before commit triggers `rollback()`, preventing partial energy/fund transfers. A failure audit uses a fresh connection after rollback. Row locks prevent simultaneous trades from overselling the same stored energy. `current_output_kw` is never changed by trading, so grid power can remain unchanged after a successful trade.

Load shedding locks its node snapshot, protects Priority 1, and sheds ONLINE consumers in priority order 4, 3, 2 until the deficit is covered or eligible loads run out. Status updates and audit events commit together. THROTTLED nodes are treated as fully excluded demand in this simplified model. No deficit means no changes. Restoring shed nodes currently requires a manual database update.

## Verification

No automated test source files are currently included. Compile and run `Main` using the setup commands above to check the connection and read current grid/pricing values without changing database records.

With ApiServer running, use a second PowerShell terminal for read-only API checks:

```powershell
Invoke-RestMethod http://localhost:8080/api/nodes
Invoke-RestMethod http://localhost:8080/api/grid-status
Invoke-RestMethod http://localhost:8080/api/pricing
Invoke-RestMethod http://localhost:8080/api/audit-logs
```

Open the frontend and check connection status, refresh, node filters, navigation and existing transaction receipts. Node registration, trade submission and load shedding change the database; they are not part of these read-only checks.

To verify the required password guard, open a separate PowerShell terminal in the repository root and run:

```powershell
Remove-Item Env:DB_PASSWORD -ErrorAction SilentlyContinue
java -cp "build;lib/*" Main
```

The exception includes `DB_PASSWORD must be configured` before any database connection is attempted. Keep the configured API terminal open, or set `DB_PASSWORD` again before normal use.

## Project structure

```text
backend/
  ApiServer.java              HTTP routing, form validation and responses
  Json.java                   Small response JSON writer
  DBConnection.java           Environment-configured PostgreSQL connection
  GridNode.java               Node model
  GridNodeDAO.java             Node persistence
  EnergyTrade.java             Existing trade model
  TradeResult.java             Receipt returned by the trading service
  TradingEngine.java           Atomic energy/fund transfers
  PricingEngine.java           Tariff calculation
  GridStabilityService.java    Power totals and status
  LoadSheddingService.java     Priority-based demand shedding
  AuditLogDAO.java             Audit insertion/retrieval
  Main.java                   Read-only grid and pricing console demo
frontend/
  index.html
  style.css
  app.js
lib/
  postgresql-42.7.3.jar
```

This is an educational smart micro-grid simulation. It models stored energy and power separately; it does not model real electrical dispatch or use real weather telemetry. A lost HTTP response can leave the client unsure whether a write completed: refresh and inspect the audit trail before retrying. Deliberate mid-commit database/network failure injection and physical-device testing were not performed.
