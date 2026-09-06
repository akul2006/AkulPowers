import java.util.List;

public class GridStabilityService {

    private GridNodeDAO nodeDAO;

    public GridStabilityService() {
        nodeDAO = new GridNodeDAO();
    }


    public double getTotalGeneration() {

        List<GridNode> nodes =
                nodeDAO.getAllNodes();

        double totalGeneration = 0.0;

        for (GridNode node : nodes) {

            if (
                node.getStatus().equals("ONLINE")
                && node.getCurrentOutputKw() > 0
            ) {

                totalGeneration +=
                        node.getCurrentOutputKw();
            }
        }

        return totalGeneration;
    }


    public double getTotalConsumption() {

        List<GridNode> nodes =
                nodeDAO.getAllNodes();

        double totalConsumption = 0.0;

        for (GridNode node : nodes) {

            if (
                node.getStatus().equals("ONLINE")
                && node.getCurrentOutputKw() < 0
            ) {

                totalConsumption +=
                        Math.abs(
                            node.getCurrentOutputKw()
                        );
            }
        }

        return totalConsumption;
    }


    public double getNetReserve() {

        double generation =
                getTotalGeneration();

        double consumption =
                getTotalConsumption();

        return generation - consumption;
    }


    public String getGridStatus() {

        double netReserve =
                getNetReserve();

        if (netReserve > 5) {

            return "STABLE";

        } else if (netReserve >= 0) {

            return "WARNING";

        } else {

            return "DEFICIT";
        }
    }


    public void displayGridStatus() {

        double generation =
                getTotalGeneration();

        double consumption =
                getTotalConsumption();

        double reserve =
                generation - consumption;

        String status;

        if (reserve > 5) {

            status = "STABLE";

        } else if (reserve >= 0) {

            status = "WARNING";

        } else {

            status = "DEFICIT";
        }


        System.out.println(
                "Total Generation: "
                + generation
                + " kW"
        );

        System.out.println(
                "Total Consumption: "
                + consumption
                + " kW"
        );

        System.out.println(
                "Net Reserve: "
                + reserve
                + " kW"
        );

        System.out.println(
                "Grid Status: "
                + status
        );
    }
}