public class TestTradingEngine {

    public static void main(String[] args) {

        TradingEngine engine =
                new TradingEngine();

        engine.processTrade(
                "NODE-SOLAR-01",
                "NODE-CONS-01",
                20.0,
                100.0,
                90.0,
                false,
                1.0
        );
    }
}