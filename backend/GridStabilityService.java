import java.util.List;
import java.util.Map;
import java.math.BigDecimal;

public class GridStabilityService {
    public record GridStatus(double generation, double consumption, double netReserve, String status) {
        public Map<String, Object> toMap() {
            return Map.of("generation", generation, "consumption", consumption,
                    "netReserve", netReserve, "status", status);
        }
    }

    public GridStatus getSnapshot() {
        return calculate(new GridNodeDAO().getAllNodes());
    }

    // THROTTLED means fully shed: only ONLINE nodes participate in live power totals.
    public GridStatus calculate(List<GridNode> nodes) {
        BigDecimal generated = BigDecimal.ZERO, consumed = BigDecimal.ZERO;
        for (GridNode node : nodes) {
            if (!"ONLINE".equals(node.getStatus())) continue;
            BigDecimal output = BigDecimal.valueOf(node.getCurrentOutputKw());
            if (output.signum() > 0) generated = generated.add(output);
            else consumed = consumed.subtract(output);
        }
        double generation = generated.doubleValue(), consumption = consumed.doubleValue();
        double reserve = generated.subtract(consumed).doubleValue();
        String status = reserve > 5 ? "STABLE" : reserve >= 0 ? "WARNING" : "DEFICIT";
        return new GridStatus(generation, consumption, reserve, status);
    }

    public double getTotalGeneration() { return getSnapshot().generation(); }
    public double getTotalConsumption() { return getSnapshot().consumption(); }
    public double getNetReserve() { return getSnapshot().netReserve(); }
    public String getGridStatus() { return getSnapshot().status(); }

    public void displayGridStatus() {
        GridStatus grid = getSnapshot();
        System.out.println("Total Generation: " + grid.generation() + " kW");
        System.out.println("Total Consumption: " + grid.consumption() + " kW");
        System.out.println("Net Reserve: " + grid.netReserve() + " kW");
        System.out.println("Grid Status: " + grid.status());
    }
}
