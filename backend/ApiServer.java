import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.math.BigDecimal;
import java.util.*;

public class ApiServer {
    private static final int PORT = 8080;

    public static void main(String[] args) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 0);
        server.createContext("/", ApiServer::handleRequest);
        server.setExecutor(null);
        server.start();
        System.out.println("FluxGrid API running at http://localhost:" + PORT);
    }

    
    private static void handleRequest(HttpExchange exchange) throws IOException {
        addCorsHeaders(exchange);
        String path = exchange.getRequestURI().getPath();
        String allowed = switch (path) {
            case "/api/nodes" -> "GET, POST, OPTIONS";
            case "/api/grid-status", "/api/pricing", "/api/audit-logs" -> "GET, OPTIONS";
            case "/api/trade", "/api/load-shedding" -> "POST, OPTIONS";
            default -> "";
        };
        try {
            if (allowed.isEmpty()) {
                sendResponse(exchange, 404, Map.of("error", "Endpoint not found."));
                return;
            }
            exchange.getResponseHeaders().set("Allow", allowed);
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }
            if (!Arrays.asList(allowed.split(", ")).contains(exchange.getRequestMethod())) {
                sendResponse(exchange, 405, Map.of("error", "Method not allowed."));
                return;
            }
            switch (path) {
                case "/api/nodes" -> handleNodes(exchange);
                case "/api/grid-status" -> handleGridStatus(exchange);
                case "/api/pricing" -> handlePricing(exchange);
                case "/api/trade" -> handleTrade(exchange);
                case "/api/audit-logs" -> sendResponse(exchange, 200, new AuditLogDAO().getAllLogs());
                case "/api/load-shedding" -> sendResponse(exchange, 200, new LoadSheddingService().performLoadShedding());
            }
        } catch (IllegalArgumentException e) {
            sendResponse(exchange, 400, Map.of("success", false, "error", e.getMessage()));
        } catch (RuntimeException e) {
            System.err.println("API failure: " + e.getClass().getSimpleName());
            sendResponse(exchange, 500, Map.of("success", false, "error", "Backend database operation failed. Check the Java server and PostgreSQL."));
        } finally {
            exchange.close();
        }
    }

    private static void handleNodes(HttpExchange exchange) throws IOException {
        if ("POST".equals(exchange.getRequestMethod())) {
            handleCreateNode(exchange);
            return;
        }
        List<Map<String, Object>> nodes = new ArrayList<>();
        for (GridNode n : new GridNodeDAO().getAllNodes()) {
            nodes.add(Map.of("nodeId", n.getNodeId(), "name", n.getName(), "type", n.getType(),
                    "location", n.getLocation(), "availableEnergyKwh", n.getAvailableEnergyKwh(),
                    "maxCapacityKwh", n.getMaxCapacityKwh(), "currentOutputKw", n.getCurrentOutputKw(),
                    "balance", n.getBalance(), "priority", n.getPriority(), "status", n.getStatus()));
        }
        sendResponse(exchange, 200, nodes);
    }

    private static void handleGridStatus(HttpExchange exchange) throws IOException {
        sendResponse(exchange, 200, new GridStabilityService().getSnapshot().toMap());
    }

    private static void handlePricing(HttpExchange exchange) throws IOException {
        GridStabilityService.GridStatus grid = new GridStabilityService().getSnapshot();
        sendResponse(exchange, 200, new PricingEngine().getPricing(grid.generation(), grid.consumption(),
                PricingEngine.isPeakHour(), PricingEngine.WEATHER_FACTOR));
    }

    private static void handleTrade(HttpExchange exchange) throws IOException {
        Map<String, String> form = parseFormBody(exchange);
        String seller = requiredText(form, "sellerNodeId", 30);
        String buyer = requiredText(form, "buyerNodeId", 30);
        double energy = number(form, "energyKwh", 0.01, 99999999.99);
        GridStabilityService.GridStatus grid = new GridStabilityService().getSnapshot();
        TradeResult result = new TradingEngine().executeTrade(seller, buyer, energy,
                grid.generation(), grid.consumption(), PricingEngine.isPeakHour(), PricingEngine.WEATHER_FACTOR);
        sendResponse(exchange, result.httpStatus(), result.toMap());
    }

    private static void handleCreateNode(HttpExchange exchange) throws IOException {
        Map<String, String> form = parseFormBody(exchange);
        String name = requiredText(form, "name", 100);
        String location = requiredText(form, "location", 100);
        String type = requiredText(form, "type", 30);
        if (!Set.of("SOLAR_PRODUCER", "CONSUMER", "BATTERY_STORAGE", "EV_STATION").contains(type))
            throw new IllegalArgumentException("Invalid node type.");
        String id = form.getOrDefault("nodeId", "").trim();
        if (id.isEmpty()) id = "NODE-" + UUID.randomUUID().toString().substring(0, 12).toUpperCase();
        if (!id.matches("[A-Za-z0-9_-]{1,30}")) throw new IllegalArgumentException("Invalid node ID.");
        double capacity = number(form, "maxCapacityKwh", 0.01, 99999999.99);
        form.putIfAbsent("availableEnergyKwh", "0");
        double energy = number(form, "availableEnergyKwh", 0, capacity);
        double output = number(form, "currentOutputKw", -99999999.99, 99999999.99);
        double balance = number(form, "balance", 0, 9999999999.99);
        double priority = number(form, "priority", 1, 4);
        if (priority != Math.floor(priority)) throw new IllegalArgumentException("Priority must be an integer from 1 to 4.");
        GridNode node = new GridNode(id, name, type, location, energy, capacity, output, balance, (int) priority, "ONLINE");
        new GridNodeDAO().addNode(node);
        sendResponse(exchange, 200, Map.of("success", true, "nodeId", id, "message", "Node registered successfully."));
    }

    private static Map<String, String> parseFormBody(HttpExchange exchange) throws IOException {
        String contentType = exchange.getRequestHeaders().getFirst("Content-Type");
        if (contentType == null || !contentType.split(";")[0].trim().equalsIgnoreCase("application/x-www-form-urlencoded"))
            throw new IllegalArgumentException("Send application/x-www-form-urlencoded data.");
        byte[] bytes = exchange.getRequestBody().readNBytes(16385);
        if (bytes.length > 16384) throw new IllegalArgumentException("Request body is too large.");
        Map<String, String> form = new HashMap<>();
        for (String pair : new String(bytes, StandardCharsets.UTF_8).split("&")) {
            if (pair.isEmpty()) continue;
            String[] parts = pair.split("=", 2);
            String key = URLDecoder.decode(parts[0], StandardCharsets.UTF_8);
            String value = parts.length == 2 ? URLDecoder.decode(parts[1], StandardCharsets.UTF_8) : "";
            if (form.putIfAbsent(key, value) != null) throw new IllegalArgumentException("Duplicate form field: " + key);
        }
        return form;
    }

    private static String requiredText(Map<String, String> form, String key, int maxLength) {
        String value = form.getOrDefault(key, "").trim();
        if (value.isEmpty() || value.length() > maxLength || value.indexOf('\0') >= 0)
            throw new IllegalArgumentException(key + " is required and must be at most " + maxLength + " characters.");
        return value;
    }

    private static double number(Map<String, String> form, String key, double min, double max) {
        String value = requiredText(form, key, 40);
        try {
            BigDecimal decimal = new BigDecimal(value);
            double n = decimal.doubleValue();
            if (!Double.isFinite(n) || n < min || n > max || decimal.stripTrailingZeros().scale() > 2)
                throw new NumberFormatException();
            return n;
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(key + " must be between " + min + " and " + max + " with at most two decimals.");
        }
    }

    private static void addCorsHeaders(HttpExchange exchange) {
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");
    }

    private static void sendResponse(HttpExchange exchange, int status, Object response) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        exchange.getResponseHeaders().set("Cache-Control", "no-store");
        byte[] bytes = Json.stringify(response).getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(status, bytes.length);
        try (var out = exchange.getResponseBody()) { out.write(bytes); }
    }
}
