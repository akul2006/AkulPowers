import java.sql.*;
import java.util.*;

public class GridNodeDAO {
    public List<GridNode> getAllNodes() {
        try (Connection c = DBConnection.getConnection()) {
            return getAllNodes(c, false);
        } catch (SQLException e) {
            throw new IllegalStateException("Could not load nodes.", e);
        }
    }

    public List<GridNode> getAllNodes(Connection c, boolean lock) throws SQLException {
        List<GridNode> nodes = new ArrayList<>();
        String sql = "SELECT * FROM nodes ORDER BY node_id" + (lock ? " FOR UPDATE" : "");
        try (PreparedStatement s = c.prepareStatement(sql); ResultSet rs = s.executeQuery()) {
            while (rs.next()) nodes.add(readNode(rs));
        }
        return nodes;
    }

    public static GridNode readNode(ResultSet rs) throws SQLException {
        return new GridNode(rs.getString("node_id"), rs.getString("name"), rs.getString("type"),
                rs.getString("location"), rs.getDouble("available_energy_kwh"),
                rs.getDouble("max_capacity_kwh"), rs.getDouble("current_output_kw"),
                rs.getDouble("balance"), rs.getInt("priority"), rs.getString("status"));
    }

    public GridNode getNodeById(String id) {
        try (Connection c = DBConnection.getConnection();
                PreparedStatement s = c.prepareStatement("SELECT * FROM nodes WHERE node_id = ?")) {
            s.setString(1, id);
            try (ResultSet rs = s.executeQuery()) { return rs.next() ? readNode(rs) : null; }
        } catch (SQLException e) {
            throw new IllegalStateException("Could not load node.", e);
        }
    }

    public boolean addNode(GridNode node) {
        String sql = """
                INSERT INTO nodes (node_id, name, type, location, available_energy_kwh,
                  max_capacity_kwh, current_output_kw, balance, priority, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """;
        try (Connection c = DBConnection.getConnection()) {
            c.setAutoCommit(false);
            try (PreparedStatement s = c.prepareStatement(sql)) {
                s.setString(1, node.getNodeId());
                s.setString(2, node.getName());
                s.setString(3, node.getType());
                s.setString(4, node.getLocation());
                s.setDouble(5, node.getAvailableEnergyKwh());
                s.setDouble(6, node.getMaxCapacityKwh());
                s.setDouble(7, node.getCurrentOutputKw());
                s.setDouble(8, node.getBalance());
                s.setInt(9, node.getPriority());
                s.setString(10, node.getStatus());
                s.executeUpdate();
                new AuditLogDAO().logEvent(c, "NODE_REGISTRATION", null, node.getNodeId(),
                        node.getName() + " registered at " + node.getLocation() + ".", "SUCCESS");
                c.commit();
                return true;
            } catch (SQLException e) {
                c.rollback();
                if ("23505".equals(e.getSQLState())) throw new IllegalArgumentException("Node ID already exists.");
                throw e;
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Could not register node.", e);
        }
    }

    
    public boolean updateNode(GridNode node) {
        String sql = """
                UPDATE nodes SET name=?, type=?, location=?, available_energy_kwh=?,
                max_capacity_kwh=?, current_output_kw=?, balance=?, priority=?, status=?,
                last_updated=CURRENT_TIMESTAMP WHERE node_id=?
                """;
        try (Connection c = DBConnection.getConnection(); PreparedStatement s = c.prepareStatement(sql)) {
            s.setString(1, node.getName()); s.setString(2, node.getType());
            s.setString(3, node.getLocation()); s.setDouble(4, node.getAvailableEnergyKwh());
            s.setDouble(5, node.getMaxCapacityKwh()); s.setDouble(6, node.getCurrentOutputKw());
            s.setDouble(7, node.getBalance()); s.setInt(8, node.getPriority());
            s.setString(9, node.getStatus()); s.setString(10, node.getNodeId());
            return s.executeUpdate() == 1;
        } catch (SQLException e) {
            throw new IllegalStateException("Could not update node.", e);
        }
    }
}
