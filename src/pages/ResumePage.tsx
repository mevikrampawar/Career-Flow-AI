import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";
import { useKeys } from "../lib/keys";
import { analyzeResume } from "../lib/groq";
import { parsePdfToText } from "../lib/resume";
import type { AnalysisStatus, Education, Project, ResumeData, WorkExperience } from "../lib/types";
import { Button, Spinner } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { Chip, Badge } from "../components/ui/Badge";
import { Field, Input, Textarea } from "../components/ui/Input";
import { Icon } from "../components/ui/Icon";
import { useToast } from "../components/ui/Toast";

type ResumeDraft = {
  fullName: string;
  headline: string;
  location: string;
  email: string;
  phone: string;
  linkedin: string;
  website: string;
  summary: string;
  skills: string[];
  experience: WorkExperience[];
  education: Education[];
  projects: Project[];
  certifications: string[];
  languages: string[];
};

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function strs(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

// Never let a malformed persisted resume (missing arrays, wrong types, null
// entries) throw while building the edit draft or rendering the profile view.
function draftFrom(r: ResumeData): ResumeDraft {
  return {
    fullName: str(r.fullName),
    headline: str(r.headline),
    location: str(r.location),
    email: str(r.email),
    phone: str(r.phone),
    linkedin: str(r.linkedin),
    website: str(r.website),
    summary: str(r.summary),
    skills: strs(r.skills),
    experience: (Array.isArray(r.experience) ? r.experience : []).map((e) => ({
      ...e,
      bullets: strs(e.bullets),
      technologies: strs(e.technologies),
    })),
    education: (Array.isArray(r.education) ? r.education : []).map((e) => ({
      ...e,
      details: strs(e.details),
    })),
    projects: (Array.isArray(r.projects) ? r.projects : []).map((p) => ({
      ...p,
      technologies: strs(p.technologies),
    })),
    certifications: strs(r.certifications),
    languages: strs(r.languages),
  };
}

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
  const [viewMode, setViewMode] = useState<"view" | "upload">("view");
  const inputRef = useRef<HTMLInputElement>(null);

  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error("Could not read the file."));
      reader.readAsDataURL(file);
    });
  }

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      push("error", "Please upload a PDF resume.");
      return;
    }
    if (!hasGroq) {
      push("error", "Add your Groq API key in Settings first.");
      navigate("/app/profile");
      return;
    }
    setStatus("parsing");
    setProgress("Parsing PDF...");
    try {
      const text = await parsePdfToText(file);
      const pdfDataUrl = await readFileAsDataUrl(file);
      // Keep the PDF only if it fits inside Firestore's 1 MiB document limit
      // alongside the parsed text (base64 is ~1.33x the file size).
      const pdfOk = pdfDataUrl.length < 600_000;
      if (!pdfOk) {
        push("info", "Resume PDF is large — it will still be parsed, but skipped as an attachment.");
      }
      setPreview(text);
      setProgress("Analyzing with Groq...");
      setStatus("analyzing");
      const analysis = await analyzeResume(keys.groqApiKey, text);
      const data: ResumeData = {
        id: crypto.randomUUID(),
        fileName: file.name,
        rawText: text,
        ...(pdfOk ? { pdfDataUrl } : {}),
        ...analysis,
        updatedAt: Date.now(),
      };
      setResume(data);
      setStatus("ready");
      setViewMode("view");
      push("success", "Resume analyzed and saved.");
    } catch (e) {
      setStatus("error");
      push("error", e instanceof Error ? e.message : "Failed to analyze resume.");
    }
  }

  if (resume && viewMode === "view") {
    return (
      <ResumeView
        resume={resume}
        onReanalyze={() => {
          setStatus("idle");
          setPreview("");
          setViewMode("upload");
        }}
      />
    );
  }

  const busy = status === "parsing" || status === "analyzing";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <header>
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-headline-lg text-headline-lg-mobile text-on-surface md:font-headline-lg md:text-headline-lg">
            Resume
          </h1>
          {resume && !busy && (
            <Button variant="ghost" size="sm" onClick={() => setViewMode("view")}>
              <Icon name="arrow_back" size={16} />
              Back to profile
            </Button>
          )}
        </div>
        <p className="mt-2 font-body-md text-body-md text-on-surface-variant">
          Upload a PDF. We extract your profile and analyze it with Groq.
          {resume ? " This will re-analyze your current resume from scratch." : ""}
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
                {resume ? "Upload a new resume" : "Drag & drop your resume"}
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                PDF only · parsed locally in your browser · re-analyzes everything
              </span>
            </div>
            <Button className="mt-2" onClick={() => inputRef.current?.click()}>
              <Icon name="upload_file" size={18} />
              {resume ? "Choose a new file" : "Browse Files"}
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
          <button className="font-semibold underline" onClick={() => navigate("/app/profile")}>
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
  const [draft, setDraft] = useState<ResumeDraft>(() => draftFrom(resume));
  const set = <K extends keyof ResumeDraft>(key: K, value: ResumeDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  // Defensive view copies — a malformed persisted resume must render, not crash.
  const skills = strs(resume.skills);
  const experience = (Array.isArray(resume.experience) ? resume.experience : []).map((e) => ({
    ...e,
    bullets: strs(e.bullets),
    technologies: strs(e.technologies),
  }));
  const education = (Array.isArray(resume.education) ? resume.education : []).map((e) => ({
    ...e,
    details: strs(e.details),
  }));
  const projects = (Array.isArray(resume.projects) ? resume.projects : []).map((p) => ({
    ...p,
    technologies: strs(p.technologies),
  }));
  const certifications = strs(resume.certifications);
  const languages = strs(resume.languages);

  function startEdit() {
    setDraft(draftFrom(resume));
    setEditing(true);
  }

  function save() {
    const clean = (v?: string) => v?.trim() || undefined;
    const cleanList = (list: string[]) => [...new Set(list.map((s) => s.trim()).filter(Boolean))];
    updateResume({
      fullName: clean(draft.fullName),
      headline: clean(draft.headline),
      location: clean(draft.location),
      email: clean(draft.email),
      phone: clean(draft.phone),
      linkedin: clean(draft.linkedin),
      website: clean(draft.website),
      summary: draft.summary.trim(),
      skills: cleanList(draft.skills),
      experience: draft.experience
        .filter((e) => e.title.trim() || e.company.trim())
        .map((e) => ({
          ...e,
          title: e.title.trim(),
          company: e.company.trim(),
          location: clean(e.location),
          startDate: clean(e.startDate),
          endDate: clean(e.endDate),
          bullets: e.bullets.map((b) => b.trim()).filter(Boolean),
          technologies: cleanList(e.technologies ?? []),
        })),
      education: draft.education
        .filter((e) => e.degree.trim() || e.institution.trim())
        .map((e) => ({
          ...e,
          degree: e.degree.trim(),
          institution: e.institution.trim(),
          startDate: clean(e.startDate),
          endDate: clean(e.endDate),
          details: (e.details ?? []).map((d) => d.trim()).filter(Boolean),
        })),
      projects: draft.projects
        .filter((p) => p.name.trim())
        .map((p) => ({
          ...p,
          name: p.name.trim(),
          description: p.description.trim(),
          link: clean(p.link),
          technologies: cleanList(p.technologies ?? []),
        })),
      certifications: cleanList(draft.certifications),
      languages: cleanList(draft.languages),
    });
    setEditing(false);
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
            <Icon name="refresh" size={16} />
            Re-upload
          </Button>
        </div>
      </div>

      {editing ? (
        <Card className="p-6">
          <div className="space-y-6">
            <div>
              <SectionTitle>Contact</SectionTitle>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
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
                  <Input value={draft.email} onChange={(e) => set("email", e.target.value)} type="email" />
                </Field>
                <Field label="Phone">
                  <Input value={draft.phone} onChange={(e) => set("phone", e.target.value)} type="tel" />
                </Field>
                <Field label="LinkedIn">
                  <Input value={draft.linkedin} onChange={(e) => set("linkedin", e.target.value)} />
                </Field>
                <Field label="Website">
                  <Input value={draft.website} onChange={(e) => set("website", e.target.value)} />
                </Field>
              </div>
            </div>

            <div>
              <SectionTitle>Summary</SectionTitle>
              <div className="mt-3">
                <Textarea
                  value={draft.summary}
                  onChange={(e) => set("summary", e.target.value)}
                  className="min-h-28"
                />
              </div>
            </div>

            <div>
              <SectionTitle>Skills</SectionTitle>
              <div className="mt-3">
                <ChipListField
                  values={draft.skills}
                  onChange={(v) => set("skills", v)}
                  placeholder="Add a skill…"
                />
              </div>
            </div>

            <div>
              <SectionTitle>Experience</SectionTitle>
              <div className="mt-3">
                <ExperienceEditor
                  value={draft.experience}
                  onChange={(v) => set("experience", v)}
                />
              </div>
            </div>

            <div>
              <SectionTitle>Education</SectionTitle>
              <div className="mt-3">
                <EducationEditor
                  value={draft.education}
                  onChange={(v) => set("education", v)}
                />
              </div>
            </div>

            <div>
              <SectionTitle>Projects</SectionTitle>
              <div className="mt-3">
                <ProjectEditor value={draft.projects} onChange={(v) => set("projects", v)} />
              </div>
            </div>

            <div>
              <SectionTitle>Certifications</SectionTitle>
              <div className="mt-3">
                <ChipListField
                  values={draft.certifications}
                  onChange={(v) => set("certifications", v)}
                  placeholder="Add a certification…"
                />
              </div>
            </div>

            <div>
              <SectionTitle>Languages</SectionTitle>
              <div className="mt-3">
                <ChipListField
                  values={draft.languages}
                  onChange={(v) => set("languages", v)}
                  placeholder="Add a language…"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border-variant/50 pt-4">
              <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={save}>
                <Icon name="check" size={16} />
                Save changes
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-headline-lg text-headline-lg text-on-surface">
                  {resume.fullName ?? "Untitled"}
                </h2>
                <p className="mt-0.5 font-body-md text-body-md text-on-surface-variant">
                  {[resume.headline, resume.location].filter(Boolean).join(" · ") || "—"}
                </p>
                <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
                  {[resume.email, resume.phone, resume.linkedin, resume.website].filter(Boolean).join(" · ") || ""}
                </p>
              </div>
              <Badge tone="success" dot>
                Ready
              </Badge>
            </div>
            {resume.summary && (
              <p className="mt-4 font-body-md text-body-md text-on-surface">{resume.summary}</p>
            )}
          </Card>

          {skills.length > 0 && (
            <Card className="p-6">
              <SectionTitle>Skills</SectionTitle>
              <div className="mt-3 flex flex-wrap gap-2">
                {skills.map((s) => (
                  <Chip key={s}>{s}</Chip>
                ))}
              </div>
            </Card>
          )}

          {experience.length > 0 && (
            <Card className="p-6">
              <SectionTitle>Experience</SectionTitle>
              <div className="mt-4 space-y-5">
                {experience.map((xp, i) => (
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

          {education.length > 0 && (
            <Card className="p-6">
              <SectionTitle>Education</SectionTitle>
              <div className="mt-4 space-y-4">
                {education.map((ed, i) => (
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

          {projects.length > 0 && (
            <Card className="p-6">
              <SectionTitle>Projects</SectionTitle>
              <div className="mt-4 space-y-5">
                {projects.map((p, i) => (
                  <div key={i}>
                    <h4 className="font-body-lg text-body-lg font-semibold text-on-surface">
                      {p.name}
                    </h4>
                    {p.description && (
                      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{p.description}</p>
                    )}
                    {p.link && (
                      <a href={p.link.startsWith("http") ? p.link : `https://${p.link}`} target="_blank" rel="noreferrer" className="mt-1 inline-block font-body-sm text-body-sm text-primary hover:underline">
                        {p.link}
                      </a>
                    )}
                    {p.technologies?.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {p.technologies.map((t) => (
                          <Chip key={t}>{t}</Chip>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {certifications.length > 0 && (
            <Card className="p-6">
              <SectionTitle>Certifications</SectionTitle>
              <div className="mt-3 flex flex-wrap gap-2">
                {certifications.map((c) => (
                  <Chip key={c}>{c}</Chip>
                ))}
              </div>
            </Card>
          )}

          {languages.length > 0 && (
            <Card className="p-6">
              <SectionTitle>Languages</SectionTitle>
              <div className="mt-3 flex flex-wrap gap-2">
                {languages.map((l) => (
                  <Chip key={l}>{l}</Chip>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-headline-md text-headline-md text-on-surface">{children}</h3>
  );
}

function ChipListField({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [newValue, setNewValue] = useState("");
  function add() {
    const v = newValue.trim();
    if (!v || values.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    onChange([...values, v]);
    setNewValue("");
  }
  return (
    <div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map((v) => (
            <Chip key={v} onRemove={() => onChange(values.filter((x) => x !== v))}>
              {v}
            </Chip>
          ))}
        </div>
      )}
      <div className="mt-2 flex gap-2">
        <Input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder ?? "Add…"}
        />
        <Button variant="secondary" size="md" onClick={add} disabled={!newValue.trim()}>
          <Icon name="add" size={18} />
          Add
        </Button>
      </div>
    </div>
  );
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-8 shrink-0 place-items-center rounded-lg text-on-surface-variant transition-colors hover:bg-error-container/40 hover:text-error"
    >
      <Icon name="delete" size={18} />
    </button>
  );
}

function ExperienceEditor({
  value,
  onChange,
}: {
  value: WorkExperience[];
  onChange: (v: WorkExperience[]) => void;
}) {
  function update(i: number, patch: Partial<WorkExperience>) {
    onChange(value.map((xp, j) => (j === i ? { ...xp, ...patch } : xp)));
  }
  function remove(i: number) {
    onChange(value.filter((_, j) => j !== i));
  }
  return (
    <div className="space-y-3">
      {value.map((xp, i) => (
        <div key={i} className="space-y-3 rounded-lg border border-border-variant bg-surface-container-lowest p-4">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md text-on-surface">
              {xp.title || xp.company || `Experience ${i + 1}`}
            </span>
            <RemoveButton onClick={() => remove(i)} label="Remove experience" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title">
              <Input value={xp.title} onChange={(e) => update(i, { title: e.target.value })} placeholder="Software Engineer" />
            </Field>
            <Field label="Company">
              <Input value={xp.company} onChange={(e) => update(i, { company: e.target.value })} placeholder="Acme Inc." />
            </Field>
            <Field label="Location">
              <Input value={xp.location ?? ""} onChange={(e) => update(i, { location: e.target.value })} placeholder="Remote / San Francisco" />
            </Field>
            <Field label="Start date">
              <Input value={xp.startDate ?? ""} onChange={(e) => update(i, { startDate: e.target.value })} placeholder="Jan 2021" />
            </Field>
            <Field label="End date">
              <Input value={xp.endDate ?? ""} onChange={(e) => update(i, { endDate: e.target.value })} placeholder="Present" />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 font-body-sm text-body-sm text-on-surface">
              <input
                type="checkbox"
                checked={Boolean(xp.current)}
                onChange={(e) => update(i, { current: e.target.checked })}
                className="size-4 accent-(--color-primary-container)"
              />
              Currently here
            </label>
          </div>
          <Field label="Bullets (one per line)">
            <Textarea
              value={xp.bullets.join("\n")}
              onChange={(e) => update(i, { bullets: e.target.value.split("\n") })}
              className="min-h-24 font-mono text-body-sm"
              placeholder={"Led a cross-functional team…\nShipped a new payments flow…"}
            />
          </Field>
          <div>
            <p className="mb-2 font-label-sm text-label-sm uppercase tracking-wide text-on-surface-variant">
              Technologies
            </p>
            <ChipListField
              values={xp.technologies ?? []}
              onChange={(t) => update(i, { technologies: t })}
              placeholder="Add a technology…"
            />
          </div>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange([...value, { title: "", company: "", bullets: [] }])}
      >
        <Icon name="add" size={16} />
        Add experience
      </Button>
    </div>
  );
}

function EducationEditor({
  value,
  onChange,
}: {
  value: Education[];
  onChange: (v: Education[]) => void;
}) {
  function update(i: number, patch: Partial<Education>) {
    onChange(value.map((ed, j) => (j === i ? { ...ed, ...patch } : ed)));
  }
  function remove(i: number) {
    onChange(value.filter((_, j) => j !== i));
  }
  return (
    <div className="space-y-3">
      {value.map((ed, i) => (
        <div key={i} className="space-y-3 rounded-lg border border-border-variant bg-surface-container-lowest p-4">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md text-on-surface">
              {ed.degree || ed.institution || `Education ${i + 1}`}
            </span>
            <RemoveButton onClick={() => remove(i)} label="Remove education" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Degree">
              <Input value={ed.degree} onChange={(e) => update(i, { degree: e.target.value })} placeholder="B.S. Computer Science" />
            </Field>
            <Field label="Institution">
              <Input value={ed.institution} onChange={(e) => update(i, { institution: e.target.value })} placeholder="State University" />
            </Field>
            <Field label="Start date">
              <Input value={ed.startDate ?? ""} onChange={(e) => update(i, { startDate: e.target.value })} placeholder="2014" />
            </Field>
            <Field label="End date">
              <Input value={ed.endDate ?? ""} onChange={(e) => update(i, { endDate: e.target.value })} placeholder="2018" />
            </Field>
          </div>
          <Field label="Details (one per line)">
            <Textarea
              value={(ed.details ?? []).join("\n")}
              onChange={(e) => update(i, { details: e.target.value.split("\n") })}
              className="min-h-16 font-mono text-body-sm"
              placeholder={"Relevant coursework…\nHonors…"}
            />
          </Field>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange([...value, { degree: "", institution: "" }])}
      >
        <Icon name="add" size={16} />
        Add education
      </Button>
    </div>
  );
}

function ProjectEditor({
  value,
  onChange,
}: {
  value: Project[];
  onChange: (v: Project[]) => void;
}) {
  function update(i: number, patch: Partial<Project>) {
    onChange(value.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  }
  function remove(i: number) {
    onChange(value.filter((_, j) => j !== i));
  }
  return (
    <div className="space-y-3">
      {value.map((p, i) => (
        <div key={i} className="space-y-3 rounded-lg border border-border-variant bg-surface-container-lowest p-4">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md text-on-surface">
              {p.name || `Project ${i + 1}`}
            </span>
            <RemoveButton onClick={() => remove(i)} label="Remove project" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input value={p.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="My Project" />
            </Field>
            <Field label="Link">
              <Input value={p.link ?? ""} onChange={(e) => update(i, { link: e.target.value })} placeholder="github.com/me/project" />
            </Field>
          </div>
          <Field label="Description">
            <Textarea
              value={p.description}
              onChange={(e) => update(i, { description: e.target.value })}
              className="min-h-16"
              placeholder="What it does and your role…"
            />
          </Field>
          <div>
            <p className="mb-2 font-label-sm text-label-sm uppercase tracking-wide text-on-surface-variant">
              Technologies
            </p>
            <ChipListField
              values={p.technologies ?? []}
              onChange={(t) => update(i, { technologies: t })}
              placeholder="Add a technology…"
            />
          </div>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange([...value, { name: "", description: "" }])}
      >
        <Icon name="add" size={16} />
        Add project
      </Button>
    </div>
  );
}
