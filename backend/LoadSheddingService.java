import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public class LoadSheddingService {

    private GridNodeDAO nodeDAO;
    private GridStabilityService stabilityService;
    private AuditLogDAO auditLogDAO;

    public LoadSheddingService() {

        nodeDAO = new GridNodeDAO();
        stabilityService = new GridStabilityService();
        auditLogDAO = new AuditLogDAO();
    }

    public void performLoadShedding() {

        double generation = stabilityService.getTotalGeneration();

        double consumption = stabilityService.getTotalConsumption();

        double deficit = consumption - generation;

        if (deficit <= 0) {

            System.out.println(
                    "Grid has no deficit. Load shedding not required.");

            return;
        }

        System.out.println(
                "Grid deficit detected: "
                        + deficit
                        + " kW");

        List<GridNode> allNodes = nodeDAO.getAllNodes();

        List<GridNode> candidates = new ArrayList<>();

        for (GridNode node : allNodes) {

            if (node.getStatus().equals("ONLINE")
                    &&
                    node.getCurrentOutputKw() < 0
                    &&
                    node.getPriority() > 1) {

                candidates.add(node);
            }
        }

        candidates.sort(
                Comparator.comparingInt(
                        GridNode::getPriority).reversed());

        double reducedLoad = 0.0;

        for (GridNode node : candidates) {

            if (reducedLoad >= deficit) {
                break;
            }

            double nodeConsumption = Math.abs(
                    node.getCurrentOutputKw());

            node.setStatus("THROTTLED");

            boolean updated = nodeDAO.updateNode(node);

            if (updated) {

                reducedLoad += nodeConsumption;

                System.out.println(
                        "Throttled: "
                                + node.getName()
                                + " | Reduced load: "
                                + nodeConsumption
                                + " kW");

                auditLogDAO.logEvent(
                        "LOAD_SHEDDING",
                        null,
                        node.getNodeId(),
                        node.getName()
                                + " was throttled due to grid deficit.",
                        "SUCCESS");
            }
        }

        System.out.println();

        System.out.println(
                "Total load reduced: "
                        + reducedLoad
                        + " kW");

        if (reducedLoad >= deficit) {

            System.out.println(
                    "Grid deficit handled successfully.");

        } else {

            System.out.println(
                    "Warning: Available load shedding was not enough to remove the deficit.");
        }
    }
}