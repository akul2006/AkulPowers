import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.UUID;

public class TradingEngine {
    private final PricingEngine pricingEngine = new PricingEngine();
    private final AuditLogDAO auditLogDAO = new AuditLogDAO();

    // Preserve the console examples; HTTP callers receive the full receipt instead.
    public boolean processTrade(String sellerId, String buyerId, double energy,
            double generation, double consumption, boolean peakHour, double weatherFactor) {
        TradeResult result = executeTrade(sellerId, buyerId, energy, generation, consumption, peakHour, weatherFactor);
        System.out.println(result.message());
        return result.success();
    }

    public TradeResult executeTrade(String sellerId, String buyerId, double energy,
            double generation, double consumption, boolean peakHour, double weatherFactor) {
        double price = 0, cost = 0;
        int failureStatus = 400;
        try {
            if (sellerId == null || buyerId == null || sellerId.isBlank() || buyerId.isBlank())
                throw new IllegalArgumentException("Seller and buyer are required.");
            if (sellerId.equals(buyerId)) throw new IllegalArgumentException("Seller and buyer cannot be the same node.");
            if (!Double.isFinite(energy) || energy <= 0 || energy >= 100000000
                    || BigDecimal.valueOf(energy).stripTrailingZeros().scale() > 2)
                throw new IllegalArgumentException("Energy must be positive with at most two decimal places.");
            price = pricingEngine.calculatePrice(generation, consumption, peakHour, weatherFactor);
            cost = BigDecimal.valueOf(energy).multiply(BigDecimal.valueOf(price))
                    .setScale(2, RoundingMode.HALF_UP).doubleValue();
            try (Connection connection = DBConnection.getConnection()) {
                // ONE connection owns all locks, energy/fund updates, trade and success audit.
                connection.setAutoCommit(false);
                try {
                    // Consistent lock order avoids deadlocks in opposing trades.
                    GridNode first = getNodeById(connection, sellerId.compareTo(buyerId) < 0 ? sellerId : buyerId);
                    GridNode second = getNodeById(connection, sellerId.compareTo(buyerId) < 0 ? buyerId : sellerId);
                    GridNode seller = sellerId.compareTo(buyerId) < 0 ? first : second;
                    GridNode buyer = sellerId.compareTo(buyerId) < 0 ? second : first;
                    if (seller == null || buyer == null) {
                        failureStatus = 404;
                        throw new IllegalArgumentException("Seller or buyer node does not exist.");
                    }
                    if (!"ONLINE".equals(seller.getStatus())) throw new IllegalArgumentException("Seller node is not online.");
                    if (!"ONLINE".equals(buyer.getStatus())) throw new IllegalArgumentException("Buyer node is not online.");
                    if (seller.getAvailableEnergyKwh() < energy) throw new IllegalArgumentException("Seller does not have enough energy.");
                    if (buyer.getBalance() < cost) throw new IllegalArgumentException("Buyer does not have enough balance.");
                    if (buyer.getAvailableEnergyKwh() + energy > buyer.getMaxCapacityKwh())
                        throw new IllegalArgumentException("Buyer does not have enough energy capacity.");
                    if (seller.getBalance() + cost >= 10000000000.0)
                        throw new IllegalArgumentException("Trade exceeds the seller account balance limit.");
                    updateEnergyAndBalance(connection, sellerId, seller.getAvailableEnergyKwh() - energy, seller.getBalance() + cost);
                    updateEnergyAndBalance(connection, buyerId, buyer.getAvailableEnergyKwh() + energy, buyer.getBalance() - cost);
                    String tradeId = "TX-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
                    insertTrade(connection, tradeId, sellerId, buyerId, energy, price, cost);
                    auditLogDAO.logEvent(connection, "ENERGY_TRADE", tradeId, null,
                            energy + " kWh traded from " + sellerId + " to " + buyerId + ".", "COMMITTED");
                    connection.commit();
                    return new TradeResult(true, 200, tradeId, sellerId, buyerId, energy, price, cost, "Trade committed successfully.");
                } catch (SQLException | RuntimeException e) {
                    // Roll back before the failure audit uses its own connection.
                    connection.rollback();
                    throw e;
                }
            }
        } catch (IllegalArgumentException e) {
            return failure(failureStatus, sellerId, buyerId, energy, price, cost, e.getMessage());
        } catch (SQLException e) {
            System.err.println("Trade database error: " + e.getSQLState());
            return failure(500, sellerId, buyerId, energy, price, cost,
                    "Database error. Refresh nodes and audit logs to verify the transaction before retrying.");
        }
    }

    private TradeResult failure(int status, String seller, String buyer, double energy, double price, double cost, String message) {
        boolean logged = auditLogDAO.logEvent("ENERGY_TRADE", null, null,
                "Trade " + seller + " -> " + buyer + " failed: " + message,
                status == 500 ? "FAILED" : "ROLLED_BACK");
        if (!logged) message += " Failure audit could not be saved.";
        return new TradeResult(false, status, "", seller == null ? "" : seller, buyer == null ? "" : buyer,
                Double.isFinite(energy) ? energy : 0, price, cost, message);
    }

    private GridNode getNodeById(
            Connection connection,
            String nodeId) throws SQLException {

        String sql = "SELECT * FROM nodes WHERE node_id = ? FOR UPDATE";

        try (
                PreparedStatement statement = connection.prepareStatement(sql)) {

            statement.setString(1, nodeId);

            try (
                    ResultSet resultSet = statement.executeQuery()) {

                if (resultSet.next()) {

                    return new GridNode(
                            resultSet.getString("node_id"),
                            resultSet.getString("name"),
                            resultSet.getString("type"),
                            resultSet.getString("location"),
                            resultSet.getDouble(
                                    "available_energy_kwh"),
                            resultSet.getDouble(
                                    "max_capacity_kwh"),
                            resultSet.getDouble(
                                    "current_output_kw"),
                            resultSet.getDouble("balance"),
                            resultSet.getInt("priority"),
                            resultSet.getString("status"));
                }
            }
        }

        return null;
    }

    private void updateEnergyAndBalance(
            Connection connection,
            String nodeId,
            double newEnergy,
            double newBalance) throws SQLException {

        String sql = """
                UPDATE nodes
                SET
                    available_energy_kwh = ?,
                    balance = ?,
                    last_updated = CURRENT_TIMESTAMP
                WHERE node_id = ?
                """;

        try (
                PreparedStatement statement = connection.prepareStatement(sql)) {

            statement.setDouble(
                    1,
                    newEnergy);

            statement.setDouble(
                    2,
                    newBalance);

            statement.setString(
                    3,
                    nodeId);

            int rowsAffected = statement.executeUpdate();

            if (rowsAffected != 1) {

                throw new SQLException(
                        "Node update failed for "
                                + nodeId);
            }
        }
    }

    private void insertTrade(
            Connection connection,
            String tradeId,
            String sellerNodeId,
            String buyerNodeId,
            double energyKwh,
            double pricePerKwh,
            double totalCost) throws SQLException {

        String sql = """
                INSERT INTO energy_trades (
                    trade_id,
                    seller_node_id,
                    buyer_node_id,
                    energy_kwh,
                    price_per_kwh,
                    total_cost,
                    status,
                    failure_reason
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """;

        try (
                PreparedStatement statement = connection.prepareStatement(sql)) {

            statement.setString(1, tradeId);
            statement.setString(2, sellerNodeId);
            statement.setString(3, buyerNodeId);

            statement.setDouble(4, energyKwh);
            statement.setDouble(5, pricePerKwh);
            statement.setDouble(6, totalCost);

            statement.setString(
                    7,
                    "COMMITTED");

            statement.setString(
                    8,
                    null);

            statement.executeUpdate();
        }
    }
}