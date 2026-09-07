import java.time.LocalTime;
import java.util.Map;

public class PricingEngine {
    private static final double BASE_PRICE = 8.00;
    // Simple simulation: neutral weather and local evening peak from 18:00 to 22:00.
    public static final double WEATHER_FACTOR = 1.0;
    public static boolean isPeakHour() {
        int hour = LocalTime.now().getHour();
        return hour >= 18 && hour < 22;
    }

    public Map<String, Object> getPricing(double generation, double consumption,
            boolean peakHour, double weatherFactor) {
        if (!Double.isFinite(generation) || !Double.isFinite(consumption)
                || generation < 0 || consumption < 0 || !Double.isFinite(weatherFactor)
                || weatherFactor <= 0) throw new IllegalArgumentException("Invalid pricing inputs.");
        double supplyDemandFactor = generation <= 0 ? 1.50 : consumption / generation;
        supplyDemandFactor = Math.max(0.75, Math.min(supplyDemandFactor, 1.50));
        double peakFactor = peakHour ? 1.20 : 1.00;
        double price = Math.round(BASE_PRICE * supplyDemandFactor * peakFactor * weatherFactor * 100) / 100.0;
        return Map.of("basePrice", BASE_PRICE, "supplyDemandFactor", supplyDemandFactor,
                "peakFactor", peakFactor, "weatherFactor", weatherFactor, "pricePerKwh", price);
    }

    public double calculatePrice(double generation, double consumption, boolean peakHour, double weatherFactor) {
        return (double) getPricing(generation, consumption, peakHour, weatherFactor).get("pricePerKwh");
    }
}
