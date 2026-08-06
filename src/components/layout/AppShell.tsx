import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { useKeys } from "../../lib/keys";
import { useAppStore } from "../../store/useAppStore";
import { Button } from "../ui/Button";

const NAV = [
  { to: "/app", label: "Dashboard", icon: "◧", end: true },
  { to: "/app/resume", label: "Resume", icon: "▤" },
  { to: "/app/jobs", label: "Jobs", icon: "⌕" },
  { to: "/app/applications", label: "Applications", icon: "✓" },
  { to: "/app/settings", label: "Settings", icon: "⚙" },
];

function Avatar({ name, email }: { name?: string; email?: string }) {
  const letter = (name ?? email ?? "?").charAt(0).toUpperCase();
  return (
    <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-container text-label-md font-semibold text-on-primary">
      {letter}
    </div>
  );
}

export default function AppShell() {
  const { user, signOut } = useAuth();
  const { hasGroq, hasApify } = useKeys();
  const resume = useAppStore((s) => s.resume);
  const navigate = useNavigate();

  const setupComplete = hasGroq && hasApify && resume;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-outline-variant/60 bg-surface-container-lowest">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="grid size-8 place-items-center rounded-sm bg-primary-container text-sm font-semibold text-on-primary">
            CF
          </div>
          <div>
            <div className="text-label-md font-semibold text-on-surface">
              Career Flow
            </div>
            <div className="text-label-sm text-on-surface-variant">AI</div>
          </div>
        </div>

        <nav className="mt-2 flex-1 space-y-1 px-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-sm px-3 py-2.5 text-body-sm transition-colors ${
                  isActive
                    ? "bg-primary-container/12 font-medium text-primary"
                    : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                }`
              }
            >
              <span className="w-4 text-center" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}

          {!setupComplete && (
            <div className="mt-4 mx-1 rounded-sm border border-outline-variant/70 bg-surface-container-low px-3 py-2.5 text-body-sm text-on-surface-variant">
              {!resume && <p className="mb-1.5">1. Upload your resume</p>}
              {!hasGroq && <p className="mb-1.5">2. Add your Groq key</p>}
              {!hasApify && <p className="mb-1.5">3. Add your Apify token</p>}
              {setupComplete && <p className="text-success">All set 🎉</p>}
            </div>
          )}
        </nav>

        <div className="border-t border-outline-variant/60 p-3">
          {user ? (
            <div className="flex items-center gap-2.5 px-1.5 py-1">
              <Avatar name={user.displayName ?? undefined} email={user.email ?? undefined} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-body-sm font-medium text-on-surface">
                  {user.displayName ?? "Signed in"}
                </div>
                <div className="truncate text-label-sm text-on-surface-variant">
                  {user.email}
                </div>
              </div>
              <button
                onClick={() => signOut()}
                className="text-label-sm text-on-surface-variant hover:text-error"
                title="Sign out"
              >
                ⎋
              </button>
            </div>
          ) : (
            <div className="px-1.5">
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={() => navigate("/signin")}
              >
                Sign in
              </Button>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="ml-60 min-w-0 flex-1 px-6 py-6 lg:px-10">
        <div className="mx-auto w-full max-w-(--container-app)">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
