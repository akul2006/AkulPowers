import java.util.Map;

public class Main {

    public static void main(String[] args) {

        System.out.println("FLUXGRID OS - Akul Power: Smart Micro-Grid Energy System");

        GridStabilityService.GridStatus grid = new GridStabilityService().getSnapshot();

        System.out.println("\nGRID STATUS");

        System.out.println("Total Generation: " + grid.generation() + " kW");
        System.out.println("Total Consumption: " + grid.consumption() + " kW");
        System.out.println("Net Reserve: " + grid.netReserve() + " kW");
        System.out.println("Grid Status: " + grid.status());

        Map<String, Object> pricing = new PricingEngine().getPricing(
                grid.generation(), grid.consumption(),
                PricingEngine.isPeakHour(), PricingEngine.WEATHER_FACTOR);

        System.out.println("\nCURRENT PRICING");
        System.out.println("Base Price: INR " + pricing.get("basePrice") + " / kWh");
        System.out.println("Supply/Demand Factor: " + pricing.get("supplyDemandFactor"));
        System.out.println("Peak Factor: " + pricing.get("peakFactor"));
        System.out.println("Weather Factor (simulated): " + pricing.get("weatherFactor"));
        System.out.println("Dynamic Price: INR " + pricing.get("pricePerKwh") + " / kWh");

        System.out.println("\nFLUXGRID COMPLETE");
    }
}
