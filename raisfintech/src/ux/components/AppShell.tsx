import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { CommandPalette } from "./CommandPalette";
import { useAuth } from "../../AuthContext";

/** Application frame: sidebar + scrollable main column + global overlays. */
export function AppShell() {
  const { user } = useAuth();
  return (
    <div className="shell">
      <Sidebar isAdmin={user?.role === "admin"} />
      <main className="shell-main">
        <div className="page">
          <Outlet />
        </div>
      </main>
      <CommandPalette />
    </div>
  );
}
