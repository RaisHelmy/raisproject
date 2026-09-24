import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import { RequireRole } from "./components/RequireAuth";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";

import ClientDashboard from "./client/ClientDashboard";
import ClientJobDetail from "./client/ClientJobDetail";
import ClientSchedules from "./client/ClientSchedules";

import RunnerHome from "./runner/RunnerHome";
import RunnerFeed from "./runner/RunnerFeed";
import RunnerJobDetail from "./runner/RunnerJobDetail";
import RunnerVehicles from "./runner/RunnerVehicles";
import RunnerPayouts from "./runner/RunnerPayouts";
import RunnerRentals from "./runner/RunnerRentals";

import VendorHome from "./vendor/VendorHome";
import VendorProfile from "./vendor/VendorProfile";
import VendorCatalogue from "./vendor/VendorCatalogue";
import VendorContracts from "./vendor/VendorContracts";
import VendorListVehicle from "./vendor/VendorListVehicle";

import AdminHome from "./admin/AdminHome";
import AdminUsers from "./admin/AdminUsers";
import AdminRules from "./admin/AdminRules";
import AdminPayouts from "./admin/AdminPayouts";
import AdminSos from "./admin/AdminSos";
import AdminAuditLog from "./admin/AdminAuditLog";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Landing />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />

        <Route
          path="client"
          element={
            <RequireRole role="purchaser">
              <ClientDashboard />
            </RequireRole>
          }
        />
        <Route
          path="client/jobs/:id"
          element={
            <RequireRole role="purchaser">
              <ClientJobDetail />
            </RequireRole>
          }
        />
        <Route
          path="client/schedules"
          element={
            <RequireRole role="purchaser">
              <ClientSchedules />
            </RequireRole>
          }
        />

        <Route
          path="runner"
          element={
            <RequireRole role="runner">
              <RunnerHome />
            </RequireRole>
          }
        >
          <Route index element={<RunnerFeed />} />
          <Route path="vehicles" element={<RunnerVehicles />} />
          <Route path="payouts" element={<RunnerPayouts />} />
          <Route path="rentals" element={<RunnerRentals />} />
        </Route>
        <Route
          path="runner/jobs/:id"
          element={
            <RequireRole role="runner">
              <RunnerJobDetail />
            </RequireRole>
          }
        />

        <Route
          path="vendor"
          element={
            <RequireRole role="vendor">
              <VendorHome />
            </RequireRole>
          }
        >
          <Route index element={<VendorProfile />} />
          <Route path="catalogue" element={<VendorCatalogue />} />
          <Route path="contracts" element={<VendorContracts />} />
          <Route path="list-vehicle" element={<VendorListVehicle />} />
        </Route>

        <Route
          path="admin"
          element={
            <RequireRole role="admin">
              <AdminHome />
            </RequireRole>
          }
        >
          <Route index element={<AdminUsers />} />
          <Route path="rules" element={<AdminRules />} />
          <Route path="payouts" element={<AdminPayouts />} />
          <Route path="sos" element={<AdminSos />} />
          <Route path="audit-log" element={<AdminAuditLog />} />
        </Route>

        <Route path="*" element={<p>Not found.</p>} />
      </Route>
    </Routes>
  );
}
