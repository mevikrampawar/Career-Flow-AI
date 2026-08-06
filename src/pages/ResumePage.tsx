import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";
import { useKeys } from "../lib/keys";
import { analyzeResume } from "../lib/groq";
import { parsePdfToText } from "../lib/resume";
import type { AnalysisStatus, ResumeData } from "../lib/types";
import { Button, Spinner } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { Chip, Badge } from "../components/ui/Badge";
import { useToast } from "../components/ui/Toast";

export default function ResumePage() {
  const resume = useAppStore((s) => s.resume);
  const setResume = useAppStore((s) => s.setResume);
  const { keys, hasGroq } = useKeys();
  const { push } = useToast();
  const navigate = useNavigate();

  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [progress, setProgress] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      push("error", "Please upload a PDF resume.");
      return;
    }
    if (!hasGroq) {
      push("error", "Add your Groq API key in Settings first.");
      navigate("/app/settings");
      return;
    }
    setStatus("parsing");
    setProgress("Parsing PDF...");
    try {
      const text = await parsePdfToText(file);
      setPreview(text);
      setProgress("Analyzing with Groq...");
      setStatus("analyzing");
      const analysis = await analyzeResume(keys.groqApiKey, text);
      const data: ResumeData = {
        id: crypto.randomUUID(),
        fileName: file.name,
        rawText: text,
        ...analysis,
        updatedAt: Date.now(),
      };
      setResume(data);
      setStatus("ready");
      push("success", "Resume analyzed and saved.");
    } catch (e) {
      setStatus("error");
      push("error", e instanceof Error ? e.message : "Failed to analyze resume.");
    }
  }

  if (resume && status === "idle") {
    return <ResumeView resume={resume} onReanalyze={() => { setStatus("idle"); }} />;
  }

  const busy = status === "parsing" || status === "analyzing";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-headline-lg text-on-surface">Resume</h1>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          Upload a PDF. We extract your profile and analyze it with Groq.
        </p>
      </div>

      <div
        className={`grid place-items-center rounded-lg border-2 border-dashed px-6 py-14 text-center transition-colors ${
          dragOver
            ? "border-primary-container bg-primary-container/8"
            : "border-outline-variant bg-surface-container-lowest"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
      >
        {busy ? (
          <div className="space-y-3">
            <Spinner className="mx-auto size-8 text-primary-container" />
            <p className="text-body-md text-on-surface">{progress}</p>
          </div>
        ) : (
          <>
            <div className="grid size-12 place-items-center rounded-sm bg-primary-container/12 text-2xl text-primary">
              ▤
            </div>
            <p className="mt-4 text-body-lg text-on-surface">
              Drop your resume here
            </p>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              PDF only · parsed locally in your browser
            </p>
            <Button
              className="mt-5"
              onClick={() => inputRef.current?.click()}
            >
              Choose file
            </Button>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />

      {preview && (
        <Card>
          <CardHeader title="Extracted text" subtitle={`${preview.split(/\s+/).length} words`} />
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap px-5 pb-5 font-mono text-body-sm text-on-surface-variant">
            {preview}
          </pre>
        </Card>
      )}

      {!hasGroq && (
        <p className="rounded-sm border border-warning/40 bg-warning-container px-3 py-2 text-body-sm text-warning">
          You need a Groq API key (free) to analyze your resume.{" "}
          <button className="underline" onClick={() => navigate("/app/settings")}>
            Add it in Settings
          </button>
        </p>
      )}
    </div>
  );
}

function ResumeView({ resume, onReanalyze }: { resume: ResumeData; onReanalyze: () => void }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-headline-lg text-on-surface">Your profile</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            {resume.fileName}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={onReanalyze}>
          Re-upload
        </Button>
      </div>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-headline-lg text-on-surface">
              {resume.fullName ?? "Untitled"}
            </h2>
            <p className="mt-0.5 text-body-md text-on-surface-variant">
              {[resume.headline, resume.location].filter(Boolean).join(" · ") || "—"}
            </p>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              {[resume.email, resume.phone, resume.linkedin].filter(Boolean).join(" · ") || ""}
            </p>
          </div>
          <Badge tone="success" dot>
            Ready
          </Badge>
        </div>
        {resume.summary && (
          <p className="mt-4 text-body-md text-on-surface">{resume.summary}</p>
        )}
      </Card>

      {resume.skills.length > 0 && (
        <Card className="p-5">
          <h3 className="text-headline-md text-on-surface">Skills</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {resume.skills.map((s) => (
              <Chip key={s}>{s}</Chip>
            ))}
          </div>
        </Card>
      )}

      {resume.experience.length > 0 && (
        <Card className="p-5">
          <h3 className="text-headline-md text-on-surface">Experience</h3>
          <div className="mt-4 space-y-5">
            {resume.experience.map((xp, i) => (
              <div key={i}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="text-body-lg font-semibold text-on-surface">
                    {xp.title}
                  </h4>
                  <span className="text-body-sm text-on-surface-variant">
                    {[xp.startDate, xp.endDate ?? (xp.current ? "Present" : undefined)].filter(Boolean).join(" – ")}
                  </span>
                </div>
                <p className="text-body-md font-medium text-primary">{xp.company}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-body-sm text-on-surface-variant">
                  {xp.bullets.map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
                {xp.technologies?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {xp.technologies.map((t) => (
                      <Chip key={t}>{t}</Chip>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      )}

      {resume.education.length > 0 && (
        <Card className="p-5">
          <h3 className="text-headline-md text-on-surface">Education</h3>
          <div className="mt-4 space-y-4">
            {resume.education.map((ed, i) => (
              <div key={i}>
                <h4 className="text-body-lg font-semibold text-on-surface">{ed.degree}</h4>
                <p className="text-body-sm text-on-surface-variant">
                  {ed.institution}
                  {ed.endDate ? ` · ${ed.endDate}` : ""}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
