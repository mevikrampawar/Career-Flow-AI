import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { KeysProvider } from "./lib/keys";
import { GmailProvider } from "./lib/GmailProvider";
import { SyncProvider } from "./lib/sync";
import { ThemeProvider } from "./lib/theme";
import { ToastProvider } from "./components/ui/Toast";
import AppShell from "./components/layout/AppShell";
import Landing from "./pages/Landing";
import SignIn from "./pages/SignIn";
import Dashboard from "./pages/Dashboard";
import ResumePage from "./pages/ResumePage";
import JobsPage from "./pages/JobsPage";
import SavedJobsPage from "./pages/SavedJobsPage";
import ScrapedJobsPage from "./pages/ScrapedJobsPage";
import ApplyPage from "./pages/ApplyPage";
import ApplicationsPage from "./pages/ApplicationsPage";
import EmailsPage from "./pages/EmailsPage";
import ProfilePage from "./pages/ProfilePage";

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <KeysProvider>
          <GmailProvider>
            <ThemeProvider>
              <SyncProvider>
                <HashRouter>
                  <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/signin" element={<SignIn />} />
                    <Route path="/app" element={<AppShell />}>
                      <Route index element={<Dashboard />} />
                      <Route path="resume" element={<ResumePage />} />
                      <Route path="jobs" element={<JobsPage />} />
                      <Route path="saved" element={<SavedJobsPage />} />
                      <Route path="scraped" element={<ScrapedJobsPage />} />
                      <Route path="apply/:jobId" element={<ApplyPage />} />
                      <Route path="applications" element={<ApplicationsPage />} />
                      <Route path="emails" element={<EmailsPage />} />
                      <Route path="profile" element={<ProfilePage />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </HashRouter>
              </SyncProvider>
            </ThemeProvider>
          </GmailProvider>
        </KeysProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
