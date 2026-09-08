import java.sql.*;
import java.util.*;
import java.math.BigDecimal;

public class LoadSheddingService {
    public Map<String, Object> performLoadShedding() {
        GridNodeDAO dao = new GridNodeDAO();
        GridStabilityService stability = new GridStabilityService();
        try (Connection c = DBConnection.getConnection()) {
            c.setAutoCommit(false);
            try {
                
                List<GridNode> nodes = dao.getAllNodes(c, true);
                double deficit = -stability.calculate(nodes).netReserve();
                List<String> shed = new ArrayList<>();
                BigDecimal reduced = BigDecimal.ZERO;
                nodes.sort(Comparator.comparingInt(GridNode::getPriority).reversed());
                for (GridNode node : nodes) {
                    if (reduced.compareTo(BigDecimal.valueOf(deficit)) >= 0) break;
                    if (!"ONLINE".equals(node.getStatus()) || node.getCurrentOutputKw() >= 0
                            || node.getPriority() <= 1) continue;
                    try (PreparedStatement s = c.prepareStatement(
                            "UPDATE nodes SET status='THROTTLED', last_updated=CURRENT_TIMESTAMP WHERE node_id=?")) {
                        s.setString(1, node.getNodeId());
                        if (s.executeUpdate() != 1) throw new SQLException("Node status update failed.");
                    }
                    node.setStatus("THROTTLED");
                    reduced = reduced.add(BigDecimal.valueOf(node.getCurrentOutputKw()).abs());
                    shed.add(node.getNodeId());
                    new AuditLogDAO().logEvent(c, "LOAD_SHEDDING", null, node.getNodeId(),
                            node.getName() + " throttled; reduced demand by " + Math.abs(node.getCurrentOutputKw()) + " kW.", "SUCCESS");
                }
                c.commit();
                String message = deficit <= 0 ? "No deficit; no nodes changed."
                        : reduced.compareTo(BigDecimal.valueOf(deficit)) >= 0 ? "Load shedding resolved the deficit."
                        : "Available loads shed; deficit remains. Priority 1 is protected.";
                return Map.of("success", true, "shedNodeIds", shed, "reducedLoadKw", reduced,
                        "gridStatus", stability.calculate(nodes).toMap(), "message", message);
            } catch (SQLException | RuntimeException e) {
                c.rollback();
                throw e;
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Load shedding failed; changes rolled back.", e);
        }
    }
}
