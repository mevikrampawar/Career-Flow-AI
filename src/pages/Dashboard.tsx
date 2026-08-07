import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useKeys } from "../lib/keys";
import { useSync } from "../lib/sync";
import { useAppStore } from "../store/useAppStore";
import { timeAgoTs, jobKey } from "../lib/format";
import { STATUS_LABEL, STATUS_TONE } from "../lib/applications";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton, SkeletonRow, SkeletonText } from "../components/ui/Skeleton";
import { JobCard } from "../components/JobCard";

export default function Dashboard() {
  const { user } = useAuth();
  const { hasGroq, hasApify } = useKeys();
  const { syncing } = useSync();
  const resume = useAppStore((s) => s.resume);
  const savedJobs = useAppStore((s) => s.savedJobs);
  const applications = useAppStore((s) => s.applications);
  const scrapedJobs = useAppStore((s) => s.scrapedJobs);

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
  const replies = applications
    .filter((a) => a.lastReplyAt)
    .sort((a, b) => (b.lastReplyAt ?? 0) - (a.lastReplyAt ?? 0));

  const drafts = applications
    .filter((a) => a.status === "draft")
    .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt));
  const followUps = applications
    .filter((a) => a.status === "applied")
    .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt));

  const recent = [...applications]
    .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
    .slice(0, 5);

  const loaded =
    Boolean(resume) ||
    savedJobs.length > 0 ||
    applications.length > 0 ||
    scrapedJobs.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg-mobile text-on-surface md:font-headline-xl md:text-headline-xl">
            {user?.displayName
              ? `Welcome back, ${user.displayName.split(" ")[0]}.`
              : "Welcome to CareerFlow"}
          </h1>
          <p className="mt-2 font-body-md text-body-md text-on-surface-variant">
            Your job hunt at a glance — matches, applications, and what's next.
          </p>
        </div>
        <Link to="/app/jobs" className="inline-block">
          <Button>
            <Icon name="travel_explore" size={18} />
            Hunt jobs
          </Button>
        </Link>
      </header>

      {!setupComplete && !syncing && (
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

      {syncing && !loaded ? (
        <div className="flex flex-col gap-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-border-variant bg-surface-container-lowest p-6"
              >
                <SkeletonText width="w-20" />
                <Skeleton className="mt-3 h-8 w-12" />
                <Skeleton className="mt-4 h-4 w-28" />
              </div>
            ))}
          </div>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Scraped jobs"
              value={scrapedJobs.length}
              icon="folder_copy"
              note="Auto-saved archive"
              badge
              to="/app/scraped"
            />
            <Stat
              label="Saved jobs"
              value={savedJobs.length}
              icon="bookmark"
              note="Ready to apply"
              to="/app/saved"
            />
            <Stat
              label="Applications"
              value={applied}
              icon="send"
              note="Total submitted"
              to="/app/applications"
            />
            <Stat
              label="In progress"
              value={inProgress}
              icon="event_available"
              note="Interview or offer"
              highlight
              to="/app/applications"
            />
          </section>

          {applications.length === 0 ? (
            <EmptyState
              icon="work_history"
              title="Your pipeline is ready to fill"
              description="Apply to a saved job and it'll show up here with its status, prep notes, and cover letter — all in one place."
              action={
                <Link to="/app/jobs" className="inline-block">
                  <Button>
                    <Icon name="travel_explore" size={18} />
                    Hunt jobs
                  </Button>
                </Link>
              }
            />
          ) : (
            <>
              {(drafts.length > 0 || followUps.length > 0) && (
                <section>
                  <h2 className="mb-4 font-headline-md text-headline-md text-on-surface">
                    Next steps
                  </h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {replies.length > 0 && (
                      <NextStepCard
                        icon="mark_email_unread"
                        tone="warning"
                        title={`${replies.length} reply${replies.length > 1 ? "s" : ""} waiting`}
                        desc="Someone wrote back — read and respond."
                        to={`/app/apply/${encodeURIComponent(jobKey(replies[0].job))}`}
                        cta="Read reply"
                      />
                    )}
                    {drafts.length > 0 && (
                      <NextStepCard
                        icon="edit_note"
                        tone="info"
                        title={`${drafts.length} draft${drafts.length > 1 ? "s" : ""} waiting`}
                        desc="You've started prep — finish it and hit apply."
                        to={`/app/apply/${encodeURIComponent(jobKey(drafts[0].job))}`}
                        cta="Finish & apply"
                      />
                    )}
                    {followUps.length > 0 && (
                      <NextStepCard
                        icon="schedule_send"
                        tone="warning"
                        title={`${followUps.length} applied, no reply yet`}
                        desc="Follow up or move them forward."
                        to={`/app/apply/${encodeURIComponent(jobKey(followUps[0].job))}`}
                        cta="Advance"
                      />
                    )}
                    {drafts.length === 0 && followUps.length === 0 && replies.length === 0 && (
                      <NextStepCard
                        icon="celebration"
                        tone="success"
                        title="You're all caught up"
                        desc="Nothing pending — find more roles or take a break."
                        to="/app/applications"
                        cta="View pipeline"
                      />
                    )}
                  </div>
                </section>
              )}

              {recent.length > 0 && (
                <section>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-headline-md text-headline-md text-on-surface">
                      Recent activity
                    </h2>
                    <Link
                      to="/app/applications"
                      className="inline-flex items-center gap-1 font-label-md text-label-md text-primary hover:underline"
                    >
                      View all
                      <Icon name="arrow_forward" size={16} />
                    </Link>
                  </div>
                  <div className="space-y-3">
                    {recent.map((app) => (
                      <Link
                        key={app.id}
                        to={`/app/apply/${encodeURIComponent(jobKey(app.job))}`}
                        className="flex items-center gap-4 rounded-xl border border-variant bg-surface-container-lowest p-4 transition-all hover:border-outline-variant hover:card-shadow"
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-variant bg-surface-container font-label-md text-label-md font-bold text-primary">
                          {app.job.company.charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-body-md text-body-md font-semibold text-on-surface">
                            {app.job.title}
                          </span>
                          <span className="block truncate font-body-sm text-body-sm text-on-surface-variant">
                            {app.job.company} · updated {timeAgoTs(app.updatedAt ?? app.createdAt)}
                          </span>
                        </span>
                        <Badge tone={STATUS_TONE[app.status]} dot>
                          {STATUS_LABEL[app.status]}
                        </Badge>
                        <Icon name="chevron_right" size={18} className="text-outline-variant" />
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {topJobs.length > 0 && (
            <section>
              <div className="mb-6 flex items-center justify-between">
                <h2 className="font-headline-md text-headline-md text-on-surface">
                  Best matches
                </h2>
                <Link
                  to="/app/saved"
                  className="inline-flex items-center gap-1 font-label-md text-label-md text-primary hover:underline"
                >
                  View all
                  <Icon name="arrow_forward" size={16} />
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                {topJobs.map((job) => (
                  <JobCard key={jobKey(job)} job={job} saved />
                ))}
              </div>
            </section>
          )}

          {!resume && (
            <EmptyState
              icon="description"
              title="No resume yet"
              description="Upload one to unlock AI matching, tailored summaries, and cover letters."
              action={
                <Link to="/app/resume" className="inline-block">
                  <Button>
                    <Icon name="upload_file" size={18} />
                    Upload resume
                  </Button>
                </Link>
              }
            />
          )}
        </>
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
  to,
}: {
  label: string;
  value: number;
  icon: string;
  note: string;
  badge?: boolean;
  highlight?: boolean;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="group relative flex flex-col gap-4 overflow-hidden rounded-xl border border-variant bg-surface-container-lowest p-6 transition-all hover:-translate-y-1 hover:border-outline-variant hover:card-shadow"
    >
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
        <Icon
          name="arrow_forward"
          size={14}
          className="ml-auto text-outline-variant transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
        />
      </div>
      <div className="absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-primary opacity-5 blur-xl transition-transform duration-500 group-hover:scale-110" />
    </Link>
  );
}

function NextStepCard({
  icon,
  tone,
  title,
  desc,
  to,
  cta,
}: {
  icon: string;
  tone: "info" | "warning" | "success";
  title: string;
  desc: string;
  to: string;
  cta: string;
}) {
  const toneCls: Record<typeof tone, string> = {
    info: "bg-secondary-fixed text-secondary",
    warning: "bg-warning-container text-warning",
    success: "bg-success-container text-on-success-container",
  };
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 rounded-xl border border-variant bg-surface-container-lowest p-5 transition-all hover:border-outline-variant hover:card-shadow"
    >
      <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${toneCls[tone]}`}>
        <Icon name={icon} size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-body-md text-body-md font-semibold text-on-surface">
          {title}
        </span>
        <span className="block truncate font-body-sm text-body-sm text-on-surface-variant">
          {desc}
        </span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 font-label-sm text-label-sm text-primary">
        {cta}
        <Icon
          name="arrow_forward"
          size={14}
          className="transition-transform group-hover:translate-x-0.5"
        />
      </span>
    </Link>
  );
}
