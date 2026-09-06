public class TestGridNodeDAO {

    public static void main(String[] args) {

        GridNodeDAO dao = new GridNodeDAO();

        GridNode node =
                dao.getNodeById("NODE-SOLAR-01");

        if (node == null) {

            System.out.println("Node not found.");
            return;
        }

        System.out.println("Before update:");

        node.displayNodeDetails();

        node.setAvailableEnergyKwh(280.50);
        node.setBalance(15500.00);

        boolean updated =
                dao.updateNode(node);

        if (updated) {

            System.out.println();
            System.out.println("Node updated successfully!");

        } else {

            System.out.println("Update failed.");
        }
    }
}