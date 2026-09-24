import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { SimulationBanner } from "./SimulationBanner";

export function Layout() {
  return (
    <div className="d-flex">
      <Sidebar />
      <div className="flex-grow-1 d-flex flex-column" style={{ minHeight: "100vh" }}>
        <SimulationBanner />
        <Topbar />
        <main className="p-4 flex-grow-1 bg-light">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
