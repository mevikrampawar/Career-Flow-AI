import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import type { Application } from "../lib/types";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Icon } from "../components/ui/Icon";
import { Modal } from "../components/ui/Modal";
import { Select, Textarea } from "../components/ui/Input";
import { useToast } from "../components/ui/Toast";

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
  const [notesDraft, setNotesDraft] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const { push } = useToast();

  const shown = filter === "all" ? applications : applications.filter((a) => a.status === filter);
  const open = applications.find((a) => a.id === openId) ?? null;

  function openDetails(app: Application) {
    setNotesDraft(app.notes ?? "");
    setNotesSaved(false);
    setOpenId(app.id);
  }

  function saveNotes() {
    if (!open) return;
    updateApplication(open.id, { notes: notesDraft.trim() || undefined });
    setNotesSaved(true);
    push("success", "Notes saved.");
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg-mobile text-on-surface md:font-headline-xl md:text-headline-xl">
            Applications
          </h1>
          <p className="mt-2 font-body-md text-body-md text-on-surface-variant">
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
        <Card className="flex flex-col items-center justify-center gap-4 p-10 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-surface-container-low">
            <Icon name="work_history" size={32} className="text-primary" />
          </span>
          <p className="font-body-md text-body-md text-on-surface-variant">
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
              <Card key={app.id} className="p-4 transition-shadow hover:card-shadow">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-variant bg-surface-container font-label-md text-label-md font-bold text-primary">
                    {app.job.company.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-body-md text-body-md font-semibold text-on-surface">
                      {app.job.title}
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      {app.job.company} · {fmt(app.appliedAt ?? app.createdAt)}
                    </p>
                  </div>
                  <Badge tone={st.tone} dot>
                    {st.label}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => openDetails(app)}>
                      Details
                    </Button>
                    {app.status !== "offer" && app.status !== "rejected" && app.status !== "closed" && (
                      <Button
                        size="sm"
                        onClick={() => updateApplication(app.id, { status: NEXT[app.status] })}
                      >
                        {app.status === "draft" ? "Mark applied" : "Advance"}
                        <Icon name="arrow_forward" size={14} />
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
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                {open.job.company} · applied {fmt(open.appliedAt)}
              </span>
              {open.job.url && (
                <a href={open.job.url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 font-label-sm text-label-sm text-primary hover:underline">
                  Open posting
                  <Icon name="arrow_outward" size={14} />
                </a>
              )}
            </div>
            {open.tailoredHighlights && (
              <div>
                <h4 className="font-label-sm text-label-sm uppercase tracking-wide text-on-surface-variant">
                  Tailored highlights
                </h4>
                <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-surface-container-low px-4 py-3 font-mono text-body-sm text-on-surface">
                  {open.tailoredHighlights}
                </pre>
              </div>
            )}
            {open.coverLetter && (
              <div>
                <h4 className="font-label-sm text-label-sm uppercase tracking-wide text-on-surface-variant">
                  Cover letter
                </h4>
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-container-low px-4 py-3 font-mono text-body-sm text-on-surface">
                  {open.coverLetter}
                </pre>
              </div>
            )}
            <div>
              <h4 className="font-label-sm text-label-sm uppercase tracking-wide text-on-surface-variant">
                Notes
              </h4>
              <Textarea
                value={notesDraft}
                onChange={(e) => {
                  setNotesDraft(e.target.value);
                  setNotesSaved(false);
                }}
                placeholder="Interview prep, contacts, follow-ups…"
                className="mt-2 min-h-24"
              />
              <div className="mt-2 flex items-center justify-end gap-2">
                {notesSaved && (
                  <span className="font-body-sm text-body-sm text-on-surface-variant">Saved</span>
                )}
                <Button size="sm" onClick={saveNotes}>
                  Save notes
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
