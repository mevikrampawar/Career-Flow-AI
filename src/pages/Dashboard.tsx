import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useKeys } from "../lib/keys";
import { useAppStore } from "../store/useAppStore";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
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
    <div className="space-y-6">
      <div>
        <h1 className="text-headline-lg text-on-surface">
          {user?.displayName ? `Welcome back, ${user.displayName.split(" ")[0]}` : "Dashboard"}
        </h1>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          Your automated job hunt at a glance.
        </p>
      </div>

      {!setupComplete && (
        <Card className="p-5">
          <CardHeader
            title="Set up your pipeline"
            subtitle="Three quick steps and you're hunting."
          />
          <div className="mt-2 space-y-2 px-5 pb-5">
            {checks.map((c) => (
              <Link
                key={c.label}
                to={c.href}
                className="flex items-center gap-3 rounded-sm px-3 py-2.5 hover:bg-surface-container"
              >
                <span
                  className={`grid size-5 place-items-center rounded-full border text-label-sm ${
                    c.done
                      ? "border-success bg-success-container text-on-success-container"
                      : "border-outline-variant text-on-surface-variant"
                  }`}
                >
                  {c.done ? "✓" : "·"}
                </span>
                <span
                  className={
                    c.done
                      ? "text-body-md text-on-surface-variant line-through"
                      : "text-body-md text-on-surface"
                  }
                >
                  {c.label}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Saved jobs" value={savedJobs.length} />
        <Stat label="Applications" value={applied} />
        <Stat label="In progress" value={inProgress} />
      </div>

      {topJobs.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-headline-md text-on-surface">Best matches</h2>
            <Link to="/app/jobs">
              <Button variant="ghost" size="sm">
                Find more →
              </Button>
            </Link>
          </div>
          <div className="space-y-4">
            {topJobs.map((job) => (
              <JobCard key={job.id} job={job} saved />
            ))}
          </div>
        </section>
      )}

      {!resume && (
        <Card className="p-5 text-center">
          <p className="text-body-md text-on-surface-variant">
            No resume yet. Upload one to unlock AI matching.
          </p>
          <Link to="/app/resume" className="mt-4 inline-block">
            <Button>Upload resume</Button>
          </Link>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-5">
      <div className="text-headline-lg font-semibold text-on-surface">
        {value}
      </div>
      <Badge tone="neutral">{label}</Badge>
    </Card>
  );
}
