import { Link } from "react-router-dom";
import type { JobPosting } from "../lib/types";
import { useAppStore } from "../store/useAppStore";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";
import { MatchScore } from "./MatchScore";

const BOARD_ICON: Record<JobPosting["board"], string> = {
  linkedin: "linked_services",
  indeed: "work",
  workable: "business_center",
};

function JobMetaChips({ job }: { job: JobPosting }) {
  const chips = [
    { icon: "location_on", label: job.location },
    { icon: "schedule", label: job.employmentType },
    { icon: "payments", label: job.salary },
    { icon: "public", label: job.remote ? "Remote" : undefined },
  ].filter((c) => c.label);

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <span
          key={chip.icon}
          className="inline-flex items-center gap-1 rounded-md border border-variant/50 bg-surface px-2 py-1 font-body-sm text-body-sm text-on-surface-variant"
        >
          <Icon name={chip.icon} size={16} />
          {chip.label}
        </span>
      ))}
    </div>
  );
}

export function JobCard({
  job,
  saved = false,
  onSave,
  onUnsave,
  onMatch,
  matching = false,
}: {
  job: JobPosting;
  saved?: boolean;
  onSave?: (job: JobPosting) => void;
  onUnsave?: (jobId: string) => void;
  onMatch?: (job: JobPosting) => void;
  matching?: boolean;
}) {
  const addApplication = useAppStore((s) => s.addApplication);

  return (
    <div className="group relative flex flex-col gap-4 overflow-hidden rounded-xl border border-variant bg-surface-container-lowest p-6 transition-all hover:border-outline-variant hover:card-shadow">
      <div className="absolute -right-12 -top-12 h-24 w-24 rounded-bl-full bg-primary-fixed opacity-50 transition-transform group-hover:scale-110" />

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-variant bg-surface-variant">
          <Icon name={BOARD_ICON[job.board] ?? "work"} className="text-primary" size={24} />
        </div>
        <MatchScore score={job.matchScore} size="md" />
      </div>

      <div className="relative z-10">
        <h3 className="font-headline-md text-headline-md text-on-surface">{job.title}</h3>
        <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">{job.company}</p>
      </div>

      {job.snippet && !job.description && (
        <p className="line-clamp-2 font-body-sm text-body-sm text-on-surface-variant">
          {job.snippet}
        </p>
      )}

      {job.match && (
        <div className="space-y-2 rounded-lg bg-surface-container-low px-4 py-3 font-body-sm text-body-sm">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="font-label-sm text-label-sm uppercase tracking-wide text-on-surface-variant">
              Strengths
            </span>
            <span className="text-on-surface">
              {job.match.strengths.slice(0, 2).join(" · ") || "—"}
            </span>
          </div>
          {job.match.gaps.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span className="font-label-sm text-label-sm uppercase tracking-wide text-on-surface-variant">
                Gaps
              </span>
              <span className="text-warning">{job.match.gaps.slice(0, 2).join(" · ")}</span>
            </div>
          )}
        </div>
      )}

      <div className="relative z-10 mt-auto border-t border-variant/50 pt-4">
        <JobMetaChips job={job} />
      </div>

      <div className="relative z-10 flex flex-wrap items-center gap-2">
        {!job.matchScore && onMatch && (
          <Button size="sm" variant="secondary" loading={matching} onClick={() => onMatch(job)}>
            <Icon name="auto_awesome" size={16} />
            Match me
          </Button>
        )}
        {saved ? (
          <>
            <Button
              size="sm"
              onClick={() =>
                addApplication({
                  id: crypto.randomUUID(),
                  job: {
                    id: job.id,
                    title: job.title,
                    company: job.company,
                    url: job.url,
                    board: job.board,
                  },
                  status: "draft",
                  createdAt: Date.now(),
                })
              }
            >
              Apply
            </Button>
            <Link to={`/app/apply/${encodeURIComponent(job.id)}`}>
              <Button size="sm" variant="secondary">
                Prep materials
              </Button>
            </Link>
            {onUnsave && (
              <button
                onClick={() => onUnsave(job.id)}
                className="ml-auto font-label-sm text-label-sm text-on-surface-variant hover:text-error"
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
            className="ml-auto font-label-sm text-label-sm text-primary hover:underline"
          >
            View posting
            <Icon name="arrow_outward" size={14} className="ml-0.5 align-middle" />
          </a>
        )}
      </div>
    </div>
  );
}
