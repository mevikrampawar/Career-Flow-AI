import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";
import { useKeys } from "../lib/keys";
import { generateCoverLetter, tailorResume } from "../lib/groq";
import { Button, Spinner } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { Textarea } from "../components/ui/Input";
import { MatchScore, ScoreLabel } from "../components/MatchScore";
import { useToast } from "../components/ui/Toast";

export default function ApplyPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { keys, hasGroq } = useKeys();
  const { push } = useToast();
  const resume = useAppStore((s) => s.resume);
  const savedJobs = useAppStore((s) => s.savedJobs);
  const searchJobs = useAppStore((s) => s.searchJobs);
  const updateJobMatch = useAppStore((s) => s.updateJobMatch);
  const addApplication = useAppStore((s) => s.addApplication);
  const updateApplication = useAppStore((s) => s.updateApplication);
  const applications = useAppStore((s) => s.applications);

  const job = useMemo(
    () => [...savedJobs, ...searchJobs].find((j) => j.id === jobId),
    [jobId, savedJobs, searchJobs],
  );

  const [busy, setBusy] = useState<"tailor" | "letter" | null>(null);
  const [summary, setSummary] = useState("");
  const [highlights, setHighlights] = useState("");
  const [letter, setLetter] = useState("");
  const [copied, setCopied] = useState(false);

  if (!job) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-headline-lg text-on-surface">Job not found</h1>
        <p className="mt-2 text-body-sm text-on-surface-variant">
          This job isn't in your saved or search list anymore.
        </p>
        <Link to="/app/jobs" className="mt-6 inline-block">
          <Button>Back to jobs</Button>
        </Link>
      </div>
    );
  }

  const currentJob = job;
  const existingApp = applications.find(
    (a) => a.job.id === currentJob.id && a.status !== "draft",
  );

  async function run(kind: "tailor" | "letter") {
    if (!resume || !hasGroq) {
      push("error", "You need a resume and a Groq key for this.");
      navigate("/app/settings");
      return;
    }
    setBusy(kind);
    try {
      if (kind === "tailor") {
        const r = await tailorResume(keys.groqApiKey, resume, currentJob);
        setSummary(r.tailoredSummary);
        setHighlights(r.tailoredHighlights.join("\n"));
      } else {
        const text = await generateCoverLetter(keys.groqApiKey, resume, currentJob);
        setLetter(text);
      }
    } catch (e) {
      push("error", e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setBusy(null);
    }
  }

  async function markApplied() {
    const id = crypto.randomUUID();
    if (existingApp) {
      updateApplication(existingApp.id, {
        status: "applied",
        appliedAt: Date.now(),
        coverLetter: letter || existingApp.coverLetter,
        tailoredHighlights: highlights || existingApp.tailoredHighlights,
      });
      push("success", "Application marked as applied.");
    } else {
      addApplication({
        id,
        job: { id: currentJob.id, title: currentJob.title, company: currentJob.company, url: currentJob.url, board: currentJob.board },
        status: "applied",
        appliedAt: Date.now(),
        coverLetter: letter || undefined,
        tailoredHighlights: highlights || undefined,
        createdAt: Date.now(),
      });
      updateJobMatch(currentJob.id, {
        score: 0,
        strengths: [],
        gaps: [],
        suggestedKeywords: [],
        reasoning: "",
      });
      push("success", "Application logged. Go get it!");
    }
    navigate("/app/applications");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        to="/app/jobs"
        className="text-label-sm text-on-surface-variant hover:text-primary"
      >
        ← Back to jobs
      </Link>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-headline-lg text-on-surface">{currentJob.title}</h1>
            <p className="mt-1 text-body-md font-medium text-primary">
              {currentJob.company}
            </p>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              {[currentJob.location, currentJob.employmentType, currentJob.salary].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
          {currentJob.matchScore !== undefined && (
            <div className="text-center">
              <MatchScore score={currentJob.matchScore} size="md" />
              <div className="mt-1 text-label-sm text-on-surface-variant">
                <ScoreLabel score={currentJob.matchScore} />
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Tailored resume"
          subtitle="A summary and achievement bullets rewritten for this specific role."
          action={
            <Button size="sm" variant="secondary" loading={busy === "tailor"} onClick={() => run("tailor")}>
              ✨ Tailor
            </Button>
          }
        />
        <div className="space-y-4 p-5 pt-2">
          <Textarea
            placeholder="Tailored summary will appear here…"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
          <Textarea
            placeholder="Tailored achievement highlights (one per line)…"
            value={highlights}
            onChange={(e) => setHighlights(e.target.value)}
            className="min-h-36"
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Cover letter"
          subtitle="Generated from your real experience — edit before sending."
          action={
            <Button size="sm" variant="secondary" loading={busy === "letter"} onClick={() => run("letter")}>
              ✨ Write
            </Button>
          }
        />
        <div className="p-5 pt-2">
          <Textarea
            placeholder="Your cover letter will appear here…"
            value={letter}
            onChange={(e) => setLetter(e.target.value)}
            className="min-h-64 font-mono text-body-sm"
          />
          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={!letter}
              onClick={async () => {
                await navigator.clipboard.writeText(letter);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "Copied ✓" : "Copy letter"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-3">
          {currentJob.url && (
            <a href={currentJob.url} target="_blank" rel="noreferrer">
              <Button variant="secondary">Open application ↗</Button>
            </a>
          )}
          <Button onClick={markApplied} className="ml-auto">
            {existingApp ? "Update as applied" : "Mark as applied"}
          </Button>
        </div>
        <p className="mt-3 text-body-sm text-on-surface-variant">
          Tip: use the tailored summary and highlights in the application's
          "Tell us about yourself" fields, and paste the cover letter where
          offered.
        </p>
      </Card>

      {busy && (
        <div className="flex items-center justify-center gap-2 text-body-sm text-on-surface-variant">
          <Spinner className="size-4" /> Generating with Groq…
        </div>
      )}
    </div>
  );
}
