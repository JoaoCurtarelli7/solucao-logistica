import { RouterProvider, createBrowserRouter } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Closing from "./pages/Closing";
import Load from "./pages/Load";
import LoadCompanies from "./pages/Load/LoadCompanies";
import CompanyList from "./pages/Companies";
import EmployeeList from "./pages/Employee";
import EmployeeDetails from "./pages/Employee/Details";
import VehicleList from "./pages/Vehicle";
import VehicleMaintenance from "./pages/Vehicle/Maintenance";
import Login from "./pages/Login";
import UserProfile from "./pages/UserProfile";
import TripList from "./pages/Vehicle/Trip";
import Closings from "./pages/Closings";
import TripExpenses from "./pages/Vehicle/TripExpenses";
import Reports from "./pages/Reports";
import UsersPermissions from "./pages/UsersPermissions";
import { UserProvider } from "./context/userContext";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/closing", element: <Closing /> },
      { path: "/closings", element: <Closings /> },
      { path: "/load", element: <LoadCompanies /> },
      { path: "/load/:id", element: <Load /> },
      { path: "/companies", element: <CompanyList /> },
      { path: "/employee", element: <EmployeeList /> },
      { path: "/employee/:id", element: <EmployeeDetails /> },
      { path: "/vehicle-maintenance", element: <VehicleList /> },
      { path: "/vehicle-maintenance/:id", element: <VehicleMaintenance /> },
      { path: "/login", element: <Login /> },
      { path: "/user-profile", element: <UserProfile /> },
      { path: "/vehicle/trip", element: <TripList /> },
      { path: "/vehicle-trip/:id", element: <TripList /> },
      { path: "/vehicle/trip-expenses/:id", element: <TripExpenses /> },
      { path: "/reports", element: <Reports /> },
      { path: "/users-permissions", element: <UsersPermissions /> },
    ],
  },
]);

export default function AppRoutes() {
  return (
    <UserProvider>
      <RouterProvider router={router} />
    </UserProvider>
  );
}
