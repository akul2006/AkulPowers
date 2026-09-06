import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public class GridNodeDAO {

    public List<GridNode> getAllNodes() {

        List<GridNode> nodes = new ArrayList<>();

        String sql = "SELECT * FROM nodes";

        try (
                Connection connection = DBConnection.getConnection();
                PreparedStatement statement = connection.prepareStatement(sql);
                ResultSet resultSet = statement.executeQuery()) {

            while (resultSet.next()) {

                GridNode node = new GridNode(
                        resultSet.getString("node_id"),
                        resultSet.getString("name"),
                        resultSet.getString("type"),
                        resultSet.getString("location"),
                        resultSet.getDouble("available_energy_kwh"),
                        resultSet.getDouble("max_capacity_kwh"),
                        resultSet.getDouble("current_output_kw"),
                        resultSet.getDouble("balance"),
                        resultSet.getInt("priority"),
                        resultSet.getString("status"));

                nodes.add(node);
            }

        } catch (SQLException e) {

            System.out.println("Failed to fetch nodes from database.");
            e.printStackTrace();
        }

        return nodes;
    }

    public GridNode getNodeById(String nodeId) {

        String sql = "SELECT * FROM nodes WHERE node_id = ?";

        try (
                Connection connection = DBConnection.getConnection();
                PreparedStatement statement = connection.prepareStatement(sql)) {

            statement.setString(1, nodeId);

            try (ResultSet resultSet = statement.executeQuery()) {

                if (resultSet.next()) {

                    return new GridNode(
                            resultSet.getString("node_id"),
                            resultSet.getString("name"),
                            resultSet.getString("type"),
                            resultSet.getString("location"),
                            resultSet.getDouble("available_energy_kwh"),
                            resultSet.getDouble("max_capacity_kwh"),
                            resultSet.getDouble("current_output_kw"),
                            resultSet.getDouble("balance"),
                            resultSet.getInt("priority"),
                            resultSet.getString("status"));
                }
            }

        } catch (SQLException e) {

            System.out.println("Failed to fetch node: " + nodeId);
            e.printStackTrace();
        }

        return null;
    }

    public boolean addNode(GridNode node) {

        String sql = """
                INSERT INTO nodes (
                    node_id,
                    name,
                    type,
                    location,
                    available_energy_kwh,
                    max_capacity_kwh,
                    current_output_kw,
                    balance,
                    priority,
                    status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """;

        try (
                Connection connection = DBConnection.getConnection();
                PreparedStatement statement = connection.prepareStatement(sql)) {

            statement.setString(1, node.getNodeId());
            statement.setString(2, node.getName());
            statement.setString(3, node.getType());
            statement.setString(4, node.getLocation());

            statement.setDouble(5, node.getAvailableEnergyKwh());
            statement.setDouble(6, node.getMaxCapacityKwh());
            statement.setDouble(7, node.getCurrentOutputKw());

            statement.setDouble(8, node.getBalance());

            statement.setInt(9, node.getPriority());

            statement.setString(10, node.getStatus());

            int rowsAffected = statement.executeUpdate();

            return rowsAffected > 0;

        } catch (SQLException e) {

            System.out.println(
                    "Failed to add node: " + node.getNodeId());

            e.printStackTrace();

            return false;
        }
    }

    public boolean updateNode(GridNode node) {

        String sql = """
                UPDATE nodes
                SET
                    name = ?,
                    type = ?,
                    location = ?,
                    available_energy_kwh = ?,
                    max_capacity_kwh = ?,
                    current_output_kw = ?,
                    balance = ?,
                    priority = ?,
                    status = ?,
                    last_updated = CURRENT_TIMESTAMP
                WHERE node_id = ?
                """;

        try (
                Connection connection = DBConnection.getConnection();
                PreparedStatement statement = connection.prepareStatement(sql)) {

            statement.setString(1, node.getName());
            statement.setString(2, node.getType());
            statement.setString(3, node.getLocation());

            statement.setDouble(4, node.getAvailableEnergyKwh());
            statement.setDouble(5, node.getMaxCapacityKwh());
            statement.setDouble(6, node.getCurrentOutputKw());

            statement.setDouble(7, node.getBalance());

            statement.setInt(8, node.getPriority());

            statement.setString(9, node.getStatus());

            statement.setString(10, node.getNodeId());

            int rowsAffected = statement.executeUpdate();

            return rowsAffected > 0;

        } catch (SQLException e) {

            System.out.println(
                    "Failed to update node: " + node.getNodeId());

            e.printStackTrace();

            return false;
        }
    }
}