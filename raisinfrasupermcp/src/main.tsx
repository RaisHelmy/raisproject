import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./styles/app.css";
import { AppProviders } from "./app/providers";
import { AppRoutes } from "./app/routes";

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) return <div className="container py-5"><div className="error-state"><h4>Super MCP hit an unexpected error</h4><p className="mb-2">{this.state.error.message}</p><button className="btn btn-primary btn-sm" onClick={() => { this.setState({}); window.location.href = "/"; }}>Back to dashboard</button></div></div>;
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AppProviders><AppRoutes /></AppProviders>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
