import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";
import { useKeys } from "../lib/keys";
import { startScrape, finishScrape, DEFAULT_ACTORS } from "../lib/apify";
import { scoreJobMatch } from "../lib/groq";
import { jobDedupeKey, jobKey } from "../lib/format";
import type { JobPosting, JobSearchParams } from "../lib/types";
import { Button, Spinner } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Field, Input, Select } from "../components/ui/Input";
import { Icon } from "../components/ui/Icon";
import { EmptyState } from "../components/ui/EmptyState";
import { SkeletonJobCard } from "../components/ui/Skeleton";
import { JobCard } from "../components/JobCard";
import { useToast } from "../components/ui/Toast";

const DEFAULTS: JobSearchParams = {
  query: "",
  location: "",
  board: "linkedin",
  maxResults: 20,
  remoteOnly: false,
};

export default function JobsPage() {
  const navigate = useNavigate();
  const resume = useAppStore((s) => s.resume);
  const searchJobsState = useAppStore((s) => s.searchJobs);
  const setSearchJobs = useAppStore((s) => s.setSearchJobs);
  const addScrapedJobs = useAppStore((s) => s.addScrapedJobs);
  const saveJob = useAppStore((s) => s.saveJob);
  const savedJobs = useAppStore((s) => s.savedJobs);
  const scrapedJobs = useAppStore((s) => s.scrapedJobs);
  const updateJobMatch = useAppStore((s) => s.updateJobMatch);
  const setLastSearchParams = useAppStore((s) => s.setLastSearchParams);
  const setActiveScrape = useAppStore((s) => s.setActiveScrape);
  const { keys, hasApify, hasGroq } = useKeys();
  const { push } = useToast();

  const [params, setParams] = useState<JobSearchParams>(DEFAULTS);
  const [scraping, setScraping] = useState(false);
  const [searched, setSearched] = useState(false);
  const [progress, setProgress] = useState("");
  const [matchingId, setMatchingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const savedIds = new Set(savedJobs.map(jobKey));
  // Archive keys as of the LAST scrape (before the current results were added),
  // so fresh results don't get mislabelled "Previously scraped".
  const beforeScrapeRef = useRef(new Set(scrapedJobs.map(jobDedupeKey)));
  // Guards against resuming the same scrape twice (React StrictMode double-mounts).
  const resumeStartedRef = useRef(false);

  async function onScrape(next?: JobSearchParams) {
    const p = next ?? params;
    if (next) setParams(next);
    setError(null);
    if (!p.query.trim()) {
      setError("Enter a job title or keyword.");
      return;
    }
    if (!hasApify || !keys.apifyApiToken) {
      push("error", "Add your Apify API token in Settings first.");
      navigate("/app/profile");
      return;
    }
    setScraping(true);
    setProgress("Starting scrape...");
    beforeScrapeRef.current = new Set(
      useAppStore.getState().scrapedJobs.map(jobDedupeKey),
    );
    try {
      const runId = await startScrape(keys.apifyApiToken, p, DEFAULT_ACTORS);
      // Persist the run so a refresh mid-hunt resumes instead of losing it.
      setActiveScrape({ runId, params: p, startedAt: Date.now() });
      setLastSearchParams(p);
      const jobs = await finishScrape(
        keys.apifyApiToken,
        p.board,
        runId,
        p.query,
        (msg) => setProgress(msg),
      );
      setSearchJobs(jobs);
      setSearched(true);
      const { added, duplicates } = addScrapedJobs(jobs);
      if (jobs.length === 0) {
        push("info", "No jobs found. Try broader keywords or another board.");
      } else if (added === 0) {
        push(
          "success",
          `You're all caught up — ${jobs.length} job${jobs.length === 1 ? "" : "s"} found, all already in Scraped Jobs.`,
        );
      } else {
        push(
          "success",
          `Found ${jobs.length} jobs. ${added} new saved, ${duplicates} already scraped.`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scrape failed.");
    } finally {
      setScraping(false);
      setProgress("");
      setActiveScrape(null);
    }
  }

  // Restore where the user left off: a persisted in-flight scrape resumes
  // automatically; otherwise the last search form is pre-filled.
  useEffect(() => {
    if (resumeStartedRef.current) return;
    const scrape = useAppStore.getState().activeScrape;
    if (scrape) {
      if (hasApify && keys.apifyApiToken) {
        resumeStartedRef.current = true;
        setParams(scrape.params);
        setSearched(false);
        setScraping(true);
        setProgress("Resuming your previous hunt…");
        beforeScrapeRef.current = new Set(
          useAppStore.getState().scrapedJobs.map(jobDedupeKey),
        );
        (async () => {
          try {
            const jobs = await finishScrape(
              keys.apifyApiToken,
              scrape.params.board,
              scrape.runId,
              scrape.params.query,
              (msg) => setProgress(msg),
            );
            setSearchJobs(jobs);
            setSearched(true);
            const { added, duplicates } = addScrapedJobs(jobs);
            if (jobs.length === 0) {
              push("info", "No jobs found. Try broader keywords or another board.");
            } else if (added === 0) {
              push(
                "success",
                `You're all caught up — ${jobs.length} jobs found, all already in Scraped Jobs.`,
              );
            } else {
              push(
                "success",
                `Resumed hunt — ${jobs.length} jobs. ${added} new saved, ${duplicates} already scraped.`,
              );
            }
          } catch (e) {
            setError(e instanceof Error ? e.message : "Resuming the scrape failed.");
          } finally {
            setScraping(false);
            setProgress("");
            setActiveScrape(null);
          }
        })();
        return;
      }
      // No token anymore — drop the stale run so it stops nagging.
      setActiveScrape(null);
    }
    const last = useAppStore.getState().lastSearchParams;
    if (last) setParams(last);
  }, []);

  async function onMatch(job: JobPosting) {
    if (!resume || !hasGroq) {
      push("error", "You need a resume and a Groq key to match.");
      navigate("/app/profile");
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

  function clearResults() {
    setSearchJobs([]);
    setSearched(false);
    push("info", "Job Matcher results cleared — Scraped Jobs kept.");
  }

  const results = searchJobsState;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="font-headline-lg text-headline-lg-mobile text-on-surface md:font-headline-xl md:text-headline-xl">
            Job Matcher
          </h1>
          <p className="mt-2 font-body-md text-body-md text-on-surface-variant">
            Discover roles tailored to your profile and experience.
          </p>
        </div>
        {results.length > 0 && (
          <span className="inline-flex items-center gap-2 rounded-full border border-border-variant bg-surface-container-lowest px-4 py-2 font-label-md text-label-md text-on-surface">
            {results.length} results
          </span>
        )}
      </section>

      <Card className="p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Field label="Job title / keywords">
              <Input
                value={params.query}
                onChange={(e) => setParams({ ...params, query: e.target.value })}
                placeholder="e.g. Frontend Engineer"
              />
            </Field>
          </div>
          <div>
            <Field label="Location">
              <Input
                value={params.location}
                onChange={(e) => setParams({ ...params, location: e.target.value })}
                placeholder="City or country"
              />
            </Field>
          </div>
          <div>
            <Field label="Board">
              <Select
                value={params.board}
                onChange={(e) =>
                  setParams({ ...params, board: e.target.value as JobSearchParams["board"] })
                }
              >
                <option value="linkedin">LinkedIn</option>
                <option value="indeed">Indeed</option>
                <option value="workable">Workable</option>
              </Select>
            </Field>
          </div>
          <div>
            <Field label="Max results">
              <Input
                type="number"
                min={1}
                max={50}
                value={params.maxResults}
                onChange={(e) =>
                  setParams({ ...params, maxResults: Number(e.target.value) || 10 })
                }
              />
            </Field>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface">
            <input
              type="checkbox"
              checked={params.remoteOnly}
              onChange={(e) => setParams({ ...params, remoteOnly: e.target.checked })}
              className="size-4 accent-(--color-primary-container)"
            />
            Remote only
          </label>
          <Button onClick={() => onScrape()} loading={scraping} className="ml-auto">
            <Icon name="travel_explore" size={18} />
            {scraping ? "Scraping…" : "Hunt jobs"}
          </Button>
        </div>
        {error && <p className="mt-3 font-body-sm text-body-sm text-error">{error}</p>}
      </Card>

      {scraping ? (
        <section>
          <div className="mb-6">
            <h2 className="font-headline-md text-headline-md text-on-surface">
              Hunting on {params.board === "linkedin" ? "LinkedIn" : params.board === "indeed" ? "Indeed" : "Workable"}…
            </h2>
            {progress && (
              <p className="mt-1 flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
                <Spinner className="size-4" /> {progress}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 gap-gutter lg:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <SkeletonJobCard key={i} />
            ))}
          </div>
        </section>
      ) : results.length > 0 ? (
        <section>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-headline-md text-headline-md text-on-surface">
              {results.length} results
            </h2>
            <Button size="sm" variant="ghost" onClick={clearResults}>
              <Icon name="delete_sweep" size={16} />
              Clear results
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-gutter lg:grid-cols-2 xl:grid-cols-3">
            {results.map((job) => (
              <JobCard
                key={jobKey(job)}
                job={job}
                saved={savedIds.has(jobKey(job))}
                alreadyScraped={beforeScrapeRef.current.has(jobDedupeKey(job))}
                onSave={(j) => {
                  saveJob(j);
                  push("success", "Saved to Saved Jobs.", {
                    label: "View",
                    onClick: () => navigate("/app/saved"),
                  });
                }}
                onMatch={onMatch}
                matching={matchingId === jobKey(job)}
              />
            ))}
          </div>
        </section>
      ) : (
        <EmptyState
          icon={searched ? "search_off" : "travel_explore"}
          title={searched ? "No jobs found" : "Ready to hunt?"}
          description={
            searched
              ? "Try broader keywords, another board, or drop the remote filter."
              : "Scrape live openings from LinkedIn, Indeed, and Workable, then score them against your resume."
          }
          action={
            <Button
              variant="secondary"
              onClick={() => onScrape({ ...DEFAULTS, query: "Software Engineer" })}
            >
              <Icon name="auto_awesome" size={16} />
              Try a sample search
            </Button>
          }
        />
      )}

      {!hasApify && (
        <p className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning-container px-4 py-3 font-body-sm text-body-sm text-warning">
          <Icon name="key" size={18} />
          You need an Apify API token (free tier available) to scrape jobs.{" "}
          <button className="font-semibold underline" onClick={() => navigate("/app/profile")}>
            Add it in Settings
          </button>
        </p>
      )}
      {!resume && (
        <p className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning-container px-4 py-3 font-body-sm text-body-sm text-warning">
          <Icon name="description" size={18} />
          Upload a resume to unlock AI match scoring.{" "}
          <button className="font-semibold underline" onClick={() => navigate("/app/resume")}>
            Go to Resume
          </button>
        </p>
      )}
    </div>
  );
}
