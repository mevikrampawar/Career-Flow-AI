import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";
import { useKeys } from "../lib/keys";
import { searchJobs, DEFAULT_ACTORS } from "../lib/apify";
import { scoreJobMatch } from "../lib/groq";
import type { JobPosting, JobSearchParams } from "../lib/types";
import { Button, Spinner } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Field, Input, Select } from "../components/ui/Input";
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
  const saveJob = useAppStore((s) => s.saveJob);
  const savedJobs = useAppStore((s) => s.savedJobs);
  const updateJobMatch = useAppStore((s) => s.updateJobMatch);
  const { keys, hasApify, hasGroq } = useKeys();
  const { push } = useToast();

  const [params, setParams] = useState<JobSearchParams>(DEFAULTS);
  const [scraping, setScraping] = useState(false);
  const [progress, setProgress] = useState("");
  const [matchingId, setMatchingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const savedIds = new Set(savedJobs.map((j) => j.id));

  async function onScrape() {
    setError(null);
    if (!params.query.trim()) {
      setError("Enter a job title or keyword.");
      return;
    }
    if (!hasApify) {
      push("error", "Add your Apify API token in Settings first.");
      navigate("/app/settings");
      return;
    }
    setScraping(true);
    setProgress("Starting scrape...");
    try {
      const jobs = await searchJobs(keys.apifyApiToken, params, DEFAULT_ACTORS, (msg) =>
        setProgress(msg),
      );
      setSearchJobs(jobs);
      if (jobs.length === 0) {
        push("info", "No jobs found. Try broader keywords or another board.");
      } else {
        push("success", `Found ${jobs.length} jobs.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scrape failed.");
    } finally {
      setScraping(false);
      setProgress("");
    }
  }

  async function onMatch(job: JobPosting) {
    if (!resume || !hasGroq) {
      push("error", "You need a resume and a Groq key to match.");
      navigate("/app/settings");
      return;
    }
    setMatchingId(job.id);
    try {
      const match = await scoreJobMatch(keys.groqApiKey, resume, job);
      updateJobMatch(job.id, match);
    } catch (e) {
      push("error", e instanceof Error ? e.message : "Match failed.");
    } finally {
      setMatchingId(null);
    }
  }

  const results = searchJobsState;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-headline-lg text-on-surface">Job hunt</h1>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          Scrape live openings via Apify, then AI-score them against your resume.
        </p>
      </div>

      <Card className="p-5">
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
          <label className="flex items-center gap-2 text-body-sm text-on-surface">
            <input
              type="checkbox"
              checked={params.remoteOnly}
              onChange={(e) => setParams({ ...params, remoteOnly: e.target.checked })}
              className="size-4 accent-(--color-primary-container)"
            />
            Remote only
          </label>
          <Button onClick={onScrape} loading={scraping} className="ml-auto">
            {scraping ? "Scraping…" : "Hunt jobs"}
          </Button>
        </div>
        {error && <p className="mt-3 text-body-sm text-error">{error}</p>}
        {progress && (
          <p className="mt-3 flex items-center gap-2 text-body-sm text-on-surface-variant">
            <Spinner className="size-4" /> {progress}
          </p>
        )}
      </Card>

      {results.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-headline-md text-on-surface">
              {results.length} results
            </h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {results.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                saved={savedIds.has(job.id)}
                onSave={saveJob}
                onMatch={onMatch}
                matching={matchingId === job.id}
              />
            ))}
          </div>
        </section>
      )}

      {!hasApify && (
        <p className="rounded-sm border border-warning/40 bg-warning-container px-3 py-2 text-body-sm text-warning">
          You need an Apify API token (free tier available) to scrape jobs.{" "}
          <button className="underline" onClick={() => navigate("/app/settings")}>
            Add it in Settings
          </button>
        </p>
      )}
      {!resume && (
        <p className="rounded-sm border border-warning/40 bg-warning-container px-3 py-2 text-body-sm text-warning">
          Upload a resume to unlock AI match scoring.{" "}
          <button className="underline" onClick={() => navigate("/app/resume")}>
            Go to Resume
          </button>
        </p>
      )}
    </div>
  );
}
