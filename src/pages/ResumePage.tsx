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
import { Field, Input, Textarea } from "../components/ui/Input";
import { Icon } from "../components/ui/Icon";
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
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <header>
        <h1 className="font-headline-lg text-headline-lg-mobile text-on-surface md:font-headline-lg md:text-headline-lg">
          Resume
        </h1>
        <p className="mt-2 font-body-md text-body-md text-on-surface-variant">
          Upload a PDF. We extract your profile and analyze it with Groq.
        </p>
      </header>

      <div
        className={`group relative flex flex-col items-center justify-center gap-6 overflow-hidden rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
          dragOver
            ? "border-primary bg-surface-container-lowest"
            : "border-outline-variant bg-surface-container-lowest hover:border-primary"
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
          <div className="flex flex-col items-center gap-4">
            <Spinner className="size-8 text-primary" />
            <p className="font-body-md text-body-md text-on-surface">{progress}</p>
          </div>
        ) : (
          <>
            <div className="flex size-20 items-center justify-center rounded-full bg-surface-container-low transition-transform duration-300 group-hover:scale-110">
              <Icon name="cloud_upload" size={40} className="text-primary" />
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-headline-md text-headline-md text-on-surface">
                Drag & drop your resume
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                PDF only · parsed locally in your browser
              </span>
            </div>
            <Button className="mt-2" onClick={() => inputRef.current?.click()}>
              <Icon name="upload_file" size={18} />
              Browse Files
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
        <p className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning-container px-4 py-3 font-body-sm text-body-sm text-warning">
          <Icon name="key" size={18} />
          You need a Groq API key (free) to analyze your resume.{" "}
          <button className="font-semibold underline" onClick={() => navigate("/app/settings")}>
            Add it in Settings
          </button>
        </p>
      )}
    </div>
  );
}

function ResumeView({ resume, onReanalyze }: { resume: ResumeData; onReanalyze: () => void }) {
  const updateResume = useAppStore((s) => s.updateResume);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    fullName: resume.fullName ?? "",
    headline: resume.headline ?? "",
    location: resume.location ?? "",
    email: resume.email ?? "",
    phone: resume.phone ?? "",
    linkedin: resume.linkedin ?? "",
    summary: resume.summary ?? "",
    skills: [...resume.skills],
  });
  const [newSkill, setNewSkill] = useState("");

  function startEdit() {
    setDraft({
      fullName: resume.fullName ?? "",
      headline: resume.headline ?? "",
      location: resume.location ?? "",
      email: resume.email ?? "",
      phone: resume.phone ?? "",
      linkedin: resume.linkedin ?? "",
      summary: resume.summary ?? "",
      skills: [...resume.skills],
    });
    setEditing(true);
  }

  function save() {
    const skills = draft.skills.map((s) => s.trim()).filter(Boolean);
    updateResume({
      fullName: draft.fullName.trim() || undefined,
      headline: draft.headline.trim() || undefined,
      location: draft.location.trim() || undefined,
      email: draft.email.trim() || undefined,
      phone: draft.phone.trim() || undefined,
      linkedin: draft.linkedin.trim() || undefined,
      summary: draft.summary.trim(),
      skills: [...new Set(skills)],
    });
    setEditing(false);
  }

  function addSkill() {
    const skill = newSkill.trim();
    if (!skill || draft.skills.some((s) => s.toLowerCase() === skill.toLowerCase())) return;
    setDraft((d) => ({ ...d, skills: [...d.skills, skill] }));
    setNewSkill("");
  }

  function set<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Your profile</h1>
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
            {resume.fileName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!editing && (
            <Button variant="secondary" size="sm" onClick={startEdit}>
              <Icon name="edit" size={16} />
              Edit
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onReanalyze}>
            Re-upload
          </Button>
        </div>
      </div>

      <Card className="p-6">
        {editing ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <Input value={draft.fullName} onChange={(e) => set("fullName", e.target.value)} />
              </Field>
              <Field label="Headline">
                <Input value={draft.headline} onChange={(e) => set("headline", e.target.value)} />
              </Field>
              <Field label="Location">
                <Input value={draft.location} onChange={(e) => set("location", e.target.value)} />
              </Field>
              <Field label="Email">
                <Input value={draft.email} onChange={(e) => set("email", e.target.value)} />
              </Field>
              <Field label="Phone">
                <Input value={draft.phone} onChange={(e) => set("phone", e.target.value)} />
              </Field>
              <Field label="LinkedIn">
                <Input value={draft.linkedin} onChange={(e) => set("linkedin", e.target.value)} />
              </Field>
            </div>
            <Field label="Summary">
              <Textarea
                value={draft.summary}
                onChange={(e) => set("summary", e.target.value)}
                className="min-h-28"
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={save}>
                Save changes
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-headline-lg text-headline-lg text-on-surface">
                  {resume.fullName ?? "Untitled"}
                </h2>
                <p className="mt-0.5 font-body-md text-body-md text-on-surface-variant">
                  {[resume.headline, resume.location].filter(Boolean).join(" · ") || "—"}
                </p>
                <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
                  {[resume.email, resume.phone, resume.linkedin].filter(Boolean).join(" · ") || ""}
                </p>
              </div>
              <Badge tone="success" dot>
                Ready
              </Badge>
            </div>
            {resume.summary && (
              <p className="mt-4 font-body-md text-body-md text-on-surface">{resume.summary}</p>
            )}
          </>
        )}
      </Card>

      {resume.skills.length > 0 || editing ? (
        <Card className="p-6">
          <h3 className="font-headline-md text-headline-md text-on-surface">Skills</h3>
          {editing ? (
            <div className="mt-3">
              <div className="flex flex-wrap gap-2">
                {draft.skills.map((s) => (
                  <Chip
                    key={s}
                    onRemove={() =>
                      set(
                        "skills",
                        draft.skills.filter((x) => x !== s),
                      )
                    }
                  >
                    {s}
                  </Chip>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <Input
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSkill();
                    }
                  }}
                  placeholder="Add a skill…"
                />
                <Button variant="secondary" size="md" onClick={addSkill} disabled={!newSkill.trim()}>
                  <Icon name="add" size={18} />
                  Add
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {resume.skills.map((s) => (
                <Chip key={s}>{s}</Chip>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      {resume.experience.length > 0 && (
        <Card className="p-6">
          <h3 className="font-headline-md text-headline-md text-on-surface">Experience</h3>
          <div className="mt-4 space-y-5">
            {resume.experience.map((xp, i) => (
              <div key={i}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="font-body-lg text-body-lg font-semibold text-on-surface">
                    {xp.title}
                  </h4>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    {[xp.startDate, xp.endDate ?? (xp.current ? "Present" : undefined)].filter(Boolean).join(" – ")}
                  </span>
                </div>
                <p className="font-body-md text-body-md font-medium text-primary">{xp.company}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 font-body-sm text-body-sm text-on-surface-variant">
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
        <Card className="p-6">
          <h3 className="font-headline-md text-headline-md text-on-surface">Education</h3>
          <div className="mt-4 space-y-4">
            {resume.education.map((ed, i) => (
              <div key={i}>
                <h4 className="font-body-lg text-body-lg font-semibold text-on-surface">{ed.degree}</h4>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
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
