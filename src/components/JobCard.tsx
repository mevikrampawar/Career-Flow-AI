import { Link } from "react-router-dom";
import type { JobPosting } from "../lib/types";
import { useAppStore } from "../store/useAppStore";
import { Button } from "./ui/Button";
import { MatchScore } from "./MatchScore";

function JobMeta({ job }: { job: JobPosting }) {
  const parts = [
    job.location,
    job.employmentType,
    job.remote ? "Remote" : undefined,
    job.salary,
  ].filter(Boolean);
  return (
    <p className="text-body-sm text-on-surface-variant">
      {parts.join(" · ") || "—"}
    </p>
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
    <div className="rounded-lg border border-outline-variant/70 bg-surface-container-lowest p-5 transition-shadow hover:card-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-headline-md text-on-surface">
            {job.title}
          </h3>
          <p className="mt-0.5 text-body-md font-medium text-primary">
            {job.company}
          </p>
          <div className="mt-2">
            <JobMeta job={job} />
          </div>
        </div>
        <MatchScore score={job.matchScore} size="md" />
      </div>

      {job.snippet && !job.description && (
        <p className="mt-3 line-clamp-2 text-body-sm text-on-surface-variant">
          {job.snippet}
        </p>
      )}

      {job.match && (
        <div className="mt-4 space-y-2 rounded-sm bg-surface-container-low px-3 py-2.5 text-body-sm">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="text-label-sm uppercase text-on-surface-variant">
              Strengths
            </span>
            <span className="text-on-surface">
              {job.match.strengths.slice(0, 2).join(" · ") || "—"}
            </span>
          </div>
          {job.match.gaps.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span className="text-label-sm uppercase text-on-surface-variant">
                Gaps
              </span>
              <span className="text-warning">
                {job.match.gaps.slice(0, 2).join(" · ")}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!job.matchScore && onMatch && (
          <Button size="sm" variant="secondary" loading={matching} onClick={() => onMatch(job)}>
            ✨ Match me
          </Button>
        )}
        {saved ? (
          <>
            <Button size="sm" onClick={() => addApplication({
              id: crypto.randomUUID(),
              job: { id: job.id, title: job.title, company: job.company, url: job.url, board: job.board },
              status: "draft",
              createdAt: Date.now(),
            })}>
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
            View posting ↗
          </a>
        )}
      </div>
    </div>
  );
}
