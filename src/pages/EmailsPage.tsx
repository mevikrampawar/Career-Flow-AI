import { Link, useNavigate } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";
import { jobKey } from "../lib/format";
import type { Application } from "../lib/types";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";

type EmailStatus = "sent" | "draft" | "waiting" | "replied" | "discovered";

const STATUS_META: Record<EmailStatus, { label: string; tone: "neutral" | "info" | "warning" | "success"; icon: string }> = {
  sent: { label: "Sent", tone: "info", icon: "send" },
  draft: { label: "Draft · not sent", tone: "neutral", icon: "edit_note" },
  waiting: { label: "Waiting for reply", tone: "warning", icon: "schedule_send" },
  replied: { label: "Replied", tone: "success", icon: "mark_email_read" },
  discovered: { label: "Emails found · no application", tone: "info", icon: "mail" },
};

const STATUS_ORDER: EmailStatus[] = ["replied", "waiting", "sent", "draft", "discovered"];

function fmt(ts?: number) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface EmailRow {
  key: string;
  title: string;
  company: string;
  emails: string[];
  status: EmailStatus;
  sentAt?: number;
  repliedAt?: number;
}

export default function EmailsPage() {
  const navigate = useNavigate();
  const applications = useAppStore((s) => s.applications);
  const savedJobs = useAppStore((s) => s.savedJobs);
  const searchJobs = useAppStore((s) => s.searchJobs);
  const scrapedJobs = useAppStore((s) => s.scrapedJobs);

  const sent = applications.filter((a) => a.sentAt).length;
  const replied = applications.filter((a) => a.lastReplyAt).length;
  const waiting = applications.filter((a) => a.sentAt && !a.lastReplyAt).length;
  const drafts = applications.filter(
    (a) => !a.sentAt && (a.emails?.length || a.emailDraft),
  ).length;

  const appByKey = new Map<string, Application>();
  for (const a of applications) appByKey.set(jobKey(a.job), a);

  const rows = new Map<string, Omit<EmailRow, "status" | "sentAt" | "repliedAt">>();
  const addRow = (key: string, title: string, company: string, emails: string[], allowEmpty = false) => {
    if (!emails.length && !allowEmpty) return;
    const existing = rows.get(key);
    if (existing) {
      existing.emails = [...new Set([...existing.emails, ...emails])];
      return;
    }
    rows.set(key, { key, title, company, emails });
  };

  for (const a of applications) {
    const emails = a.emails?.length ? a.emails : [];
    addRow(jobKey(a.job), a.job.title, a.job.company, emails, true);
  }
  for (const job of savedJobs) addRow(jobKey(job), job.title, job.company, job.emails ?? []);
  for (const job of searchJobs) addRow(jobKey(job), job.title, job.company, job.emails ?? []);
  for (const job of scrapedJobs) addRow(jobKey(job), job.title, job.company, job.emails ?? []);

  const list: EmailRow[] = [];
  for (const row of rows.values()) {
    const app = appByKey.get(row.key);
    let status: EmailStatus;
    if (app?.lastReplyAt) status = "replied";
    else if (app?.sentAt) status = "waiting";
    else if (app) status = "draft";
    else status = "discovered";
    list.push({
      ...row,
      status,
      sentAt: app?.sentAt,
      repliedAt: app?.lastReplyAt,
    });
  }
  list.sort((a, b) => {
    const aOrd = STATUS_ORDER.indexOf(a.status);
    const bOrd = STATUS_ORDER.indexOf(b.status);
    if (aOrd !== bOrd) return aOrd - bOrd;
    return (b.sentAt ?? b.repliedAt ?? 0) - (a.sentAt ?? a.repliedAt ?? 0);
  });

  const discovered = list.filter((r) => r.status === "discovered").length;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg-mobile text-on-surface md:font-headline-xl md:text-headline-xl">
            Email automation
          </h1>
          <p className="mt-2 font-body-md text-body-md text-on-surface-variant">
            Every contact email across your jobs — what's sent, drafted, and waiting on a reply.
          </p>
        </div>
        {discovered > 0 && (
          <Link to="/app/applications" className="inline-block">
            <Button>
              <Icon name="forward_to_inbox" size={18} />
              Open applications
            </Button>
          </Link>
        )}
      </header>

      <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Sent" value={sent} icon="send" tone="info" note="Emails delivered" />
        <Stat label="Drafts" value={drafts} icon="edit_note" tone="neutral" note="Written, not sent" />
        <Stat label="Waiting on reply" value={waiting} icon="schedule_send" tone="warning" note="Sent, no reply yet" />
        <Stat label="Replied" value={replied} icon="mark_email_read" tone="success" note="Someone wrote back" />
      </section>

      {list.length === 0 ? (
        <EmptyState
          icon="mail"
          title="No contact emails yet"
          description="When a job scrape or your saved roles surface a contact email, it shows up here with its send status. Add emails from the Apply page for any job."
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
        <div className="space-y-3">
          {list.map((row) => {
            const meta = STATUS_META[row.status];
            return (
              <div
                key={row.key}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/app/apply/${encodeURIComponent(row.key)}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/app/apply/${encodeURIComponent(row.key)}`);
                  }
                }}
                className="group flex cursor-pointer flex-wrap items-center gap-4 rounded-xl border border-border-variant bg-surface-container-lowest p-4 transition-all hover:-translate-y-0.5 hover:border-outline-variant hover:card-shadow"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-border-variant bg-surface-container font-label-md text-label-md font-bold text-primary">
                  {row.company.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-body-md text-body-md font-semibold text-on-surface">
                    {row.title}
                  </span>
                  <span className="block truncate font-body-sm text-body-sm text-on-surface-variant">
                    {row.company}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    {row.emails.length > 0 ? (
                      row.emails.map((email) => (
                        <span
                          key={email}
                          className="inline-flex max-w-full items-center gap-1 truncate rounded-md border border-border-variant/50 bg-surface px-2 py-0.5 font-body-sm text-body-sm text-primary"
                        >
                          <Icon name="mail" size={14} />
                          <span className="truncate">{email}</span>
                        </span>
                      ))
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 font-body-sm text-body-sm text-on-surface-variant">
                        <Icon name="add_link" size={14} />
                        No address yet
                      </span>
                    )}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {row.sentAt && (
                    <span className="hidden font-body-sm text-body-sm text-on-surface-variant sm:inline">
                      Sent {fmt(row.sentAt)}
                    </span>
                  )}
                  <Badge tone={meta.tone} dot>
                    {meta.label}
                  </Badge>
                  <Icon name="chevron_right" size={18} className="text-outline-variant transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  tone,
  note,
}: {
  label: string;
  value: number;
  icon: string;
  tone: "neutral" | "info" | "warning" | "success";
  note: string;
}) {
  const toneCls: Record<typeof tone, string> = {
    neutral: "bg-surface-container-highest text-on-surface-variant",
    info: "bg-secondary-fixed text-on-secondary-fixed",
    warning: "bg-warning-container text-warning",
    success: "bg-success-container text-on-success-container",
  };
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border-variant bg-surface-container-lowest p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
            {label}
          </p>
          <h3 className="mt-1 font-headline-lg text-headline-lg text-on-surface">{value}</h3>
        </div>
        <span className={`grid size-10 place-items-center rounded-full ${toneCls[tone]}`}>
          <Icon name={icon} size={22} />
        </span>
      </div>
      <p className="mt-auto font-body-sm text-body-sm text-on-surface-variant">{note}</p>
    </div>
  );
}
