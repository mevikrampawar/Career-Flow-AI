import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import type { CandidateProfile } from "../lib/types";
import { Button } from "./ui/Button";
import { Card, CardHeader } from "./ui/Card";
import { Field, Input, Textarea } from "./ui/Input";
import { Icon } from "./ui/Icon";
import { Badge } from "./ui/Badge";
import { useToast } from "./ui/Toast";

type ProfileDraft = Omit<CandidateProfile, "updatedAt">;

const CONTACT_FIELDS: { key: keyof ProfileDraft; label: string; type?: string; placeholder?: string }[] = [
  { key: "fullName", label: "Full name", placeholder: "Jane Applicant" },
  { key: "email", label: "Email", type: "email", placeholder: "jane@example.com" },
  { key: "phone", label: "Phone", type: "tel", placeholder: "+1 555 000 1234" },
  { key: "location", label: "Location", placeholder: "San Francisco, CA" },
  { key: "linkedin", label: "LinkedIn", type: "url", placeholder: "linkedin.com/in/jane" },
  { key: "portfolio", label: "Portfolio / website", type: "url", placeholder: "jane.dev" },
];

const APPLY_FIELDS: { key: keyof ProfileDraft; label: string; placeholder: string }[] = [
  { key: "workAuthorization", label: "Work authorization", placeholder: "US Citizen, H1B, etc." },
  { key: "salaryExpectation", label: "Salary expectation", placeholder: "$140k" },
  { key: "noticePeriod", label: "Notice period", placeholder: "2 weeks" },
  { key: "yearsExperience", label: "Years of experience", placeholder: "8 years" },
];

export function CandidateProfileCard() {
  const candidateProfile = useAppStore((s) => s.candidateProfile);
  const setCandidateProfile = useAppStore((s) => s.setCandidateProfile);
  const { push } = useToast();
  const [editing, setEditing] = useState(!candidateProfile);
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFrom(candidateProfile));

  function startEdit() {
    setDraft(draftFrom(candidateProfile));
    setEditing(true);
  }

  function setField<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function save() {
    const clean = (v?: string) => v?.trim() || undefined;
    const screeningAnswers = draft.screeningAnswers
      .map((a) => ({ question: a.question.trim(), answer: a.answer.trim() }))
      .filter((a) => a.question || a.answer);
    setCandidateProfile({
      fullName: clean(draft.fullName),
      email: clean(draft.email),
      phone: clean(draft.phone),
      location: clean(draft.location),
      linkedin: clean(draft.linkedin),
      portfolio: clean(draft.portfolio),
      workAuthorization: clean(draft.workAuthorization),
      salaryExpectation: clean(draft.salaryExpectation),
      noticePeriod: clean(draft.noticePeriod),
      yearsExperience: clean(draft.yearsExperience),
      screeningAnswers,
      updatedAt: Date.now(),
    });
    setEditing(false);
    push("success", "Profile saved and synced to your account.");
  }

  const fields: { label: string; value?: string; href?: string }[] = [
    { label: "Email", value: draft.email },
    { label: "Phone", value: draft.phone },
    { label: "Location", value: draft.location },
    { label: "LinkedIn", value: draft.linkedin, href: draft.linkedin },
    { label: "Portfolio", value: draft.portfolio, href: draft.portfolio },
    { label: "Work authorization", value: draft.workAuthorization },
    { label: "Salary expectation", value: draft.salaryExpectation },
    { label: "Notice period", value: draft.noticePeriod },
    { label: "Years of experience", value: draft.yearsExperience },
  ].filter((f) => f.value);

  const filledCount = candidateProfile
    ? fields.length + candidateProfile.screeningAnswers.length
    : 0;

  return (
    <Card>
      <CardHeader
        title="Your profile"
        subtitle="Global applicant details used for emails and auto-apply forms."
        action={
          !editing && (
            <Button size="sm" variant="secondary" onClick={startEdit}>
              <Icon name="edit" size={16} />
              Edit
            </Button>
          )
        }
      />
      <div className="p-5 pt-2">
        {editing ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {CONTACT_FIELDS.map((f) => (
                <Field key={f.key} label={f.label}>
                  <Input
                    type={f.type ?? "text"}
                    value={(draft[f.key] as string) ?? ""}
                    onChange={(e) => setField(f.key, e.target.value)}
                    placeholder={f.placeholder}
                  />
                </Field>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {APPLY_FIELDS.map((f) => (
                <Field key={f.key} label={f.label}>
                  <Input
                    value={(draft[f.key] as string) ?? ""}
                    onChange={(e) => setField(f.key, e.target.value)}
                    placeholder={f.placeholder}
                  />
                </Field>
              ))}
            </div>
            <div>
              <p className="text-label-sm uppercase tracking-wide text-on-surface-variant">
                Screening answers
              </p>
              <p className="mt-0.5 text-body-sm text-on-surface-variant">
                Common questions to prefill on application forms.
              </p>
              <div className="mt-3 space-y-3">
                {draft.screeningAnswers.map((a, i) => (
                  <div key={i} className="flex flex-col gap-2 rounded-lg border border-border-variant bg-surface-container-lowest p-3">
                    <div className="flex gap-2">
                      <Input
                        value={a.question}
                        onChange={(e) => {
                          const next = [...draft.screeningAnswers];
                          next[i] = { ...next[i], question: e.target.value };
                          setField("screeningAnswers", next);
                        }}
                        placeholder="Question (e.g. Are you authorized to work?)"
                        className="flex-1"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setField(
                            "screeningAnswers",
                            draft.screeningAnswers.filter((_, j) => j !== i),
                          )
                        }
                        className="grid size-10 shrink-0 place-items-center rounded-lg text-on-surface-variant hover:bg-error-container/40 hover:text-error"
                        aria-label="Remove question"
                      >
                        <Icon name="delete" size={18} />
                      </button>
                    </div>
                    <Textarea
                      value={a.answer}
                      onChange={(e) => {
                        const next = [...draft.screeningAnswers];
                        next[i] = { ...next[i], answer: e.target.value };
                        setField("screeningAnswers", next);
                      }}
                      placeholder="Answer"
                      className="min-h-16"
                    />
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setField("screeningAnswers", [...draft.screeningAnswers, { question: "", answer: "" }])
                  }
                >
                  <Icon name="add" size={16} />
                  Add question
                </Button>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              {candidateProfile && (
                <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              )}
              <Button size="sm" onClick={save}>
                Save profile
              </Button>
            </div>
          </div>
        ) : !candidateProfile ? (
          <div className="flex items-center justify-between gap-4 rounded-lg bg-surface-container-low px-4 py-3">
            <p className="text-body-sm text-on-surface-variant">
              Add your contact details, work authorization, and screening answers once — they'll be
              reused for every application.
            </p>
            <Button size="sm" onClick={startEdit}>
              <Icon name="add" size={16} />
              Add profile
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-headline-lg text-on-surface">
                  {candidateProfile.fullName ?? "Profile"}
                </h2>
                <p className="mt-0.5 text-body-md text-on-surface-variant">
                  {candidateProfile.yearsExperience
                    ? `${candidateProfile.yearsExperience}${candidateProfile.location ? ` · ${candidateProfile.location}` : ""}`
                    : candidateProfile.location ?? ""}
                </p>
              </div>
              <Badge tone="success" dot>
                {filledCount} {filledCount === 1 ? "field" : "fields"}
              </Badge>
            </div>
            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.label} className="flex items-baseline gap-2">
                  <span className="shrink-0 text-label-sm uppercase tracking-wide text-on-surface-variant">
                    {f.label}
                  </span>
                  {f.href && !f.href.startsWith("mailto:") ? (
                    <a
                      href={f.href.startsWith("http") ? f.href : `https://${f.href}`}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 truncate text-body-sm text-primary hover:underline"
                    >
                      {f.value}
                    </a>
                  ) : (
                    <span className="min-w-0 truncate text-body-sm text-on-surface">
                      {f.value}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {candidateProfile.screeningAnswers.length > 0 && (
              <div className="rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-4 py-3">
                <p className="text-label-sm uppercase tracking-wide text-on-surface-variant">
                  Screening answers
                </p>
                <dl className="mt-2 space-y-2">
                  {candidateProfile.screeningAnswers.map((a, i) => (
                    <div key={i}>
                      <dt className="text-body-sm font-medium text-on-surface">{a.question}</dt>
                      <dd className="text-body-sm text-on-surface-variant">{a.answer}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function draftFrom(p: CandidateProfile | null): ProfileDraft {
  return {
    fullName: p?.fullName ?? "",
    email: p?.email ?? "",
    phone: p?.phone ?? "",
    location: p?.location ?? "",
    linkedin: p?.linkedin ?? "",
    portfolio: p?.portfolio ?? "",
    workAuthorization: p?.workAuthorization ?? "",
    salaryExpectation: p?.salaryExpectation ?? "",
    noticePeriod: p?.noticePeriod ?? "",
    yearsExperience: p?.yearsExperience ?? "",
    screeningAnswers: p?.screeningAnswers ?? [],
  };
}
