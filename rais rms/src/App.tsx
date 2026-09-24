import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./lib/auth";
import { OutletProvider } from "./lib/outlet";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import { Login } from "./routes/Login";
import { Register } from "./routes/Register";
import { Dashboard } from "./routes/Dashboard";
import { Reservations } from "./routes/Reservations";
import { FloorPlan } from "./routes/FloorPlan";
import { Waitlist } from "./routes/Waitlist";
import { Guests } from "./routes/Guests";
import { Staff } from "./routes/Staff";
import { Menu } from "./routes/Menu";
import { Orders } from "./routes/Orders";
import { Events } from "./routes/Events";
import { Inventory } from "./routes/Inventory";
import { Schedule } from "./routes/Schedule";
import { Campaigns } from "./routes/Campaigns";
import { Feedback } from "./routes/Feedback";
import { BookingWidget } from "./routes/public/BookingWidget";
import { ManageReservation } from "./routes/public/ManageReservation";
import { PublicFeedback } from "./routes/public/PublicFeedback";
import { QrOrder } from "./routes/public/QrOrder";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, retry: 1 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Guest-facing, unauthenticated */}
            <Route path="/book/:tenantSlug" element={<BookingWidget />} />
            <Route path="/book/:tenantSlug/manage/:id" element={<ManageReservation />} />
            <Route path="/feedback/:tenantSlug/:id" element={<PublicFeedback />} />
            <Route path="/order/:tenantSlug/:outletId/:menuId" element={<QrOrder />} />

            <Route element={<ProtectedRoute />}>
              <Route
                element={
                  <OutletProvider>
                    <Layout />
                  </OutletProvider>
                }
              >
                <Route path="/" element={<Dashboard />} />
                <Route path="/reservations" element={<Reservations />} />
                <Route path="/floor" element={<FloorPlan />} />
                <Route path="/waitlist" element={<Waitlist />} />
                <Route path="/guests" element={<Guests />} />
                <Route path="/menu" element={<Menu />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/events" element={<Events />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/schedule" element={<Schedule />} />
                <Route path="/campaigns" element={<Campaigns />} />
                <Route path="/feedback" element={<Feedback />} />
                <Route path="/staff" element={<Staff />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
