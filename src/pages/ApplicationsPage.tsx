import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";
import {
  STATUS_LABEL,
  STATUS_TONE,
  NEXT_STATUS,
} from "../lib/applications";
import type { Application } from "../lib/types";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Icon } from "../components/ui/Icon";
import { Modal } from "../components/ui/Modal";
import { Select } from "../components/ui/Input";
import { useToast } from "../components/ui/Toast";
import { jobKey } from "../lib/format";

function fmt(ts?: number) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function ApplicationsPage() {
  const navigate = useNavigate();
  const applications = useAppStore((s) => s.applications);
  const updateApplication = useAppStore((s) => s.updateApplication);
  const removeApplication = useAppStore((s) => s.removeApplication);
  const { push } = useToast();

  const [filter, setFilter] = useState<Application["status"] | "all">("all");
  const [removing, setRemoving] = useState<Application | null>(null);

  const shown = filter === "all" ? applications : applications.filter((a) => a.status === filter);

  const terminal: Application["status"][] = ["offer", "rejected", "closed"];

  function advance(app: Application) {
    const next = NEXT_STATUS[app.status];
    if (next === app.status) return;
    updateApplication(app.id, { status: next });
    push("success", `Moved to ${STATUS_LABEL[next]}.`);
  }

  function confirmRemove() {
    if (!removing) return;
    removeApplication(removing.id);
    push("success", "Application removed.");
    setRemoving(null);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg-mobile text-on-surface md:font-headline-xl md:text-headline-xl">
            Applications
          </h1>
          <p className="mt-2 font-body-md text-body-md text-on-surface-variant">
            Track every application from draft to offer. Click a row to prep & take notes.
          </p>
        </div>
        <Select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="w-44"
        >
          <option value="all">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon="work_history"
          title={applications.length === 0 ? "No applications yet" : "Nothing here"}
          description={
            applications.length === 0
              ? "Save jobs and hit Apply to start tracking. Your prep, cover letters, notes, and progress all live here in one place."
              : "No applications match this filter yet."
          }
          action={
            applications.length === 0 ? (
              <Link to="/app/jobs" className="inline-block">
                <Button>
                  <Icon name="travel_explore" size={18} />
                  Hunt jobs
                </Button>
              </Link>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setFilter("all")}>
                Show all applications
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          {shown.map((app) => {
            const st = STATUS_TONE[app.status];
            const next = NEXT_STATUS[app.status];
            const advanceable = !terminal.includes(app.status) && next !== app.status;
            return (
              <Card
                key={app.id}
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("button, a, input, select, textarea")) return;
                  navigate(`/app/apply/${encodeURIComponent(jobKey(app.job))}`);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/app/apply/${encodeURIComponent(jobKey(app.job))}`);
                  }
                }}
                className="group cursor-pointer p-4 transition-all hover:-translate-y-0.5 hover:card-shadow"
              >
                <div className="flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/app/apply/${encodeURIComponent(jobKey(app.job))}`);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-4 text-left"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-border-variant bg-surface-container font-label-md text-label-md font-bold text-primary">
                      {app.job.company.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-body-md text-body-md font-semibold text-on-surface">
                        {app.job.title}
                      </span>
                  <span className="block truncate font-body-sm text-body-sm text-on-surface-variant">
                    {app.job.company} · {fmt(app.appliedAt ?? app.createdAt)}
                    {app.notes ? " · has notes" : ""}
                    {app.tailoredHighlights || app.coverLetter ? " · has prep" : ""}
                  </span>
                </span>
              </button>
              <div className="flex items-center gap-2">
                {app.lastReplyAt && (
                  <span
                    className="inline-flex items-center gap-1 font-label-sm text-label-sm text-warning"
                    title={`Reply received ${new Date(app.lastReplyAt).toLocaleString()}`}
                  >
                    <Icon name="mark_email_unread" size={16} filled />
                    Reply
                  </span>
                )}
                <Badge tone={st} dot>
                  {STATUS_LABEL[app.status]}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                    {advanceable && (
                      <Button size="sm" onClick={() => advance(app)}>
                        {app.status === "draft" ? "Mark applied" : "Advance"}
                        <Icon name="arrow_forward" size={14} />
                      </Button>
                    )}
                    {app.emailDraft && (
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(app.emailDraft!);
                          push("success", "Drafted email copied to clipboard.");
                        }}
                        aria-label="Copy drafted email"
                        className="grid size-8 place-items-center rounded-lg text-on-surface-variant transition-colors hover:bg-primary-fixed hover:text-on-primary-fixed"
                      >
                        <Icon name="content_copy" size={18} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setRemoving(app)}
                      aria-label="Remove application"
                      className="grid size-8 place-items-center rounded-lg text-on-surface-variant transition-colors hover:bg-error-container/40 hover:text-error"
                    >
                      <Icon name="delete" size={18} />
                    </button>
                    <Icon
                      name="chevron_right"
                      size={18}
                      className="hidden text-outline-variant transition-transform group-hover:translate-x-0.5 sm:block"
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title="Remove application?"
      >
        {removing && (
          <div className="space-y-5">
            <p className="font-body-md text-body-md text-on-surface-variant">
              Remove the application record for{" "}
              <span className="font-medium text-on-surface">{removing.job.title}</span> at{" "}
              {removing.job.company}? Your saved job stays untouched, so you can apply again
              anytime.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRemoving(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmRemove}>
                <Icon name="delete" size={16} />
                Remove
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
