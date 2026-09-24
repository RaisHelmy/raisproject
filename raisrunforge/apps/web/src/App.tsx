import { Route, Routes } from "react-router-dom";
import { Layout } from "./layout/Layout";
import { ToastProvider } from "./components/Toast";
import { Overview } from "./pages/Overview";
import { Projects } from "./pages/Projects";
import { Applications } from "./pages/Applications";
import { ApplicationDetail } from "./pages/ApplicationDetail";
import { Deployments } from "./pages/Deployments";
import { DeploymentDetail } from "./pages/DeploymentDetail";
import { Servers } from "./pages/Servers";
import { ServerDetail } from "./pages/ServerDetail";
import { Containers } from "./pages/Containers";
import { Databases } from "./pages/Databases";
import { DatabaseDetail } from "./pages/DatabaseDetail";
import { Domains } from "./pages/Domains";
import { Networking } from "./pages/Networking";
import { InfraGraph } from "./pages/InfraGraph";
import { Monitoring } from "./pages/Monitoring";
import { Logs } from "./pages/Logs";
import { Events } from "./pages/Events";
import { Incidents } from "./pages/Incidents";
import { Backups } from "./pages/Backups";
import { Mcp } from "./pages/Mcp";
import { AiOperations } from "./pages/AiOperations";
import { Templates } from "./pages/Templates";
import { Integrations } from "./pages/Integrations";
import { Team } from "./pages/Team";
import { Settings } from "./pages/Settings";
import { Storage } from "./pages/Storage";
import { Git } from "./pages/Git";
import { Services } from "./pages/Services";
import { NotFound } from "./pages/NotFound";

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Overview />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/applications" element={<Applications />} />
          <Route path="/applications/:id" element={<ApplicationDetail />} />
          <Route path="/deployments" element={<Deployments />} />
          <Route path="/deployments/:id" element={<DeploymentDetail />} />
          <Route path="/servers" element={<Servers />} />
          <Route path="/servers/:id" element={<ServerDetail />} />
          <Route path="/containers" element={<Containers />} />
          <Route path="/services" element={<Services />} />
          <Route path="/databases" element={<Databases />} />
          <Route path="/databases/:id" element={<DatabaseDetail />} />
          <Route path="/storage" element={<Storage />} />
          <Route path="/domains" element={<Domains />} />
          <Route path="/networking" element={<Networking />} />
          <Route path="/graph" element={<InfraGraph />} />
          <Route path="/monitoring" element={<Monitoring />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/events" element={<Events />} />
          <Route path="/incidents" element={<Incidents />} />
          <Route path="/git" element={<Git />} />
          <Route path="/backups" element={<Backups />} />
          <Route path="/mcp" element={<Mcp />} />
          <Route path="/ai" element={<AiOperations />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/team" element={<Team />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </ToastProvider>
  );
}
