import java.sql.Connection;

public class TestConnection {

    public static void main(String[] args) {

        try {

            Connection connection =
                    DBConnection.getConnection();

            System.out.println(
                    "Connected to PostgreSQL successfully!"
            );

            connection.close();

        } catch (Exception e) {

            System.out.println(
                    "Database connection failed."
            );

            e.printStackTrace();
        }
    }
}