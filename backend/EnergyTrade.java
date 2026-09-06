public class EnergyTrade {

    private String tradeId;
    private String sellerNodeId;
    private String buyerNodeId;
    private double energyKwh;
    private double pricePerKwh;
    private double totalCost;
    private String status;
    private String failureReason;


    public EnergyTrade(
            String tradeId,
            String sellerNodeId,
            String buyerNodeId,
            double energyKwh,
            double pricePerKwh,
            double totalCost,
            String status,
            String failureReason
    ) {
        this.tradeId = tradeId;
        this.sellerNodeId = sellerNodeId;
        this.buyerNodeId = buyerNodeId;
        this.energyKwh = energyKwh;
        this.pricePerKwh = pricePerKwh;
        this.totalCost = totalCost;
        this.status = status;
        this.failureReason = failureReason;
    }


    public String getTradeId() {
        return tradeId;
    }

    public String getSellerNodeId() {
        return sellerNodeId;
    }

    public String getBuyerNodeId() {
        return buyerNodeId;
    }

    public double getEnergyKwh() {
        return energyKwh;
    }

    public double getPricePerKwh() {
        return pricePerKwh;
    }

    public double getTotalCost() {
        return totalCost;
    }

    public String getStatus() {
        return status;
    }

    public String getFailureReason() {
        return failureReason;
    }


    public void setStatus(String status) {
        this.status = status;
    }

    public void setFailureReason(String failureReason) {
        this.failureReason = failureReason;
    }


    public void displayTradeDetails() {
        System.out.println("Trade ID: " + tradeId);
        System.out.println("Seller: " + sellerNodeId);
        System.out.println("Buyer: " + buyerNodeId);
        System.out.println("Energy: " + energyKwh + " kWh");
        System.out.println("Price: Rs. " + pricePerKwh + " / kWh");
        System.out.println("Total Cost: Rs. " + totalCost);
        System.out.println("Status: " + status);

        if (failureReason != null) {
            System.out.println("Failure Reason: " + failureReason);
        }
    }
}