import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;

public class ApiServer {

    private static final int PORT = 8080;

    public static void main(String[] args) {

        try {

            HttpServer server = HttpServer.create(
                    new InetSocketAddress(PORT),
                    0);

            server.createContext(
                    "/api/nodes",
                    ApiServer::handleNodes);

            server.setExecutor(null);

            server.start();

            System.out.println(
                    "FluxGrid API Server started.");

            System.out.println(
                    "Server running at: http://localhost:"
                            + PORT);

            System.out.println(
                    "Nodes API: http://localhost:"
                            + PORT
                            + "/api/nodes");

        } catch (IOException e) {

            System.out.println(
                    "Failed to start API server.");

            e.printStackTrace();
        }
    }

    private static void handleNodes(
            HttpExchange exchange) throws IOException {

        addCorsHeaders(exchange);

        if (!exchange
                .getRequestMethod()
                .equalsIgnoreCase("GET")) {

            sendResponse(
                    exchange,
                    405,
                    "{\"error\":\"Method not allowed\"}");

            return;
        }

        GridNodeDAO nodeDAO = new GridNodeDAO();

        List<GridNode> nodes = nodeDAO.getAllNodes();

        String json = convertNodesToJson(nodes);

        sendResponse(
                exchange,
                200,
                json);
    }

    private static String convertNodesToJson(
            List<GridNode> nodes) {

        StringBuilder json = new StringBuilder();

        json.append("[");

        for (int i = 0; i < nodes.size(); i++) {

            GridNode node = nodes.get(i);

            json.append("{");

            json.append("\"nodeId\":\"")
                    .append(escapeJson(node.getNodeId()))
                    .append("\",");

            json.append("\"name\":\"")
                    .append(escapeJson(node.getName()))
                    .append("\",");

            json.append("\"type\":\"")
                    .append(escapeJson(node.getType()))
                    .append("\",");

            json.append("\"location\":\"")
                    .append(escapeJson(node.getLocation()))
                    .append("\",");

            json.append("\"availableEnergyKwh\":")
                    .append(node.getAvailableEnergyKwh())
                    .append(",");

            json.append("\"maxCapacityKwh\":")
                    .append(node.getMaxCapacityKwh())
                    .append(",");

            json.append("\"currentOutputKw\":")
                    .append(node.getCurrentOutputKw())
                    .append(",");

            json.append("\"balance\":")
                    .append(node.getBalance())
                    .append(",");

            json.append("\"priority\":")
                    .append(node.getPriority())
                    .append(",");

            json.append("\"status\":\"")
                    .append(escapeJson(node.getStatus()))
                    .append("\"");

            json.append("}");

            if (i < nodes.size() - 1) {

                json.append(",");
            }
        }

        json.append("]");

        return json.toString();
    }

    private static void sendResponse(
            HttpExchange exchange,
            int statusCode,
            String response) throws IOException {

        exchange
                .getResponseHeaders()
                .set(
                        "Content-Type",
                        "application/json; charset=UTF-8");

        byte[] bytes = response.getBytes(
                StandardCharsets.UTF_8);

        exchange.sendResponseHeaders(
                statusCode,
                bytes.length);

        try (
                OutputStream outputStream = exchange.getResponseBody()) {

            outputStream.write(bytes);
        }
    }

    private static void addCorsHeaders(
            HttpExchange exchange) {

        exchange
                .getResponseHeaders()
                .add(
                        "Access-Control-Allow-Origin",
                        "*");
    }

    private static String escapeJson(
            String value) {

        if (value == null) {
            return "";
        }

        return value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"");
    }
}