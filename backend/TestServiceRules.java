import java.util.List;

/** Pure Java boundary checks; does not connect to PostgreSQL. */
public class TestServiceRules {
    public static void main(String[] args) {
        GridStabilityService service = new GridStabilityService();
        check(service.calculate(List.of(node(10, "ONLINE"), node(-4, "ONLINE"))).status().equals("STABLE"));
        check(service.calculate(List.of(node(10, "ONLINE"), node(-5, "ONLINE"))).status().equals("WARNING"));
        check(service.calculate(List.of(node(10, "ONLINE"), node(-10, "ONLINE"))).status().equals("WARNING"));
        check(service.calculate(List.of(node(10, "ONLINE"), node(-11, "ONLINE"))).status().equals("DEFICIT"));
        var grid = service.calculate(List.of(node(10, "ONLINE"), node(-100, "THROTTLED"), node(50, "OFFLINE")));
        check(grid.generation() == 10 && grid.consumption() == 0);
        PricingEngine pricing = new PricingEngine();
        check(pricing.calculatePrice(100, 0, false, 1) == 6);
        check(pricing.calculatePrice(0, 100, false, 1) == 12);
        check(pricing.calculatePrice(100, 120, true, 1.05) == 12.10);
        check(Json.stringify("\"\\\n\t\u0001").equals("\"\\\"\\\\\\n\\t\\u0001\""));
        check(service.calculate(List.of(node(0.3, "ONLINE"), node(-0.1, "ONLINE"), node(-0.2, "ONLINE"))).status().equals("WARNING"));
        check(service.calculate(List.of(node(5.1, "ONLINE"), node(0.2, "ONLINE"), node(-0.3, "ONLINE"))).status().equals("WARNING"));
        System.out.println("PASS: 11 service/JSON checks.");
    }
    private static GridNode node(double output, String status) {
        return new GridNode("TEST", "Test", "BATTERY_STORAGE", "Test", 0, 100, output, 0, 2, status);
    }
    private static void check(boolean condition) {
        if (!condition) throw new AssertionError("Service rule failed.");
    }
}
