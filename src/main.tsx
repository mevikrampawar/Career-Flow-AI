import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import "./index.css";

// Global last-resort guards: an unhandled error must never white-screen the
// app. React error boundaries handle render errors; these swallow the rest so
// the UI keeps working even if a third-party promise rejects.
window.addEventListener("error", (e) => {
  console.error("Uncaught error:", e.error ?? e.message);
  e.preventDefault();
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("Unhandled promise rejection:", e.reason);
  e.preventDefault();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
