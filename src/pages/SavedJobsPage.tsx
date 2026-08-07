import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";
import { scoreJobMatch } from "../lib/groq";
import type { JobPosting } from "../lib/types";
import { JobCard } from "../components/JobCard";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { EmptyState } from "../components/ui/EmptyState";
import { useKeys } from "../lib/keys";
import { useToast } from "../components/ui/Toast";
import { jobKey } from "../lib/format";

export default function SavedJobsPage() {
  const savedJobs = useAppStore((s) => s.savedJobs);
  const removeSavedJob = useAppStore((s) => s.removeSavedJob);
  const updateJobMatch = useAppStore((s) => s.updateJobMatch);
  const resume = useAppStore((s) => s.resume);
  const { keys } = useKeys();
  const { push } = useToast();
  const [matchingId, setMatchingId] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...savedJobs].sort(
        (a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1) || (b.savedAt ?? 0) - (a.savedAt ?? 0),
      ),
    [savedJobs],
  );

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
      <header>
        <h1 className="font-headline-lg text-headline-lg-mobile text-on-surface md:font-headline-xl md:text-headline-xl">
          Saved Jobs
        </h1>
        <p className="mt-2 font-body-md text-body-md text-on-surface-variant">
          Jobs you've bookmarked — apply, prep, or match them against your resume.
        </p>
      </header>

      {sorted.length === 0 ? (
        <EmptyState
          icon="bookmark_added"
          title="Nothing saved yet"
          description="Hit Save on any job from Job Matcher or Scraped Jobs and it lands here, ready to apply."
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
        <section className="grid grid-cols-1 gap-gutter lg:grid-cols-2 xl:grid-cols-3">
          {sorted.map((job) => (
            <JobCard
              key={jobKey(job)}
              job={job}
              saved
              onUnsave={(id) => {
                removeSavedJob(id);
                push("success", "Removed from Saved Jobs.");
              }}
              onMatch={onMatch}
              matching={matchingId === jobKey(job)}
            />
          ))}
        </section>
      )}
    </div>
  );
}
