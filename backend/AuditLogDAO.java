import java.sql.*;
import java.util.*;

public class AuditLogDAO {
    public boolean logEvent(String eventType, String tradeId, String nodeId, String description, String status) {
        // Failure events use a fresh connection AFTER the business transaction rolls back.
        try (Connection connection = DBConnection.getConnection()) {
            logEvent(connection, eventType, tradeId, nodeId, description, status);
            return true;
        } catch (SQLException e) {
            System.err.println("Audit event could not be saved: " + e.getSQLState());
            return false;
        }
    }

    public void logEvent(Connection connection, String eventType, String tradeId,
            String nodeId, String description, String status) throws SQLException {
        String sql = "INSERT INTO audit_log (log_id, event_type, related_trade_id, related_node_id, description, status) VALUES (?, ?, ?, ?, ?, ?)";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, "LOG-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
            statement.setString(2, eventType);
            statement.setString(3, tradeId);
            statement.setString(4, nodeId);
            statement.setString(5, description);
            statement.setString(6, status);
            statement.executeUpdate();
        }
    }

    public List<Map<String, Object>> getAllLogs() {
        String sql = """
                SELECT a.*, t.seller_node_id, t.buyer_node_id, t.energy_kwh, t.price_per_kwh, t.total_cost
                FROM audit_log a LEFT JOIN energy_trades t ON a.related_trade_id = t.trade_id
                ORDER BY a.log_time DESC, a.log_id DESC
                """;
        List<Map<String, Object>> logs = new ArrayList<>();
        try (Connection connection = DBConnection.getConnection();
                PreparedStatement statement = connection.prepareStatement(sql);
                ResultSet rs = statement.executeQuery()) {
            while (rs.next()) {
                Map<String, Object> log = new LinkedHashMap<>();
                log.put("id", rs.getString("log_id"));
                log.put("timestamp", rs.getString("log_time"));
                log.put("event", rs.getString("event_type"));
                log.put("relatedTradeId", rs.getString("related_trade_id"));
                log.put("relatedNodeId", rs.getString("related_node_id"));
                log.put("seller", rs.getString("seller_node_id"));
                log.put("buyer", rs.getString("buyer_node_id"));
                log.put("energyKwh", rs.getObject("energy_kwh"));
                log.put("pricePerKwh", rs.getObject("price_per_kwh"));
                log.put("totalCost", rs.getObject("total_cost"));
                log.put("status", rs.getString("status"));
                log.put("details", rs.getString("description"));
                logs.add(log);
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Could not load audit logs.", e);
        }
        return logs;
    }
}
