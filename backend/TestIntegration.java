import java.net.URI;
import java.net.URLEncoder;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.sql.*;
import java.util.*;
import java.util.concurrent.*;

/** Runs against ApiServer and the configured PostgreSQL. Creates and removes only its own fixtures. */
public class TestIntegration {
    private static final HttpClient HTTP = HttpClient.newHttpClient();
    private static final String PREFIX = "000-TST-" + UUID.randomUUID().toString().substring(0, 6);
    private static final GridNodeDAO DAO = new GridNodeDAO();
    private static int checks;

    public static void main(String[] args) throws Exception {
        List<String> original = snapshot();
        try {
            for (String path : List.of("/nodes", "/grid-status", "/pricing", "/audit-logs")) {
                HttpResponse<String> response = request("GET", path, null);
                check(response.statusCode() == 200, path + " GET");
                check(response.headers().firstValue("Access-Control-Allow-Origin").orElse("").equals("*"), "CORS " + path);
                check(response.headers().firstValue("Content-Type").orElse("").contains("application/json"), "JSON " + path);
            }
            check(request("OPTIONS", "/trade", null).statusCode() == 204, "Preflight");
            check(request("PUT", "/nodes", null).statusCode() == 405, "Wrong method");
            check(request("GET", "/nodes/missing", null).statusCode() == 404, "Exact route");
            for (String path : List.of("/nodes", "/grid-status", "/pricing", "/audit-logs", "/trade", "/load-shedding")) {
                check(request("OPTIONS", path, null).statusCode() == 204, "Preflight " + path);
                check(request("DELETE", path, null).statusCode() == 405, "Wrong method " + path);
            }
            for (String amount : List.of("abc", "-1", "0.001"))
                check(request("POST", "/trade", "sellerNodeId=x&buyerNodeId=y&energyKwh=" + amount).statusCode() == 400, "Invalid energy " + amount);
            check(request("POST", "/trade", "buyerNodeId=y&energyKwh=1").statusCode() == 400, "Missing seller");
            String validForm = "name=Validation&location=Test&type=CONSUMER&maxCapacityKwh=10&availableEnergyKwh=0&currentOutputKw=-1&balance=10&priority=3";
            for (String[] invalid : List.of(new String[]{"name=Validation", "name="}, new String[]{"location=Test", "location="},
                    new String[]{"type=CONSUMER", "type=INVALID"}, new String[]{"maxCapacityKwh=10", "maxCapacityKwh=0"},
                    new String[]{"availableEnergyKwh=0", "availableEnergyKwh=11"}, new String[]{"currentOutputKw=-1", "currentOutputKw=NaN"},
                    new String[]{"balance=10", "balance=-1"}, new String[]{"priority=3", "priority=2.5"}, new String[]{"priority=3", "priority=5"}))
                check(request("POST", "/nodes", validForm.replace(invalid[0], invalid[1])).statusCode() == 400, "Node validation " + invalid[1]);
            check(request("POST", "/trade", "sellerNodeId=x").statusCode() == 400, "Missing form fields");
            check(request("POST", "/trade", "sellerNodeId=x&buyerNodeId=y&energyKwh=NaN").statusCode() == 400, "Nonfinite amount");
            check(request("POST", "/trade", "sellerNodeId=x&buyerNodeId=y&energyKwh=0.001").statusCode() == 400, "Sub-cent energy rejected");
            GridStabilityService.GridStatus grid = new GridStabilityService().getSnapshot();
            if (grid.netReserve() >= 0) {
                check(request("POST", "/load-shedding", "").body().contains("No deficit"), "No deficit shedding");
                check(snapshot().equals(original), "No deficit leaves existing records unchanged");
            }
            create("S", 100, 200, 0, 1000, 2);
            create("B", 0, 200, 0, 10000, 3);
            create("C", 0, 200, 0, 10000, 3);
            create("POOR", 0, 200, 0, 0, 3);
            create("FULL", 1, 1, 0, 10000, 3);
            create("OFF", 0, 200, 0, 10000, 3);
            setStatus("OFF", "OFFLINE");
            String beforeGrid = request("GET", "/grid-status", null).body();
            HttpResponse<String> success = trade("S", "B", "10");
            check(success.statusCode() == 200 && success.body().contains("\"success\":true"), "Successful API trade");
            GridNode seller = DAO.getNodeById(id("S")), buyer = DAO.getNodeById(id("B"));
            check(seller.getAvailableEnergyKwh() == 90 && buyer.getAvailableEnergyKwh() == 10, "Committed energy persisted");
            check(seller.getBalance() > 1000 && buyer.getBalance() < 10000
                    && seller.getBalance() + buyer.getBalance() == 11000, "Committed funds conserved");
            try (Connection c = DBConnection.getConnection(); PreparedStatement s = c.prepareStatement(
                    "SELECT * FROM energy_trades WHERE seller_node_id=? AND buyer_node_id=?")) {
                s.setString(1, id("S")); s.setString(2, id("B"));
                try (ResultSet r = s.executeQuery()) {
                    check(r.next(), "Trade row persisted");
                    double cost = r.getDouble("total_cost"), price = r.getDouble("price_per_kwh");
                    check(seller.getBalance() == 1000 + cost && buyer.getBalance() == 10000 - cost, "Exact balance changes match stored cost");
                    check(r.getDouble("energy_kwh") == 10 && r.getString("status").equals("COMMITTED"), "Exact committed energy and status");
                    check(success.body().contains("\"tradeId\":\"" + r.getString("trade_id") + "\"")
                            && success.body().contains("\"pricePerKwh\":" + price)
                            && success.body().contains("\"totalCost\":" + cost), "Receipt matches stored ID, execution price and cost");
                    check(count("SELECT count(*) FROM audit_log WHERE status='COMMITTED' AND related_trade_id=?", r.getString("trade_id")) == 1, "Exactly one committed audit");
                    check(!r.next(), "Exactly one trade row");
                }
            }
            check(beforeGrid.equals(request("GET", "/grid-status", null).body()), "Trade leaves instantaneous power unchanged");
            reject("S", "S", "1", "same node");
            reject("S", "B", "1000", "enough energy");
            reject("S", "POOR", "1", "enough balance");
            reject("S", "OFF", "1", "not online");
            reject("S", "FULL", "1", "capacity");
            setStatus("S", "OFFLINE");
            reject("S", "B", "1", "not online");
            setStatus("S", "THROTTLED");
            reject("S", "B", "1", "not online");
            setStatus("S", "ONLINE");
            setStatus("B", "THROTTLED");
            reject("S", "B", "1", "not online");
            setStatus("B", "ONLINE");
            check(trade("S", "MISSING", "1").statusCode() == 404, "Missing buyer");
            String audits = request("GET", "/audit-logs", null).body();
            check(audits.contains(id("S")) && audits.contains("COMMITTED") && audits.contains("ROLLED_BACK"), "Real success and failure audits");
            // Competing trades run directly in separate threads to exercise JDBC row locks.
            ExecutorService pool = Executors.newFixedThreadPool(2);
            try {
                Callable<TradeResult> first = () -> new TradingEngine().executeTrade(id("S"), id("B"), 60, 100, 100, false, 1);
                Callable<TradeResult> second = () -> new TradingEngine().executeTrade(id("S"), id("C"), 60, 100, 100, false, 1);
                var results = pool.invokeAll(List.of(first, second));
                int committed = 0;
                for (var future : results) if (future.get().success()) committed++;
                check(committed == 1 && DAO.getNodeById(id("S")).getAvailableEnergyKwh() == 30, "Concurrent trades cannot oversell");
            } finally { pool.shutdownNow(); }
            // A first-sorted P4 fixture can cover this deficit without touching existing consumers.
            if (grid.netReserve() > 2 && grid.netReserve() < 1000000) {
                create("P1", 0, 100, -1, 0, 1);
                create("P4", 0, 100, -(grid.netReserve() + 100), 0, 4);
                check(request("GET", "/grid-status", null).body().contains("DEFICIT"), "Deficit detected");
                check(request("POST", "/load-shedding", "").statusCode() == 200, "Shedding API");
                check(DAO.getNodeById(id("P4")).getStatus().equals("THROTTLED"), "P4 shed in PostgreSQL");
                check(DAO.getNodeById(id("P1")).getStatus().equals("ONLINE"), "P1 protected");
                check(new GridStabilityService().getSnapshot().netReserve() >= 0, "Throttled demand excluded");
                // Run deeper shedding cases only when no original consumer can be changed.
                boolean originalLoadsProtected = DAO.getAllNodes().stream().noneMatch(n ->
                        !n.getNodeId().startsWith(PREFIX) && n.getStatus().equals("ONLINE")
                        && n.getCurrentOutputKw() < 0 && n.getPriority() > 1);
                if (originalLoadsProtected) {
                    create("BALANCE", 0, 100, -(grid.netReserve() - 1), 0, 1);
                    create("GEN", 0, 100, 1, 0, 4);
                    create("QA", 0, 100, -0.1, 0, 4);
                    create("QB", 0, 100, -0.7, 0, 4);
                    create("QC", 0, 100, -1, 0, 4);
                    check(request("POST", "/load-shedding", "").statusCode() == 200, "Decimal shedding API");
                    check(DAO.getNodeById(id("QA")).getStatus().equals("THROTTLED")
                            && DAO.getNodeById(id("QB")).getStatus().equals("THROTTLED")
                            && DAO.getNodeById(id("QC")).getStatus().equals("ONLINE"), "Exactly covered decimal deficit does not shed extra node");
                    create("P3", 0, 100, -2, 0, 3);
                    create("P2", 0, 100, -3, 0, 2);
                    HttpResponse<String> shedding = request("POST", "/load-shedding", "");
                    check(shedding.statusCode() == 200 && shedding.body().contains(
                            "[\"" + id("QC") + "\",\"" + id("P3") + "\",\"" + id("P2") + "\"]"), "Shedding follows P4 then P3 then P2");
                    for (String suffix : List.of("QC", "P3", "P2")) {
                        check(DAO.getNodeById(id(suffix)).getStatus().equals("THROTTLED"), "Persisted shedding " + suffix);
                        check(count("SELECT count(*) FROM audit_log WHERE event_type='LOAD_SHEDDING' AND related_node_id=?", id(suffix)) == 1, "Persisted shedding audit " + suffix);
                    }
                    check(DAO.getNodeById(id("BALANCE")).getStatus().equals("ONLINE")
                            && DAO.getNodeById(id("GEN")).getStatus().equals("ONLINE"), "Priority 1 and generation protected");
                } else System.out.println("SKIP: extended shedding would risk original consumers.");
            }
            create("DEC", 0.1, 0.3, 0, 1000, 3);
            check(trade("S", "DEC", "0.2").statusCode() == 200, "Exact decimal capacity must be accepted");
        } finally {
            cleanup();
        }
        check(snapshot().equals(original), "Fixture cleanup preserves all original node records");
        System.out.println("PASS: " + checks + " integration checks; test fixtures removed.");
    }

    private static String id(String suffix) { return PREFIX + "-" + suffix; }
    private static void create(String suffix, double energy, double capacity, double output, double balance, int priority) throws Exception {
        String body = "nodeId=" + id(suffix) + "&name=" + URLEncoder.encode("Test <node> \"" + suffix + "\"", StandardCharsets.UTF_8)
                + "&type=BATTERY_STORAGE&location=Integration&availableEnergyKwh=" + energy + "&maxCapacityKwh=" + capacity
                + "&currentOutputKw=" + output + "&balance=" + balance + "&priority=" + priority;
        HttpResponse<String> response = request("POST", "/nodes", body);
        check(response.statusCode() == 200, "Register " + suffix + ": " + response.body());
        check(DAO.getNodeById(id(suffix)) != null, "Node persisted " + suffix);
    }
    private static HttpResponse<String> trade(String seller, String buyer, String energy) throws Exception {
        return request("POST", "/trade", "sellerNodeId=" + id(seller) + "&buyerNodeId=" + id(buyer) + "&energyKwh=" + energy);
    }
    private static void reject(String seller, String buyer, String energy, String reason) throws Exception {
        List<String> before = snapshot();
        long trades = count("SELECT count(*) FROM energy_trades WHERE seller_node_id LIKE ?", PREFIX + "%");
        long failures = count("SELECT count(*) FROM audit_log WHERE status='ROLLED_BACK' AND description LIKE ?", "%" + PREFIX + "%");
        HttpResponse<String> response = trade(seller, buyer, energy);
        check(response.statusCode() == 400 && response.body().contains(reason), "Rejected trade: " + reason);
        check(snapshot().equals(before), "Rejected trade makes no partial node changes");
        check(count("SELECT count(*) FROM energy_trades WHERE seller_node_id LIKE ?", PREFIX + "%") == trades, "Rejected trade inserts no trade row");
        check(count("SELECT count(*) FROM audit_log WHERE status='ROLLED_BACK' AND description LIKE ?", "%" + PREFIX + "%") == failures + 1, "Each rejection persists a separate failure audit");
    }
    private static long count(String sql, String pattern) throws Exception {
        try (Connection c = DBConnection.getConnection(); PreparedStatement s = c.prepareStatement(sql)) {
            s.setString(1, pattern);
            try (ResultSet r = s.executeQuery()) { r.next(); return r.getLong(1); }
        }
    }
    private static HttpResponse<String> request(String method, String path, String body) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create("http://localhost:8080/api" + path));
        if (body != null) builder.header("Content-Type", "application/x-www-form-urlencoded");
        return HTTP.send(builder.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
    }
    private static void setStatus(String suffix, String status) throws Exception {
        try (Connection c = DBConnection.getConnection(); PreparedStatement s = c.prepareStatement("UPDATE nodes SET status=? WHERE node_id=?")) {
            s.setString(1, status); s.setString(2, id(suffix)); s.executeUpdate();
        }
    }
    private static List<String> snapshot() throws Exception {
        List<String> rows = new ArrayList<>();
        try (Connection c = DBConnection.getConnection(); PreparedStatement s = c.prepareStatement("SELECT row_to_json(n)::text FROM nodes n ORDER BY node_id"); ResultSet r = s.executeQuery()) {
            while (r.next()) rows.add(r.getString(1));
        }
        return rows;
    }
    private static void cleanup() throws Exception {
        try (Connection c = DBConnection.getConnection()) {
            c.setAutoCommit(false);
            for (String sql : List.of(
                    "DELETE FROM audit_log WHERE related_node_id LIKE ? OR description LIKE ?",
                    "DELETE FROM energy_trades WHERE seller_node_id LIKE ? OR buyer_node_id LIKE ?",
                    "DELETE FROM nodes WHERE node_id LIKE ? OR node_id LIKE ?")) {
                try (PreparedStatement s = c.prepareStatement(sql)) {
                    s.setString(1, PREFIX + "%"); s.setString(2, "%" + PREFIX + "%"); s.executeUpdate();
                }
            }
            c.commit();
        }
    }
    private static void check(boolean value, String label) {
        if (!value) throw new AssertionError(label);
        checks++;
    }
}
