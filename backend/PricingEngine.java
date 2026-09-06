public class PricingEngine {

    private static final double BASE_PRICE = 8.00;

    public double calculatePrice(
            double totalGenerationKw,
            double totalConsumptionKw,
            boolean peakHour,
            double weatherFactor
    ) {

        double supplyDemandFactor;

        if (totalGenerationKw <= 0) {
            supplyDemandFactor = 1.50;
        } else {
            supplyDemandFactor =
                    totalConsumptionKw / totalGenerationKw;
        }

        // Prevent unrealistically low or high price multipliers
        supplyDemandFactor =
                Math.max(0.75, Math.min(supplyDemandFactor, 1.50));

        double peakFactor;

        if (peakHour) {
            peakFactor = 1.20;
        } else {
            peakFactor = 1.00;
        }

        double price =
                BASE_PRICE
                * supplyDemandFactor
                * peakFactor
                * weatherFactor;

        return Math.round(price * 100.0) / 100.0;
    }
}