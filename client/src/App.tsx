import { ReactElement } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";
import { isModuleAllowed, RestrictedModule } from "./lib/executiveAccess";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import RegisterMine from "./pages/RegisterMine";
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
import WorkforceManagement from "./pages/WorkforceManagement";
import DocumentVault from "./pages/DocumentVault";
import GovernmentInspection from "./pages/GovernmentInspection";
import Reporting from "./pages/Reporting";
import Contractors from "./pages/Contractors";
import ContractorRegister from "./pages/ContractorRegister";
import VisitorManagement from "./pages/VisitorManagement";
import VisitorCheckIn from "./pages/VisitorCheckIn";
import PermitToWork from "./pages/PermitToWork";
import Settings from "./pages/Settings";
import AcceptExecutiveInvite from "./pages/AcceptExecutiveInvite";
import TruckRegistration from "./pages/TruckRegistration";
import Scanner from "./pages/Scanner";
import Messages from "./pages/Messages";
import Marketplace from "./pages/Marketplace";
import MarketplaceBrowse from "./pages/MarketplaceBrowse";
import BuyerRegister from "./pages/BuyerRegister";
import Tenders from "./pages/Tenders";
import TenderBoard from "./pages/TenderBoard";
import ProductionTracking from "./pages/ProductionTracking";
import MaintenanceScheduling from "./pages/MaintenanceScheduling";
import FleetTracking from "./pages/FleetTracking";
import InventoryManagement from "./pages/InventoryManagement";
import WeatherMonitoring from "./pages/WeatherMonitoring";

function HomeRoute() {
  const { user } = useAuth();
  return user?.role === "EXECUTIVE" ? <ExecutiveDashboard /> : <Dashboard />;
}

function ModuleRoute({ path, children }: { path: RestrictedModule; children: ReactElement }) {
  const { user } = useAuth();
  if (!isModuleAllowed(user?.role, user?.title, path)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/register-mine" element={<RegisterMine />} />
      <Route path="/visit/:siteId" element={<VisitorCheckIn />} />
      <Route path="/contractor-register/:siteId" element={<ContractorRegister />} />
      <Route path="/join-executive/:inviteId" element={<AcceptExecutiveInvite />} />
      <Route path="/buy" element={<MarketplaceBrowse />} />
      <Route path="/buyer-register" element={<BuyerRegister />} />
      <Route path="/tender-board" element={<TenderBoard />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/sites" element={<ModuleRoute path="/sites"><Sites /></ModuleRoute>} />
        <Route path="/sensors" element={<ModuleRoute path="/sensors"><Sensors /></ModuleRoute>} />
        <Route path="/alerts" element={<ModuleRoute path="/alerts"><Alerts /></ModuleRoute>} />
        <Route path="/workers" element={<ModuleRoute path="/workers"><Workers /></ModuleRoute>} />
        <Route path="/incidents" element={<ModuleRoute path="/incidents"><Incidents /></ModuleRoute>} />
        <Route path="/equipment" element={<ModuleRoute path="/equipment"><Equipment /></ModuleRoute>} />
        <Route path="/compliance" element={<ModuleRoute path="/compliance"><SafetyCompliance /></ModuleRoute>} />
        <Route path="/permits" element={<ModuleRoute path="/permits"><Permits /></ModuleRoute>} />
        <Route path="/workforce" element={<ModuleRoute path="/workforce"><WorkforceManagement /></ModuleRoute>} />
        <Route path="/documents" element={<ModuleRoute path="/documents"><DocumentVault /></ModuleRoute>} />
        <Route path="/inspection" element={<ModuleRoute path="/inspection"><GovernmentInspection /></ModuleRoute>} />
        <Route path="/reporting" element={<ModuleRoute path="/reporting"><Reporting /></ModuleRoute>} />
        <Route path="/contractors" element={<ModuleRoute path="/contractors"><Contractors /></ModuleRoute>} />
        <Route path="/visitors" element={<ModuleRoute path="/visitors"><VisitorManagement /></ModuleRoute>} />
        <Route path="/permits-to-work" element={<ModuleRoute path="/permits-to-work"><PermitToWork /></ModuleRoute>} />
        <Route path="/trucks" element={<ModuleRoute path="/trucks"><TruckRegistration /></ModuleRoute>} />
        <Route path="/scanner" element={<ModuleRoute path="/scanner"><Scanner /></ModuleRoute>} />
        <Route path="/marketplace" element={<ModuleRoute path="/marketplace"><Marketplace /></ModuleRoute>} />
        <Route path="/tenders" element={<ModuleRoute path="/tenders"><Tenders /></ModuleRoute>} />
        <Route path="/production" element={<ModuleRoute path="/production"><ProductionTracking /></ModuleRoute>} />
        <Route path="/maintenance" element={<ModuleRoute path="/maintenance"><MaintenanceScheduling /></ModuleRoute>} />
        <Route path="/fleet" element={<ModuleRoute path="/fleet"><FleetTracking /></ModuleRoute>} />
        <Route path="/inventory" element={<ModuleRoute path="/inventory"><InventoryManagement /></ModuleRoute>} />
        <Route path="/weather" element={<ModuleRoute path="/weather"><WeatherMonitoring /></ModuleRoute>} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
