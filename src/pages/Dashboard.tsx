import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useKeys } from "../lib/keys";
import { useAppStore } from "../store/useAppStore";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { JobCard } from "../components/JobCard";

export default function Dashboard() {
  const { user } = useAuth();
  const { hasGroq, hasApify } = useKeys();
  const resume = useAppStore((s) => s.resume);
  const savedJobs = useAppStore((s) => s.savedJobs);
  const applications = useAppStore((s) => s.applications);

  const checks = [
    { done: Boolean(resume), label: "Upload your resume", href: "/app/resume" },
    { done: hasGroq, label: "Add your Groq API key", href: "/app/settings" },
    { done: hasApify, label: "Add your Apify API token", href: "/app/settings" },
  ];
  const pending = checks.filter((c) => !c.done);
  const setupComplete = pending.length === 0;

  const topJobs = [...savedJobs]
    .filter((j) => j.matchScore !== undefined)
    .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
    .slice(0, 3);

  const applied = applications.filter((a) => a.status !== "draft").length;
  const inProgress = applications.filter((a) =>
    ["interview", "offer"].includes(a.status),
  ).length;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">
          {user?.displayName
            ? `Welcome back, ${user.displayName.split(" ")[0]}.`
            : "Welcome to CareerFlow"}
        </h1>
        <p className="mt-2 font-body-md text-body-md text-on-surface-variant">
          Your automated job hunt at a glance.
        </p>
      </header>

      {!setupComplete && (
        <section className="rounded-xl border border-variant bg-surface-container-lowest p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface">
                Set up your pipeline
              </h2>
              <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
                Three quick steps and you're hunting.
              </p>
            </div>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              {pending.length} remaining
            </span>
          </div>
          <div className="mt-4 divide-y divide-variant/60">
            {checks.map((c) => (
              <Link
                key={c.label}
                to={c.href}
                className="flex items-center gap-3 py-3 transition-colors hover:bg-surface-container-low"
              >
                <Icon
                  name={c.done ? "check_circle" : "radio_button_unchecked"}
                  filled={c.done}
                  className={c.done ? "text-success" : "text-outline-variant"}
                  size={22}
                />
                <span
                  className={
                    c.done
                      ? "font-body-md text-body-md text-on-surface-variant line-through"
                      : "font-body-md text-body-md text-on-surface"
                  }
                >
                  {c.label}
                </span>
                <Icon name="chevron_right" size={18} className="ml-auto text-outline-variant" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label="Saved jobs"
          value={savedJobs.length}
          icon="bookmark"
          note="Top matches ready"
          badge
        />
        <Stat
          label="Applications"
          value={applied}
          icon="send"
          note="Total submitted"
        />
        <Stat
          label="In progress"
          value={inProgress}
          icon="event_available"
          note="Interview or offer"
          highlight
        />
      </section>

      {topJobs.length > 0 && (
        <section>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-headline-md text-headline-md text-on-surface">
              Best matches
            </h2>
            <Link
              to="/app/jobs"
              className="inline-flex items-center gap-1 font-label-md text-label-md text-primary hover:underline"
            >
              View all
              <Icon name="arrow_forward" size={16} />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {topJobs.map((job) => (
              <JobCard key={job.id} job={job} saved />
            ))}
          </div>
        </section>
      )}

      {!resume && (
        <section className="flex flex-col items-center justify-center gap-4 rounded-xl border border-variant bg-surface-container-lowest p-8 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-surface-container-low">
            <Icon name="description" size={32} className="text-primary" />
          </span>
          <div>
            <p className="font-headline-md text-headline-md text-on-surface">
              No resume yet
            </p>
            <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
              Upload one to unlock AI matching.
            </p>
          </div>
          <Link to="/app/resume" className="mt-2 inline-block">
            <Button>
              <Icon name="upload_file" size={18} />
              Upload resume
            </Button>
          </Link>
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  note,
  badge = false,
  highlight = false,
}: {
  label: string;
  value: number;
  icon: string;
  note: string;
  badge?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="group relative flex flex-col gap-4 overflow-hidden rounded-xl border border-variant bg-surface-container-lowest p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
            {label}
          </p>
          <h3 className="mt-1 font-headline-lg text-headline-lg text-on-surface">{value}</h3>
        </div>
        <span
          className={`grid size-10 place-items-center rounded-full ${
            highlight ? "bg-secondary-fixed text-secondary" : "bg-primary-fixed text-primary"
          }`}
        >
          <Icon name={icon} size={22} />
        </span>
      </div>
      <div className="mt-auto flex items-center gap-2">
        {badge && (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-highest px-2 py-1 font-label-sm text-label-sm text-primary">
            <Icon name="trending_up" size={14} />
            {value > 0 ? `+${value}` : "0"}
          </span>
        )}
        <span className="font-body-sm text-body-sm text-on-surface-variant">{note}</span>
      </div>
      <div className="absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-primary opacity-5 blur-xl transition-transform duration-500 group-hover:scale-110" />
    </div>
  );
}
