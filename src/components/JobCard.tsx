import { useState } from "react";
import { Link } from "react-router-dom";
import type { JobPosting } from "../lib/types";
import { useAppStore } from "../store/useAppStore";
import { stripHtml, timeAgo, scrapedAgo, mailtoHref, jobKey } from "../lib/format";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";
import { Badge } from "./ui/Badge";
import { Input } from "./ui/Input";
import { Modal } from "./ui/Modal";
import { MatchScore } from "./MatchScore";
import { useToast } from "./ui/Toast";

const BOARD_ICON: Record<JobPosting["board"], string> = {
  linkedin: "linked_services",
  indeed: "work",
  workable: "business_center",
};

const BOARD_LABEL: Record<JobPosting["board"], string> = {
  linkedin: "LinkedIn",
  indeed: "Indeed",
  workable: "Workable",
};

interface MetaChip {
  icon: string;
  label?: string;
}

function JobMetaChips({ job }: { job: JobPosting }) {
  const chips: MetaChip[] = [
    { icon: "location_on", label: job.location },
    { icon: "calendar_today", label: timeAgo(job.postedAt) },
    { icon: "schedule", label: job.employmentType },
    { icon: "payments", label: job.salary },
    { icon: "category", label: job.department },
    { icon: "school", label: job.experienceLevel },
    { icon: "work_history", label: job.jobFunction },
    { icon: "public", label: job.remote ? "Remote" : undefined },
    { icon: "history", label: scrapedAgo(job.scrapedAt) },
  ].filter((c) => c.label);

  if (chips.length === 0 && !job.emails?.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <span
          key={chip.icon}
          className="inline-flex items-center gap-1 rounded-md border border-border-variant/50 bg-surface px-2 py-1 text-body-sm text-on-surface-variant"
        >
          <Icon name={chip.icon} size={16} />
          {chip.label}
        </span>
      ))}
      {job.emails?.map((email) => (
        <a
          key={email}
          href={`mailto:${email}`}
          className="inline-flex items-center gap-1 rounded-md border border-border-variant/50 bg-surface px-2 py-1 text-body-sm text-primary hover:bg-surface-container-low"
          title={email}
        >
          <Icon name="mail" size={16} />
          <span className="max-w-48 truncate">{email}</span>
        </a>
      ))}
    </div>
  );
}

function JobDetail({ icon, label, value }: { icon: string; label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <Icon name={icon} size={18} className="mt-0.5 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="text-label-sm uppercase tracking-wide text-on-surface-variant">
          {label}
        </p>
        <p className="text-body-sm text-on-surface">{value}</p>
      </div>
    </div>
  );
}

export function JobCard({
  job,
  saved = false,
  alreadyScraped = false,
  onSave,
  onUnsave,
  onMatch,
  matching = false,
}: {
  job: JobPosting;
  saved?: boolean;
  alreadyScraped?: boolean;
  onSave?: (job: JobPosting) => void;
  onUnsave?: (jobId: string) => void;
  onMatch?: (job: JobPosting) => void;
  matching?: boolean;
}) {
  const ensureApplication = useAppStore((s) => s.ensureApplication);
  const applications = useAppStore((s) => s.applications);
  const resume = useAppStore((s) => s.resume);
  const addJobEmail = useAppStore((s) => s.addJobEmail);
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [emailModal, setEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState("");

  const existingApp = applications.find((a) => jobKey(a.job) === jobKey(job));

  function saveEmail() {
    const email = emailInput.trim();
    if (!email) return;
    addJobEmail(job, email);
    setEmailInput("");
    setEmailModal(false);
    push("success", "Email added to this job everywhere.");
  }

  const descriptionText = stripHtml(job.description);
  const mailHref = job.emails?.length ? mailtoHref(job.emails, job, resume) : "";
  const applyHref = `/app/apply/${encodeURIComponent(jobKey(job))}`;

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label={`View details for ${job.title} at ${job.company}`}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button, a, input, select, textarea")) return;
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if ((e.target as HTMLElement).closest("button, a, input, select, textarea")) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="group relative flex cursor-pointer flex-col gap-4 overflow-hidden rounded-xl border border-border-variant bg-surface-container-lowest p-6 transition-all hover:-translate-y-1 hover:border-outline-variant hover:card-shadow focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className="absolute -right-12 -top-12 h-24 w-24 rounded-bl-full bg-primary-fixed opacity-50 transition-transform group-hover:scale-110" />

        <div className="relative z-10 flex items-start justify-between gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border-variant bg-surface-variant">
            <Icon name={BOARD_ICON[job.board] ?? "work"} className="text-primary" size={24} />
          </div>
          <div className="flex items-center gap-2">
            {alreadyScraped && (
              <Badge tone="neutral" dot>
                Previously scraped
              </Badge>
            )}
            <MatchScore score={job.matchScore} size="md" />
          </div>
        </div>

        <div className="relative z-10">
          <h3 className="text-headline-md text-on-surface">{job.title}</h3>
          <p className="mt-0.5 text-body-sm text-on-surface-variant">{job.company}</p>
        </div>

        {(job.description || job.snippet) && (
          <p className="line-clamp-3 text-body-sm text-on-surface-variant">
            {descriptionText || job.snippet}
          </p>
        )}

        {job.match && (
          <div className="space-y-2 rounded-lg bg-surface-container-low px-4 py-3 text-body-sm">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span className="text-label-sm uppercase tracking-wide text-on-surface-variant">
                Strengths
              </span>
              <span className="text-on-surface">
                {job.match.strengths.slice(0, 2).join(" · ") || "—"}
              </span>
            </div>
            {job.match.gaps.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span className="text-label-sm uppercase tracking-wide text-on-surface-variant">
                  Gaps
                </span>
                <span className="text-warning">{job.match.gaps.slice(0, 2).join(" · ")}</span>
              </div>
            )}
          </div>
        )}

        <div className="relative z-10 mt-auto border-t border-border-variant/50 pt-4">
          <JobMetaChips job={job} />
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2">
          {!job.matchScore && onMatch && (
            <Button size="sm" variant="secondary" loading={matching} onClick={() => onMatch(job)}>
              <Icon name="auto_awesome" size={16} />
              Match me
            </Button>
          )}
          {mailHref && (
            <a href={mailHref}>
              <Button size="sm" variant="secondary">
                <Icon name="mail" size={16} />
                Send email
              </Button>
            </a>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setEmailModal(true);
            }}
          >
            <Icon name="alternate_email" size={16} />
            Add email
          </Button>
          {saved ? (
            <>
              <Link to={applyHref}>
                <Button size="sm" onClick={() => ensureApplication(job)}>
                  <Icon name={existingApp ? "edit_note" : "send"} size={16} />
                  {existingApp ? "Prep & notes" : "Apply"}
                </Button>
              </Link>
              {onUnsave && (
                <button
                  onClick={() => onUnsave(jobKey(job))}
                  className="ml-auto text-label-sm text-on-surface-variant hover:text-error"
                >
                  Remove
                </button>
              )}
            </>
          ) : (
            onSave && (
              <Button size="sm" variant="secondary" onClick={() => onSave(job)}>
                Save
              </Button>
            )
          )}
          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noreferrer"
              className="ml-auto text-label-sm text-primary hover:underline"
            >
              View posting
              <Icon name="arrow_outward" size={14} className="ml-0.5 align-middle" />
            </a>
          )}
        </div>
      </div>

      <Modal open={emailModal} onClose={() => setEmailModal(false)} title="Add a contact email">
        <div className="space-y-4">
          <p className="text-body-sm text-on-surface-variant">
            Attach a recruiter or hiring-team email to <strong>{job.title}</strong> at{" "}
            {job.company}. It'll appear on every copy of this job and its application.
          </p>
          <Input
            type="email"
            autoFocus
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveEmail();
              }
            }}
            placeholder="recruiter@company.com"
            className="font-mono"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEmailModal(false)}>
              Cancel
            </Button>
            <Button onClick={saveEmail} disabled={!emailInput.trim()}>
              <Icon name="add" size={16} />
              Add email
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={open} onClose={() => setOpen(false)} title={job.title} wide>
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="primary">{BOARD_LABEL[job.board]}</Badge>
            {job.remote && <Badge tone="info">Remote</Badge>}
            {alreadyScraped && <Badge tone="neutral">Previously scraped</Badge>}
            {job.matchScore !== undefined && <MatchScore score={job.matchScore} />}
          </div>

          <p className="text-body-md font-medium text-primary">{job.company}</p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <JobDetail icon="location_on" label="Location" value={job.location} />
            <JobDetail icon="calendar_today" label="Posted" value={timeAgo(job.postedAt) || job.postedAt} />
            <JobDetail icon="schedule" label="Employment type" value={job.employmentType} />
            <JobDetail icon="payments" label="Salary" value={job.salary} />
            <JobDetail icon="category" label="Department" value={job.department} />
            <JobDetail icon="school" label="Experience level" value={job.experienceLevel} />
            <JobDetail icon="work_history" label="Job function" value={job.jobFunction} />
            <JobDetail icon="history" label="Scraped" value={scrapedAgo(job.scrapedAt) || undefined} />
          </div>

          {job.emails && job.emails.length > 0 && (
            <div>
              <h4 className="text-label-sm uppercase tracking-wide text-on-surface-variant">
                Contact emails
              </h4>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {job.emails.map((email) => (
                  <a
                    key={email}
                    href={`mailto:${email}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border-variant/50 bg-surface px-2.5 py-1 text-body-sm text-primary hover:bg-surface-container-low"
                  >
                    <Icon name="mail" size={15} />
                    {email}
                  </a>
                ))}
                {mailHref && (
                  <a href={mailHref} className="ml-1">
                    <Button size="sm">
                      Send email
                      <Icon name="arrow_outward" size={15} />
                    </Button>
                  </a>
                )}
              </div>
            </div>
          )}

          {descriptionText && (
            <div>
              <h4 className="text-label-sm uppercase tracking-wide text-on-surface-variant">
                Description
              </h4>
              <p className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-container-low px-4 py-3 text-body-sm text-on-surface">
                {descriptionText}
              </p>
            </div>
          )}

          {job.match && (
            <div className="space-y-3 rounded-lg bg-surface-container-low px-4 py-3">
              <div>
                <h4 className="text-label-sm uppercase tracking-wide text-on-surface-variant">
                  Strengths
                </h4>
                <ul className="mt-1 list-inside list-disc text-body-sm text-on-surface">
                  {job.match.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              {job.match.gaps.length > 0 && (
                <div>
                  <h4 className="text-label-sm uppercase tracking-wide text-on-surface-variant">
                    Gaps
                  </h4>
                  <ul className="mt-1 list-inside list-disc text-body-sm text-warning">
                    {job.match.gaps.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                </div>
              )}
              {job.match.suggestedKeywords.length > 0 && (
                <div>
                  <h4 className="text-label-sm uppercase tracking-wide text-on-surface-variant">
                    Suggested keywords
                  </h4>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {job.match.suggestedKeywords.map((k) => (
                      <span
                        key={k}
                        className="rounded-md bg-surface-container-high px-2 py-1 text-body-sm text-primary"
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {job.match.reasoning && (
                <p className="text-body-sm text-on-surface-variant">
                  {job.match.reasoning}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-border-variant/50 pt-4">
            {job.url && (
              <a href={job.url} target="_blank" rel="noreferrer">
                <Button variant="secondary">
                  View posting
                  <Icon name="arrow_outward" size={16} />
                </Button>
              </a>
            )}
            {mailHref && (
              <a href={mailHref}>
                <Button variant="secondary">
                  <Icon name="mail" size={16} />
                  Send email
                </Button>
              </a>
            )}
            {saved ? (
              <Link to={applyHref} className="ml-auto">
                <Button onClick={() => ensureApplication(job)}>
                  <Icon name={existingApp ? "edit_note" : "send"} size={16} />
                  {existingApp ? "Prep & notes" : "Apply"}
                </Button>
              </Link>
            ) : (
              onSave && (
                <Button
                  className="ml-auto"
                  onClick={() => {
                    onSave(job);
                    setOpen(false);
                  }}
                >
                  Save job
                </Button>
              )
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
