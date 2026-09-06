public class TestPricingEngine {

    public static void main(String[] args) {

        PricingEngine engine =
                new PricingEngine();

        double price = engine.calculatePrice(
                100.0,
                120.0,
                true,
                1.05
        );

        System.out.println(
                "Dynamic Energy Price: Rs. "
                + price
                + " per kWh"
        );
    }
}