import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import Sites from "./pages/Sites";
import Sensors from "./pages/Sensors";
import Alerts from "./pages/Alerts";
import Workers from "./pages/Workers";
import Incidents from "./pages/Incidents";
import Equipment from "./pages/Equipment";
import SafetyCompliance from "./pages/SafetyCompliance";
import Permits from "./pages/Permits";

function HomeRoute() {
  const { user } = useAuth();
  return user?.role === "EXECUTIVE" ? <ExecutiveDashboard /> : <Dashboard />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/sites" element={<Sites />} />
        <Route path="/sensors" element={<Sensors />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/workers" element={<Workers />} />
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/equipment" element={<Equipment />} />
        <Route path="/compliance" element={<SafetyCompliance />} />
        <Route path="/permits" element={<Permits />} />
      </Route>
    </Routes>
  );
}
