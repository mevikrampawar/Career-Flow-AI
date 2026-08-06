import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { KeysProvider } from "./lib/keys";
import { ToastProvider } from "./components/ui/Toast";
import AppShell from "./components/layout/AppShell";
import Landing from "./pages/Landing";
import SignIn from "./pages/SignIn";
import Dashboard from "./pages/Dashboard";
import ResumePage from "./pages/ResumePage";
import JobsPage from "./pages/JobsPage";
import ApplyPage from "./pages/ApplyPage";
import ApplicationsPage from "./pages/ApplicationsPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <KeysProvider>
          <BrowserRouter basename="/Career-Flow-AI">
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/signin" element={<SignIn />} />
              <Route path="/app" element={<AppShell />}>
                <Route index element={<Dashboard />} />
                <Route path="resume" element={<ResumePage />} />
                <Route path="jobs" element={<JobsPage />} />
                <Route path="apply/:jobId" element={<ApplyPage />} />
                <Route path="applications" element={<ApplicationsPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </KeysProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
