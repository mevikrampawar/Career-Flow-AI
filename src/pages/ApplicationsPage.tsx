import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import type { Application } from "../lib/types";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { Select } from "../components/ui/Input";

const STATUS: Record<Application["status"], { label: string; tone: "neutral" | "success" | "warning" | "error" | "info" }> = {
  draft: { label: "Draft", tone: "neutral" },
  applied: { label: "Applied", tone: "info" },
  interview: { label: "Interview", tone: "warning" },
  offer: { label: "Offer", tone: "success" },
  rejected: { label: "Rejected", tone: "error" },
  closed: { label: "Closed", tone: "neutral" },
};

const NEXT: Record<Application["status"], Application["status"]> = {
  draft: "applied",
  applied: "interview",
  interview: "offer",
  offer: "offer",
  rejected: "rejected",
  closed: "closed",
};

function fmt(ts?: number) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function ApplicationsPage() {
  const applications = useAppStore((s) => s.applications);
  const updateApplication = useAppStore((s) => s.updateApplication);
  const [filter, setFilter] = useState<Application["status"] | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const shown = filter === "all" ? applications : applications.filter((a) => a.status === filter);
  const open = applications.find((a) => a.id === openId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-headline-lg text-on-surface">Applications</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Track every application from draft to offer.
          </p>
        </div>
        <Select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="w-44"
        >
          <option value="all">All statuses</option>
          {Object.entries(STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </Select>
      </div>

      {shown.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-body-md text-on-surface-variant">
            {applications.length === 0
              ? "No applications yet. Save jobs and hit Apply to start tracking."
              : "Nothing matches this filter."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {shown.map((app) => {
            const st = STATUS[app.status];
            return (
              <Card key={app.id} className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-body-md font-semibold text-on-surface">
                      {app.job.title}
                    </h3>
                    <p className="text-body-sm text-on-surface-variant">
                      {app.job.company} · {fmt(app.appliedAt ?? app.createdAt)}
                    </p>
                  </div>
                  <Badge tone={st.tone} dot>
                    {st.label}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setOpenId(app.id)}>
                      Details
                    </Button>
                    {app.status !== "offer" && app.status !== "rejected" && app.status !== "closed" && (
                      <Button
                        size="sm"
                        onClick={() => updateApplication(app.id, { status: NEXT[app.status] })}
                      >
                        {app.status === "draft" ? "Mark applied" : "Advance →"}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={Boolean(open)} onClose={() => setOpenId(null)} title={open?.job.title ?? ""} wide>
        {open && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={STATUS[open.status].tone} dot>
                {STATUS[open.status].label}
              </Badge>
              <span className="text-body-sm text-on-surface-variant">
                {open.job.company} · applied {fmt(open.appliedAt)}
              </span>
              {open.job.url && (
                <a href={open.job.url} target="_blank" rel="noreferrer" className="ml-auto text-label-sm text-primary hover:underline">
                  Open posting ↗
                </a>
              )}
            </div>
            {open.tailoredHighlights && (
              <div>
                <h4 className="text-label-sm uppercase text-on-surface-variant">Tailored highlights</h4>
                <pre className="mt-2 whitespace-pre-wrap rounded-sm bg-surface-container-low px-3 py-2 font-mono text-body-sm text-on-surface">
                  {open.tailoredHighlights}
                </pre>
              </div>
            )}
            {open.coverLetter && (
              <div>
                <h4 className="text-label-sm uppercase text-on-surface-variant">Cover letter</h4>
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-sm bg-surface-container-low px-3 py-2 font-mono text-body-sm text-on-surface">
                  {open.coverLetter}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
