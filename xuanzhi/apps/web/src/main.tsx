import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "@/styles/app.css";
import App from "@/App";
import { AuthProvider } from "@/services/auth";
import { PrefsProvider } from "@/services/prefs";
import { ToastProvider } from "@/services/toast";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <PrefsProvider>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </PrefsProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
