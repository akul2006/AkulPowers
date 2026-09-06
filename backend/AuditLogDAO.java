import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.UUID;

public class AuditLogDAO {

    public boolean logEvent(
            String eventType,
            String relatedTradeId,
            String relatedNodeId,
            String description,
            String status) {

        String sql = """
                INSERT INTO audit_log (
                    log_id,
                    event_type,
                    related_trade_id,
                    related_node_id,
                    description,
                    status
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """;

        String logId = "LOG-" +
                UUID.randomUUID()
                        .toString()
                        .substring(0, 8)
                        .toUpperCase();

        try (
                Connection connection = DBConnection.getConnection();

                PreparedStatement statement = connection.prepareStatement(sql)) {

            statement.setString(
                    1,
                    logId);

            statement.setString(
                    2,
                    eventType);

            statement.setString(
                    3,
                    relatedTradeId);

            statement.setString(
                    4,
                    relatedNodeId);

            statement.setString(
                    5,
                    description);

            statement.setString(
                    6,
                    status);

            int rowsAffected = statement.executeUpdate();

            return rowsAffected > 0;

        } catch (SQLException e) {

            System.out.println(
                    "Failed to create audit log.");

            e.printStackTrace();

            return false;
        }
    }
}