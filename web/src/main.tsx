import React from "react";
import ReactDOM from "react-dom/client";
import {App} from "./App";
import {AuthProvider} from "./auth/AuthContext";
import {initializeAnalytics, initializePerformance, trackException} from "./firebase";
import "./styles.css";

void initializeAnalytics();
void initializePerformance();

window.addEventListener("error", (event) => {
  trackException(event.message, true);
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
  trackException(reason, true);
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);
