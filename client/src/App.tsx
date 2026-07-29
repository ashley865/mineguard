import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Sites from "./pages/Sites";
import Sensors from "./pages/Sensors";
import Alerts from "./pages/Alerts";
import Workers from "./pages/Workers";
import Incidents from "./pages/Incidents";
import Equipment from "./pages/Equipment";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/sites" element={<Sites />} />
        <Route path="/sensors" element={<Sensors />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/workers" element={<Workers />} />
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/equipment" element={<Equipment />} />
      </Route>
    </Routes>
  );
}
