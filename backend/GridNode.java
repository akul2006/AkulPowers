public class GridNode {

    private String nodeId;
    private String name;
    private String type;
    private String location;
    private double availableEnergyKwh;
    private double maxCapacityKwh;
    private double currentOutputKw;
    private double balance;
    private int priority;
    private String status;


    public GridNode(
            String nodeId,
            String name,
            String type,
            String location,
            double availableEnergyKwh,
            double maxCapacityKwh,
            double currentOutputKw,
            double balance,
            int priority,
            String status
    ) {
        this.nodeId = nodeId;
        this.name = name;
        this.type = type;
        this.location = location;
        this.availableEnergyKwh = availableEnergyKwh;
        this.maxCapacityKwh = maxCapacityKwh;
        this.currentOutputKw = currentOutputKw;
        this.balance = balance;
        this.priority = priority;
        this.status = status;
    }


    public String getNodeId() {
        return nodeId;
    }

    public String getName() {
        return name;
    }

    public String getType() {
        return type;
    }

    public String getLocation() {
        return location;
    }

    public double getAvailableEnergyKwh() {
        return availableEnergyKwh;
    }

    public double getMaxCapacityKwh() {
        return maxCapacityKwh;
    }

    public double getCurrentOutputKw() {
        return currentOutputKw;
    }

    public double getBalance() {
        return balance;
    }

    public int getPriority() {
        return priority;
    }

    public String getStatus() {
        return status;
    }


    public void setAvailableEnergyKwh(double availableEnergyKwh) {
        this.availableEnergyKwh = availableEnergyKwh;
    }

    public void setCurrentOutputKw(double currentOutputKw) {
        this.currentOutputKw = currentOutputKw;
    }

    public void setBalance(double balance) {
        this.balance = balance;
    }

    public void setStatus(String status) {
        this.status = status;
    }


    public void displayNodeDetails() {
        System.out.println("Node ID: " + nodeId);
        System.out.println("Name: " + name);
        System.out.println("Type: " + type);
        System.out.println("Location: " + location);
        System.out.println("Available Energy: " + availableEnergyKwh + " kWh");
        System.out.println("Maximum Capacity: " + maxCapacityKwh + " kWh");
        System.out.println("Current Output: " + currentOutputKw + " kW");
        System.out.println("Balance: Rs. " + balance);
        System.out.println("Priority: " + priority);
        System.out.println("Status: " + status);
    }
}