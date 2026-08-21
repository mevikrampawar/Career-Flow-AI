import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";
import type { JobPosting } from "../lib/types";
import { JobCard } from "../components/JobCard";
import { Card } from "../components/ui/Card";
import { Field, Input, Select } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { Modal } from "../components/ui/Modal";
import { EmptyState } from "../components/ui/EmptyState";
import { useToast } from "../components/ui/Toast";
import { useKeys } from "../lib/keys";
import { scoreJobMatch } from "../lib/groq";
import { jobKey } from "../lib/format";

type Board = "all" | JobPosting["board"];

function uniqueValues(jobs: JobPosting[], pick: (j: JobPosting) => string | undefined) {
  const set = new Set<string>();
  for (const j of jobs) {
    const v = pick(j);
    if (v) set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b)).slice(0, 40);
}

export default function ScrapedJobsPage() {
  const scrapedJobs = useAppStore((s) => s.scrapedJobs);
  const savedJobs = useAppStore((s) => s.savedJobs);
  const saveJob = useAppStore((s) => s.saveJob);
  const removeSavedJob = useAppStore((s) => s.removeSavedJob);
  const updateJobMatch = useAppStore((s) => s.updateJobMatch);
  const setScrapedJobs = useAppStore((s) => s.setScrapedJobs);
  const resume = useAppStore((s) => s.resume);
  const { keys } = useKeys();
  const { push } = useToast();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [board, setBoard] = useState<Board>("all");
  const [department, setDepartment] = useState("all");
  const [experience, setExperience] = useState("all");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [matchingId, setMatchingId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const departments = uniqueValues(scrapedJobs, (j) => j.department);
  const experiences = uniqueValues(scrapedJobs, (j) => j.experienceLevel);

  const savedIds = useMemo(
    () => new Set(savedJobs.map(jobKey)),
    [savedJobs],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scrapedJobs.filter((job) => {
      if (board !== "all" && job.board !== board) return false;
      if (department !== "all" && job.department !== department) return false;
      if (experience !== "all" && job.experienceLevel !== experience) return false;
      if (remoteOnly && !job.remote) return false;
      if (q) {
        const haystack = `${job.title} ${job.company} ${job.location} ${job.department ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [scrapedJobs, query, board, department, experience, remoteOnly]);

  const activeFilters =
    (query ? 1 : 0) +
    (board !== "all" ? 1 : 0) +
    (department !== "all" ? 1 : 0) +
    (experience !== "all" ? 1 : 0) +
    (remoteOnly ? 1 : 0);

  function clearFilters() {
    setQuery("");
    setBoard("all");
    setDepartment("all");
    setExperience("all");
    setRemoteOnly(false);
  }

  function onFlush() {
    setScrapedJobs([]);
    setConfirmOpen(false);
    push(
      "success",
      "Scraped Jobs cleared — re-running a hunt will add matching jobs back as new.",
    );
  }

  async function onMatch(job: JobPosting) {
    if (!resume) {
      push("error", "Upload a resume first to unlock AI matching.");
      return;
    }
    setMatchingId(jobKey(job));
    try {
      const match = await scoreJobMatch(keys.groqApiKey, resume, job);
      updateJobMatch(jobKey(job), match);
    } catch (e) {
      push("error", e instanceof Error ? e.message : "Match failed.");
    } finally {
      setMatchingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-headline-lg-mobile text-on-surface md:text-headline-xl">
            Scraped Jobs
          </h1>
          <p className="mt-2 text-body-md text-on-surface-variant">
            Every job you've scraped, auto-saved and de-duplicated. New hunches land here
            automatically.
          </p>
        </div>
        {scrapedJobs.length > 0 && (
          <Button variant="outline-danger" size="sm" onClick={() => setConfirmOpen(true)}>
            <Icon name="delete_sweep" size={16} />
            Flush all
          </Button>
        )}
      </header>

      <Card className="p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Field label="Search">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Title, company, location…"
              />
            </Field>
          </div>
          <div>
            <Field label="Board">
              <Select value={board} onChange={(e) => setBoard(e.target.value as Board)}>
                <option value="all">All boards</option>
                <option value="linkedin">LinkedIn</option>
                <option value="indeed">Indeed</option>
                <option value="workable">Workable</option>
              </Select>
            </Field>
          </div>
          <div>
            <Field label="Department">
              <Select value={department} onChange={(e) => setDepartment(e.target.value)}>
                <option value="all">All departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div>
            <Field label="Experience">
              <Select value={experience} onChange={(e) => setExperience(e.target.value)}>
                <option value="all">All levels</option>
                {experiences.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-body-sm text-on-surface">
            <input
              type="checkbox"
              checked={remoteOnly}
              onChange={(e) => setRemoteOnly(e.target.checked)}
              className="size-4 accent-(--color-primary-container)"
            />
            Remote only
          </label>
          <div className="ml-auto flex items-center gap-3">
            <span className="inline-flex items-center gap-1 rounded-full border border-border-variant bg-surface-container-lowest px-3 py-1.5 text-label-md text-on-surface">
              <Icon name="inventory_2" size={16} className="text-primary" />
              {filtered.length} / {scrapedJobs.length}
            </span>
            {activeFilters > 0 && (
              <Button size="sm" variant="ghost" onClick={clearFilters}>
                Clear filters
                <span className="rounded-full bg-surface-container-high px-1.5 text-label-sm">
                  {activeFilters}
                </span>
              </Button>
            )}
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={scrapedJobs.length === 0 ? "inventory_2" : "filter_alt_off"}
          title={scrapedJobs.length === 0 ? "Nothing scraped yet" : "Nothing matches these filters"}
          description={
            scrapedJobs.length === 0
              ? "Run a job hunt and every result lands here automatically, de-duplicated."
              : "Loosen the search, board, or filter selections to see more."
          }
          action={
            scrapedJobs.length === 0 ? (
              <Link to="/app/jobs" className="inline-block">
                <Button>
                  <Icon name="travel_explore" size={18} />
                  Hunt jobs
                </Button>
              </Link>
            ) : (
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <section className="grid grid-cols-1 gap-gutter lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map((job) => (
            <JobCard
              key={jobKey(job)}
              job={job}
              saved={savedIds.has(jobKey(job))}
              onSave={(j) => {
                saveJob(j);
                push("success", "Saved to Saved Jobs.", {
                  label: "View",
                  onClick: () => navigate("/app/saved"),
                });
              }}
              onUnsave={removeSavedJob}
              onMatch={onMatch}
              matching={matchingId === jobKey(job)}
            />
          ))}
        </section>
      )}

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Flush all scraped jobs?"
      >
        <p className="text-body-md text-on-surface-variant">
          {scrapedJobs.length} scraped job{scrapedJobs.length === 1 ? "" : "s"} will be
          permanently removed from your account. Saved jobs are kept. If a future hunt finds
          the same posting again, it will be added back as new.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onFlush}>
            <Icon name="delete_sweep" size={16} />
            Flush {scrapedJobs.length} job{scrapedJobs.length === 1 ? "" : "s"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
