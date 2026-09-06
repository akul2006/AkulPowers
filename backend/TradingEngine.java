import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.UUID;

public class TradingEngine {

    private PricingEngine pricingEngine;
    private AuditLogDAO auditLogDAO;

    public TradingEngine() {
        pricingEngine = new PricingEngine();
        auditLogDAO = new AuditLogDAO();
    }

    public boolean processTrade(
            String sellerNodeId,
            String buyerNodeId,
            double energyKwh,
            double totalGenerationKw,
            double totalConsumptionKw,
            boolean peakHour,
            double weatherFactor) {

        Connection connection = null;

        try {

            connection = DBConnection.getConnection();

            connection.setAutoCommit(false);

            GridNode seller = getNodeById(connection, sellerNodeId);

            GridNode buyer = getNodeById(connection, buyerNodeId);

            if (seller == null) {
                throw new SQLException(
                        "Seller node does not exist.");
            }

            if (buyer == null) {
                throw new SQLException(
                        "Buyer node does not exist.");
            }

            if (sellerNodeId.equals(buyerNodeId)) {
                throw new SQLException(
                        "Seller and buyer cannot be the same node.");
            }

            if (!seller.getStatus().equals("ONLINE")) {
                throw new SQLException(
                        "Seller node is not online.");
            }

            if (!buyer.getStatus().equals("ONLINE")) {
                throw new SQLException(
                        "Buyer node is not online.");
            }

            if (energyKwh <= 0) {
                throw new SQLException(
                        "Energy amount must be greater than zero.");
            }

            if (seller.getAvailableEnergyKwh() < energyKwh) {
                throw new SQLException(
                        "Seller does not have enough energy.");
            }

            double pricePerKwh = pricingEngine.calculatePrice(
                    totalGenerationKw,
                    totalConsumptionKw,
                    peakHour,
                    weatherFactor);

            double totalCost = energyKwh * pricePerKwh;

            if (buyer.getBalance() < totalCost) {
                throw new SQLException(
                        "Buyer does not have enough balance.");
            }

            double newSellerEnergy = seller.getAvailableEnergyKwh()
                    - energyKwh;

            double newBuyerEnergy = buyer.getAvailableEnergyKwh()
                    + energyKwh;

            double newSellerBalance = seller.getBalance()
                    + totalCost;

            double newBuyerBalance = buyer.getBalance()
                    - totalCost;

            if (newBuyerEnergy > buyer.getMaxCapacityKwh()) {

                throw new SQLException(
                        "Buyer does not have enough energy capacity.");
            }

            updateEnergyAndBalance(
                    connection,
                    sellerNodeId,
                    newSellerEnergy,
                    newSellerBalance);

            updateEnergyAndBalance(
                    connection,
                    buyerNodeId,
                    newBuyerEnergy,
                    newBuyerBalance);

            String tradeId = "TX-" +
                    UUID.randomUUID()
                            .toString()
                            .substring(0, 8)
                            .toUpperCase();

            insertTrade(
                    connection,
                    tradeId,
                    sellerNodeId,
                    buyerNodeId,
                    energyKwh,
                    pricePerKwh,
                    totalCost);

            connection.commit();

            System.out.println();
            System.out.println(
                    "Trade committed successfully!");

            auditLogDAO.logEvent(
                    "ENERGY_TRADE",
                    tradeId,
                    null,
                    "Energy trade completed successfully between "
                            + sellerNodeId
                            + " and "
                            + buyerNodeId
                            + ".",
                    "COMMITTED");

            System.out.println(
                    "Trade ID: " + tradeId);

            System.out.println(
                    "Energy: " + energyKwh + " kWh");

            System.out.println(
                    "Price: Rs. "
                            + pricePerKwh
                            + " per kWh");

            System.out.println(
                    "Total Cost: Rs. "
                            + totalCost);

            return true;

        } catch (Exception e) {

            if (connection != null) {

                try {

                    connection.rollback();

                    System.out.println(
                            "Transaction rolled back.");

                } catch (SQLException rollbackException) {

                    rollbackException.printStackTrace();
                }
            }

            auditLogDAO.logEvent(
                    "ENERGY_TRADE",
                    null,
                    null,
                    "Trade failed between "
                            + sellerNodeId
                            + " and "
                            + buyerNodeId
                            + ": "
                            + e.getMessage(),
                    "ROLLED_BACK");

            System.out.println(
                    "Trade failed: "
                            + e.getMessage());

            return false;

        } finally {

            if (connection != null) {

                try {

                    connection.setAutoCommit(true);
                    connection.close();

                } catch (SQLException e) {

                    e.printStackTrace();
                }
            }
        }
    }

    private GridNode getNodeById(
            Connection connection,
            String nodeId) throws SQLException {

        String sql = "SELECT * FROM nodes WHERE node_id = ?";

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