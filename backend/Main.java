public class Main {

    public static void main(String[] args) {

        System.out.println("FLUXGRID OS - Akul Power: Smart Micro-Grid Energy System");

        GridStabilityService stabilityService = new GridStabilityService();

        System.out.println("\nGRID STATUS");

        stabilityService.displayGridStatus();

        System.out.println("\nLOAD SHEDDING");

        LoadSheddingService loadSheddingService = new LoadSheddingService();

        loadSheddingService.performLoadShedding();

        System.out.println("\nP2P ENERGY TRADE");

        TradingEngine tradingEngine = new TradingEngine();

        tradingEngine.processTrade(
                "NODE-SOLAR-01",
                "NODE-CONS-01",
                10.0,
                stabilityService.getTotalGeneration(),
                stabilityService.getTotalConsumption(),
                false,
                1.0);

        System.out.println("\nUPDATED GRID STATUS");

        stabilityService.displayGridStatus();

        System.out.println("\nFLUXGRID COMPLETE");
    }
}