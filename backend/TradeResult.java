import java.util.Map;

public record TradeResult(boolean success, int httpStatus, String tradeId, String sellerNodeId,
        String buyerNodeId, double energyKwh, double pricePerKwh, double totalCost, String message) {
    public Map<String, Object> toMap() {
        return Map.of("success", success, "tradeId", tradeId, "sellerNodeId", sellerNodeId,
                "buyerNodeId", buyerNodeId, "energyKwh", energyKwh, "pricePerKwh", pricePerKwh,
                "totalCost", totalCost, "message", message);
    }
}
