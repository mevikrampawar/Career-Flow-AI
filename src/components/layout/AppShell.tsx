import { Navigate, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { useKeys } from "../../lib/keys";
import { useSync } from "../../lib/sync";
import { useTheme } from "../../lib/theme";
import { useAppStore } from "../../store/useAppStore";
import { Spinner } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { BrandLogo } from "../ui/Brand";

const NAV = [
  { to: "/app", label: "Dashboard", icon: "dashboard", end: true },
  { to: "/app/applications", label: "Applications", icon: "work_history" },
  { to: "/app/jobs", label: "Job Matcher", icon: "auto_awesome" },
  { to: "/app/saved", label: "Saved Jobs", icon: "bookmark" },
  { to: "/app/scraped", label: "Scraped Jobs", icon: "folder_copy" },
  { to: "/app/resume", label: "Resume", icon: "description" },
  { to: "/app/settings", label: "Settings", icon: "settings" },
];

const MOBILE_NAV = [
  { to: "/app", label: "Dashboard", icon: "dashboard", end: true },
  { to: "/app/jobs", label: "Matcher", icon: "auto_awesome" },
  { to: "/app/saved", label: "Saved", icon: "bookmark" },
  { to: "/app/scraped", label: "Scraped", icon: "folder_copy" },
  { to: "/app/applications", label: "Apps", icon: "work_history" },
  { to: "/app/settings", label: "Settings", icon: "settings" },
];

function Avatar({ name, email }: { name?: string; email?: string }) {
  const letter = (name ?? email ?? "?").charAt(0).toUpperCase();
  return (
    <div className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-variant text-label-md font-semibold text-primary">
      {letter}
    </div>
  );
}

export default function AppShell() {
  const { user, loading, signOut } = useAuth();
  const { hasGroq, hasApify } = useKeys();
  const { syncing, signedIn } = useSync();
  const { theme, toggleTheme } = useTheme();
  const resume = useAppStore((s) => s.resume);
  const navigate = useNavigate();

  // Every route inside /app requires a Google account so data syncs to
  // Firestore. No local-only mode.
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="flex flex-col items-center gap-3 font-body-sm text-body-sm text-on-surface-variant">
          <Spinner className="size-6 text-primary" />
          Loading your account…
        </div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  const setupComplete = hasGroq && hasApify && resume;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-surface-container-low md:flex">
        <div className="px-6 pb-6 pt-8">
          <NavLink to="/app" className="flex items-center gap-2">
            <BrandLogo className="h-9 w-auto" />
          </NavLink>
        </div>

        <nav className="flex-1 space-y-1 px-4">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-label-md transition-colors ${
                  isActive
                    ? "bg-surface-container-high font-semibold text-primary"
                    : "text-on-surface-variant hover:bg-surface-container hover:text-primary"
                }`
              }
            >
              <Icon name={item.icon} size={20} filled />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-4 px-4 py-6">
          {!setupComplete && (
            <div className="rounded-lg border border-border-variant bg-surface-container-lowest p-3 text-body-sm text-on-surface-variant">
              <div className="mb-1.5 flex items-center gap-1.5 font-medium text-on-surface">
                <Icon name="flag" size={16} filled /> Set up
              </div>
              {!resume && <p className="py-0.5">1. Upload your resume</p>}
              {!hasGroq && <p className="py-0.5">2. Add your Groq key</p>}
              {!hasApify && <p className="py-0.5">3. Add your Apify token</p>}
            </div>
          )}

          <div className="border-t border-border-variant pt-4">
            <button
              onClick={toggleTheme}
              className="mb-3 flex w-full items-center gap-3 rounded-lg px-3 py-2 font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              <Icon name={theme === "dark" ? "light_mode" : "dark_mode"} size={20} filled />
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
            {signedIn && (
              <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-border-variant bg-surface-container-lowest px-3 py-2 font-body-sm text-body-sm text-on-surface-variant">
                {syncing ? (
                  <>
                    <Spinner className="size-4" /> Syncing…
                  </>
                ) : (
                  <>
                    <Icon name="cloud_done" size={16} filled className="text-success" />
                    Data synced
                  </>
                )}
              </div>
            )}
            <div className="flex items-center gap-3 px-1 py-1">
              <Avatar name={user.displayName ?? undefined} email={user.email ?? undefined} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-label-md font-semibold text-on-surface">
                  {user.displayName ?? "Signed in"}
                </div>
                <div className="truncate text-label-sm text-on-surface-variant">
                  {user.email}
                </div>
              </div>
              <button
                onClick={() => signOut()}
                className="grid size-8 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container hover:text-error"
                title="Sign out"
              >
                <Icon name="logout" size={18} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-border-variant bg-surface-container-lowest px-margin-mobile md:hidden">
        <NavLink to="/app" className="flex items-center gap-2">
          <BrandLogo className="h-8 w-auto" />
        </NavLink>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            className="grid size-9 place-items-center rounded-full text-on-surface-variant"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            <Icon name={theme === "dark" ? "light_mode" : "dark_mode"} size={22} filled />
          </button>
          <button
            onClick={() => navigate("/app/settings")}
            className="grid size-9 place-items-center rounded-full text-on-surface-variant"
            aria-label="Settings"
          >
            <Icon name="settings" size={22} />
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="min-w-0 flex-1 pb-24 pt-16 md:ml-64 md:pb-0 md:pt-0">
        <div className="mx-auto w-full max-w-(--container-app) px-margin-mobile py-6 md:px-margin-desktop md:py-10">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch border-t border-border-variant bg-surface-container-lowest md:hidden">
        {MOBILE_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center justify-center gap-1 text-label-sm ${
                isActive ? "text-primary" : "text-on-surface-variant"
              }`
            }
          >
            <Icon name={item.icon} size={22} filled />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
