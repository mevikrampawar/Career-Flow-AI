import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";
import { useKeys } from "../lib/keys";
import { useGmail } from "../lib/GmailProvider";
import {
  dataUrlToBytes,
  fetchGmailThread,
  sendGmail,
  type GmailThreadMessage,
} from "../lib/gmail";
import { generateCoverLetter, generateEmail, tailorResume } from "../lib/groq";
import { buildEmailBody, buildEmailSubject, jobKey, parseEmailList } from "../lib/format";
import {
  STATUS_LABEL,
  STATUS_TONE,
  STATUS_OPTIONS,
} from "../lib/applications";
import type { Application, JobPosting } from "../lib/types";
import { Button, Spinner } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { Input, Textarea } from "../components/ui/Input";
import { Icon } from "../components/ui/Icon";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { MatchScore, ScoreLabel } from "../components/MatchScore";
import { useToast } from "../components/ui/Toast";

const SAVE_DELAY = 500;

function fullDraft(subject: string, body: string, emails: string[]) {
  return `To: ${emails.join(", ")}\nSubject: ${subject}\n\n${body}`;
}

/** Pull the subject/body out of a "To:/Subject:/body" draft string. */
function splitDraft(draft: string): { subject: string; body: string } {
  const [header = "", ...rest] = draft.split(/\n\n/);
  const body = rest.join("\n\n");
  const subject =
    header
      .split("\n")
      .find((l) => l.startsWith("Subject: "))
      ?.slice("Subject: ".length) ?? "";
  return { subject, body };
}

function formatDate(ts?: number): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString();
}

export default function ApplyPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { keys, hasGroq } = useKeys();
  const gmail = useGmail();
  const { push } = useToast();
  const resume = useAppStore((s) => s.resume);
  const candidateProfile = useAppStore((s) => s.candidateProfile);
  const savedJobs = useAppStore((s) => s.savedJobs);
  const searchJobs = useAppStore((s) => s.searchJobs);
  const scrapedJobs = useAppStore((s) => s.scrapedJobs);
  const applications = useAppStore((s) => s.applications);
  const ensureApplication = useAppStore((s) => s.ensureApplication);
  const updateApplication = useAppStore((s) => s.updateApplication);
  const removeJobEmail = useAppStore((s) => s.removeJobEmail);
  const setJobEmails = useAppStore((s) => s.setJobEmails);

  // Resolve the application first so a record whose job was later unsaved or
  // dropped from the matcher results still opens from the pipeline/dashboard
  // (its snapshot lives on the Application itself).
  const existing = applications.find(
    (a) => jobKey(a.job) === jobId || a.job.id === jobId,
  );

  const job: JobPosting | undefined =
    [savedJobs, searchJobs, scrapedJobs]
      .flat()
      .find((j) => jobKey(j) === jobId || j.id === jobId) ??
    (existing
      ? {
          id: existing.job.id,
          key: existing.job.key,
          board: existing.job.board ?? "linkedin",
          title: existing.job.title,
          company: existing.job.company,
          location: "",
          description: "",
          url: existing.job.url ?? "",
        }
      : undefined);

  const [busy, setBusy] = useState<"tailor" | "letter" | "email" | null>(null);
  const [summary, setSummary] = useState("");
  const [highlights, setHighlights] = useState("");
  const [letter, setLetter] = useState("");
  const [notes, setNotes] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [addingEmails, setAddingEmails] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [thread, setThread] = useState<GmailThreadMessage[] | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const hydrated = useRef<string | null>(null);

  useEffect(() => {
    if (!job) return;
    ensureApplication(job);
  }, [jobId]);

  useEffect(() => {
    if (!existing || hydrated.current === existing.id) return;
    hydrated.current = existing.id;
    setSummary(existing.tailoredSummary ?? "");
    setHighlights(existing.tailoredHighlights ?? "");
    setLetter(existing.coverLetter ?? "");
    setNotes(existing.notes ?? "");
    const draft = existing.emailDraft ? splitDraft(existing.emailDraft) : null;
    setEmailSubject(existing.emailSubject ?? draft?.subject ?? "");
    setEmailBody(existing.emailBody ?? draft?.body ?? "");
  }, [existing]);

  useEffect(() => {
    if (!existing) return;
    const t = setTimeout(() => {
      updateApplication(existing.id, {
        coverLetter: letter.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setSavedAt(Date.now());
    }, SAVE_DELAY);
    return () => clearTimeout(t);
  }, [letter, notes, existing?.id]);

  async function copyText(kind: string, text: string) {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  }

  if (!job) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Job not found</h1>
        <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant">
          This job isn't in your saved, search, or scraped lists anymore.
        </p>
        <Link to="/app/jobs" className="mt-6 inline-block">
          <Button>Back to jobs</Button>
        </Link>
      </div>
    );
  }

  const currentJob = job;
  const emails = existing?.emails ?? currentJob.emails ?? [];
  const attachments = (() => {
    const list: { filename: string; mimeType: string; data: Uint8Array }[] = [];
    if (resume?.pdfDataUrl) {
      const { data, mimeType } = dataUrlToBytes(resume.pdfDataUrl);
      list.push({ filename: resume.fileName, mimeType, data });
    }
    if (letter.trim()) {
      list.push({
        filename: "cover-letter.txt",
        mimeType: "text/plain",
        data: new TextEncoder().encode(letter.trim()),
      });
    }
    return list;
  })();

  const profileFields = candidateProfile
    ? [
        { label: "Name", value: candidateProfile.fullName },
        { label: "Email", value: candidateProfile.email },
        { label: "Phone", value: candidateProfile.phone },
        { label: "Location", value: candidateProfile.location },
        { label: "Work authorization", value: candidateProfile.workAuthorization },
        { label: "Salary expectation", value: candidateProfile.salaryExpectation },
        { label: "Years experience", value: candidateProfile.yearsExperience },
        { label: "Notice period", value: candidateProfile.noticePeriod },
      ].filter((f) => f.value)
    : [];

  function commitStatus(status: Application["status"]) {
    if (!existing) return;
    const patch: Partial<Application> = { status };
    if (status === "applied" && !existing.appliedAt) patch.appliedAt = Date.now();
    updateApplication(existing.id, patch);
    push("success", `Status set to ${STATUS_LABEL[status]}.`);
  }

  async function run(kind: "tailor" | "letter" | "email") {
    if (kind === "tailor" || kind === "letter") {
      if (!resume || !hasGroq) {
        push("error", "You need a resume and a Groq key for this.");
        navigate("/app/profile");
        return;
      }
    }
    setBusy(kind);
    try {
      if (kind === "tailor") {
        const r = await tailorResume(keys.groqApiKey, resume!, currentJob);
        setSummary(r.tailoredSummary);
        setHighlights(r.tailoredHighlights.join("\n"));
        updateApplication(existing!.id, {
          tailoredSummary: r.tailoredSummary,
          tailoredHighlights: r.tailoredHighlights.join("\n"),
        });
      } else if (kind === "letter") {
        const text = await generateCoverLetter(keys.groqApiKey, resume!, currentJob);
        setLetter(text);
      } else {
        let subject: string;
        let body: string;
        if (resume && hasGroq) {
          const r = await generateEmail(keys.groqApiKey, resume, currentJob, letter.trim() || undefined);
          subject = r.subject;
          body = r.body;
        } else {
          subject = buildEmailSubject(currentJob);
          body = buildEmailBody(currentJob, resume, letter.trim() || undefined);
        }
        setEmailSubject(subject);
        setEmailBody(body);
        if (existing) {
          updateApplication(existing.id, {
            emailSubject: subject,
            emailBody: body,
            emailDraft: fullDraft(subject, body, emails),
          });
        }
      }
    } catch (e) {
      push("error", e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setBusy(null);
    }
  }

  function addEmails() {
    const parsed = parseEmailList(newEmail);
    if (parsed.length === 0) return;
    setJobEmails(currentJob, [...emails, ...parsed]);
    setNewEmail("");
    setAddingEmails(false);
    push("success", parsed.length === 1 ? "Email added to this job everywhere." : "Emails added to this job everywhere.");
  }

  async function sendApplication() {
    if (!existing || emails.length === 0 || !emailSubject || !emailBody) return;
    setSending(true);
    try {
      const token = await gmail.getToken();
      const result = await sendGmail(token, {
        to: emails.join(","),
        subject: emailSubject,
        body: emailBody,
        attachments,
      });
      updateApplication(existing.id, {
        status: "applied",
        appliedAt: existing.appliedAt ?? Date.now(),
        threadId: result.threadId,
        sentMessageId: result.id,
        sentAt: Date.now(),
        lastReplyAt: undefined,
      });
      push("success", "Application sent. It's now in your inbox thread.");
      navigate("/app/applications");
    } catch (e) {
      push("error", e instanceof Error ? e.message : "Could not send the application.");
    } finally {
      setSending(false);
      setConfirmOpen(false);
    }
  }

  const refreshThread = useCallback(
    async (app: Application) => {
      if (!app.threadId || !gmail.connected) return;
      setThreadLoading(true);
      try {
        const token = await gmail.getToken();
        const messages = await fetchGmailThread(token, app.threadId);
        setThread(messages);
        const inbound = messages.find(
          (m) =>
            m.internalDate &&
            Number(m.internalDate) > (app.sentAt ?? 0) &&
            m.from &&
            !m.from.includes(gmail.email ?? ""),
        );
        if (inbound && app.lastReplyAt !== Number(inbound.internalDate)) {
          updateApplication(app.id, { lastReplyAt: Number(inbound.internalDate) });
        }
      } catch {
        setThread([]);
      } finally {
        setThreadLoading(false);
      }
    },
    [gmail, updateApplication],
  );

  useEffect(() => {
    if (!existing?.threadId || !gmail.connected) {
      setThread(null);
      return;
    }
    let cancelled = false;
    setThreadLoading(true);
    gmail
      .getToken()
      .then((token) => fetchGmailThread(token, existing.threadId!))
      .then((messages) => {
        if (cancelled) return;
        setThread(messages);
        const inbound = messages.find(
          (m) =>
            m.internalDate &&
            Number(m.internalDate) > (existing.sentAt ?? 0) &&
            m.from &&
            !m.from.includes(gmail.email ?? ""),
        );
        if (inbound && existing.lastReplyAt !== Number(inbound.internalDate)) {
          updateApplication(existing.id, { lastReplyAt: Number(inbound.internalDate) });
        }
      })
      .catch(() => {
        if (!cancelled) setThread([]);
      })
      .finally(() => {
        if (!cancelled) setThreadLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [existing?.threadId, existing?.sentAt, gmail.connected]);

  const canSend = Boolean(existing) && emails.length > 0 && Boolean(emailSubject) && Boolean(emailBody);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link
        to="/app/applications"
        className="inline-flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant transition-colors hover:text-primary"
      >
        <Icon name="arrow_back" size={16} />
        Applications
      </Link>

      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-lg border border-variant bg-surface-container font-headline-md text-headline-md font-bold text-primary">
              {currentJob.company.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <h1 className="truncate font-headline-lg text-headline-lg text-on-surface">
                {currentJob.title}
              </h1>
              <p className="mt-1 font-body-md text-body-md font-medium text-primary">
                {currentJob.company}
              </p>
              <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
                {[currentJob.location, currentJob.employmentType, currentJob.salary].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
          </div>
          {currentJob.matchScore !== undefined && (
            <div className="shrink-0 text-center">
              <MatchScore score={currentJob.matchScore} size="md" />
              <div className="mt-1 font-label-sm text-label-sm text-on-surface-variant">
                <ScoreLabel score={currentJob.matchScore} />
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-variant/50 pt-4">
          {existing && (
            <Badge tone={STATUS_TONE[existing.status]} dot>
              {STATUS_LABEL[existing.status]}
            </Badge>
          )}
          {existing?.lastReplyAt && (
            <Badge tone="warning" dot>
              Reply received
            </Badge>
          )}
          {currentJob.url && (
            <a href={currentJob.url} target="_blank" rel="noreferrer" className="ml-auto">
              <Button size="sm" variant="secondary">
                Open application
                <Icon name="arrow_outward" size={16} />
              </Button>
            </a>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">Stage</h2>
            <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
              Where is this one right now?
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 font-body-sm text-body-sm text-on-surface-variant">
            <Icon name="cloud_done" size={16} className={existing ? "text-success" : "text-outline-variant"} />
            {savedAt ? "Saved" : "Auto-saves"}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((s) => {
            const active = existing?.status === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => commitStatus(s)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-label-sm text-label-sm transition-colors ${
                  active
                    ? "border-primary bg-primary-container text-on-primary-container"
                    : "border-border-variant bg-surface-container-lowest text-on-surface-variant hover:border-outline-variant hover:text-on-surface"
                }`}
              >
                <Icon
                  name={
                    active
                      ? "radio_button_checked"
                      : STATUS_TONE[s] === "error"
                        ? "block"
                        : "radio_button_unchecked"
                  }
                  size={14}
                />
                {STATUS_LABEL[s]}
              </button>
            );
          })}
        </div>
        {existing?.appliedAt && (
          <p className="mt-3 font-body-sm text-body-sm text-on-surface-variant">
            Applied on {new Date(existing.appliedAt).toLocaleDateString()}.
            {existing.sentAt ? ` Email sent ${formatDate(existing.sentAt)}.` : ""}
          </p>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Tailored summary"
          subtitle="Your strongest selling points for this exact role — read-only, generated by AI."
          action={
            <Button size="sm" variant="secondary" loading={busy === "tailor"} onClick={() => run("tailor")}>
              <Icon name="auto_awesome" size={16} />
              Tailor
            </Button>
          }
        />
        <div className="p-5 pt-2">
          {summary || highlights ? (
            <div className="rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-4 py-3">
              {summary && (
                <p className="font-body-md text-body-md text-on-surface">{summary}</p>
              )}
              {highlights && (
                <ul className="mt-3 space-y-1.5">
                  {highlights
                    .split("\n")
                    .map((h) => h.trim())
                    .filter(Boolean)
                    .slice(0, 6)
                    .map((h, i) => (
                      <li key={i} className="flex gap-2 font-body-sm text-body-sm text-on-surface-variant">
                        <Icon name="check_circle" size={16} className="mt-0.5 shrink-0 text-primary" />
                        <span>{h}</span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="rounded-lg bg-surface-container-low px-4 py-3 font-body-sm text-body-sm text-on-surface-variant">
              No tailored summary yet. Hit <strong>Tailor</strong> to generate one from your resume
              and this job description.
            </p>
          )}
          {(summary || highlights) && (
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyText("summary", [summary, highlights].filter(Boolean).join("\n\n"))}
              >
                {copied === "summary" ? (
                  <>
                    <Icon name="check" size={14} /> Copied
                  </>
                ) : (
                  <>
                    <Icon name="content_copy" size={14} /> Copy
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Cover letter"
          subtitle="Generated from your real experience — edit before sending."
          action={
            <Button size="sm" variant="secondary" loading={busy === "letter"} onClick={() => run("letter")}>
              <Icon name="auto_awesome" size={16} />
              Write
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
              onClick={() => copyText("letter", letter)}
            >
              {copied === "letter" ? (
                <>
                  <Icon name="check" size={16} /> Copied
                </>
              ) : (
                <>
                  <Icon name="content_copy" size={16} /> Copy letter
                </>
              )}
            </Button>
            {letter.trim() && (
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Attached as cover-letter.txt when sent via Gmail.
              </span>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Email"
          subtitle="A subject + body tailored to this role, ready to send or copy."
          action={
            <div className="flex items-center gap-2">
              {emailSubject && (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busy === "email"}
                  onClick={() => run("email")}
                >
                  <Icon name="refresh" size={16} />
                  Regenerate
                </Button>
              )}
              <Button size="sm" loading={busy === "email"} onClick={() => run("email")}>
                <Icon name="auto_awesome" size={16} />
                Create email
              </Button>
            </div>
          }
        />
        <div className="space-y-4 p-5 pt-2">
          {emailSubject ? (
            <>
              <div className="rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-4 py-3">
                <p className="font-label-sm text-label-sm uppercase tracking-wide text-on-surface-variant">
                  Subject
                </p>
                <p className="mt-1 font-body-md text-body-md font-medium text-on-surface">
                  {emailSubject}
                </p>
              </div>
              <div className="rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-4 py-3">
                <p className="font-label-sm text-label-sm uppercase tracking-wide text-on-surface-variant">
                  Body
                </p>
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap font-body-sm text-body-sm text-on-surface">
                  {emailBody}
                </pre>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  disabled={!emailBody}
                  onClick={() => copyText("email", fullDraft(emailSubject, emailBody, emails))}
                >
                  {copied === "email" ? (
                    <>
                      <Icon name="check" size={16} /> Copied
                    </>
                  ) : (
                    <>
                      <Icon name="content_copy" size={16} /> Copy email
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!emailSubject}
                  onClick={() => copyText("subject", emailSubject)}
                >
                  {copied === "subject" ? (
                    <>
                      <Icon name="check" size={16} /> Copied
                    </>
                  ) : (
                    <>
                      <Icon name="title" size={16} /> Copy subject
                    </>
                  )}
                </Button>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  {emails.length > 0
                    ? `Sends to ${emails.join(", ")}`
                    : "Add a contact email below before sending."}
                </span>
              </div>
            </>
          ) : (
            <p className="rounded-lg bg-surface-container-low px-4 py-3 font-body-sm text-body-sm text-on-surface-variant">
              No email drafted yet. Hit <strong>Create email</strong> to write a subject + body for
              this role from your resume{hasGroq ? " with Groq" : ""}.
            </p>
          )}

          <div className="border-t border-variant/50 pt-4">
            <p className="font-label-sm text-label-sm uppercase tracking-wide text-on-surface-variant">
              Contact email{emails.length === 1 ? "" : "s"}
            </p>
            {emails.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {emails.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 rounded-md border border-variant/50 bg-surface pl-2.5 pr-1 py-1 font-body-sm text-body-sm text-on-surface"
                  >
                    <Icon name="mail" size={15} className="text-primary" />
                    {email}
                    <button
                      type="button"
                      aria-label={`Remove ${email}`}
                      onClick={() => removeJobEmail(currentJob, email)}
                      className="grid size-5 place-items-center rounded text-on-surface-variant transition-colors hover:bg-error-container/40 hover:text-error"
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {addingEmails ? (
              <div className="mt-3 space-y-2">
                <Input
                  type="text"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addEmails();
                    }
                  }}
                  placeholder="a@company.com, b@company.com…"
                  className="max-w-md font-mono"
                />
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="md" onClick={addEmails} disabled={!parseEmailList(newEmail).length}>
                    <Icon name="add" size={18} />
                    Add emails
                  </Button>
                  <Button variant="ghost" size="md" onClick={() => { setAddingEmails(false); setNewEmail(""); }}>
                    Cancel
                  </Button>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Paste several at once — separated by spaces, commas, or new lines.
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingEmails(true)}
                className="mt-3 inline-flex items-center gap-1.5 font-label-sm text-label-sm text-primary transition-colors hover:text-on-surface"
              >
                <Icon name="add" size={16} />
                {emails.length > 0 ? "Add more emails" : "Add emails"}
              </button>
            )}
            <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant">
              Emails attach to this job everywhere — saved, scraped, search, and this application.
            </p>
          </div>

          <div className="border-t border-variant/50 pt-4">
            <p className="font-label-sm text-label-sm uppercase tracking-wide text-on-surface-variant">
              Send
            </p>
            {gmail.connected ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => setConfirmOpen(true)}
                  disabled={!canSend || sending}
                  loading={sending}
                >
                  <Icon name="send" size={16} />
                  Send application
                </Button>
                {!canSend && (
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    {emails.length === 0
                      ? "Add a contact email above."
                      : !emailSubject
                        ? "Create an email above."
                        : "Ready when you are."}
                  </span>
                )}
                <div className="flex w-full flex-wrap gap-x-5 gap-y-1 font-body-sm text-body-sm text-on-surface-variant">
                  <span>From: {gmail.email}</span>
                  <span>To: {emails.join(", ") || "—"}</span>
                  <span>Attachment: {attachments.map((a) => a.filename).join(", ") || "none"}</span>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-warning-container/60 px-4 py-3 font-body-sm text-body-sm text-warning">
                <Icon name="info" size={16} className="mt-0.5 shrink-0" />
                <span>
                  Gmail isn't connected.{" "}
                  <button className="font-semibold underline" onClick={() => navigate("/app/profile")}>
                    Connect it in Profile
                  </button>{" "}
                  for one-click send — or use <strong>Copy email</strong> above and paste it into your mail
                  app, attaching your resume.
                </span>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Notes"
          subtitle="Interview prep, contacts, follow-ups — anything for this application."
        />
        <div className="p-5 pt-2">
          <Textarea
            placeholder="Things to remember about this application…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-28"
          />
        </div>
      </Card>

      {existing?.threadId && (
        <Card>
          <CardHeader
            title="Conversation"
            subtitle="The live thread in your Gmail for this application."
            action={
              <Button
                size="sm"
                variant="ghost"
                loading={threadLoading}
                onClick={() => existing && refreshThread(existing)}
                disabled={!gmail.connected}
              >
                <Icon name="refresh" size={16} />
                Refresh
              </Button>
            }
          />
          <div className="p-5 pt-2">
            {thread === null ? (
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {gmail.connected ? "Loading the thread…" : "Connect Gmail to read replies."}
              </p>
            ) : thread.length === 0 ? (
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Couldn't load the thread right now.
              </p>
            ) : (
              <div className="space-y-3">
                {thread.map((m) => {
                  const inbound = m.from && !m.from.includes(gmail.email ?? "");
                  return (
                    <div
                      key={m.id}
                      className={`rounded-lg border px-4 py-3 ${
                        inbound ? "border-primary/40 bg-primary-container/30" : "border-outline-variant/70 bg-surface-container-lowest"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-body-sm text-body-sm font-medium text-on-surface">
                          {inbound ? "Received from" : "Sent to"} {inbound ? m.from : m.to}
                        </span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant">
                          {new Date(Number(m.internalDate)).toLocaleString()}
                        </span>
                      </div>
                      {m.subject && (
                        <p className="mt-1 font-label-sm text-label-sm text-on-surface-variant">
                          {m.subject}
                        </p>
                      )}
                      <p className="mt-1 whitespace-pre-wrap font-body-sm text-body-sm text-on-surface">
                        {m.body || m.snippet}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Notes"
          subtitle="Interview prep, contacts, follow-ups — anything for this application."
        />
        <div className="p-5 pt-2">
          <Textarea
            placeholder="Things to remember about this application…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-28"
          />
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Everything here auto-saves to this application and syncs to your account.
        </p>
        <Button variant="secondary" onClick={() => navigate("/app/applications")}>
          View all applications
          <Icon name="arrow_forward" size={16} />
        </Button>
      </div>

      {busy && (
        <div className="flex items-center justify-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
          <Spinner className="size-4" /> Generating with Groq…
        </div>
      )}

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Send this application?" wide>
        <div className="space-y-4">
          <div className="rounded-lg border border-outline-variant/70 bg-surface-container-lowest p-4 font-body-sm text-body-sm text-on-surface">
            <p><span className="text-on-surface-variant">From:</span> {gmail.email}</p>
            <p><span className="text-on-surface-variant">To:</span> {emails.join(", ")}</p>
            <p><span className="text-on-surface-variant">Subject:</span> {emailSubject}</p>
            <p className="mt-2"><span className="text-on-surface-variant">Attachments:</span>{" "}
              {attachments.map((a) => a.filename).join(", ") || "none"}
            </p>
          </div>
          {profileFields.length > 0 && (
            <div className="rounded-lg border border-outline-variant/70 bg-surface-container-lowest p-4">
              <p className="font-label-sm text-label-sm uppercase tracking-wide text-on-surface-variant">
                Profile
              </p>
              <div className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                {profileFields.map((f) => (
                  <div key={f.label} className="flex items-baseline gap-2">
                    <span className="shrink-0 font-label-sm text-label-sm uppercase tracking-wide text-on-surface-variant">
                      {f.label}
                    </span>
                    <span className="truncate font-body-sm text-body-sm text-on-surface">{f.value}</span>
                  </div>
                ))}
              </div>
              {candidateProfile?.screeningAnswers.length ? (
                <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant">
                  {candidateProfile.screeningAnswers.length} saved screening answer
                  {candidateProfile.screeningAnswers.length === 1 ? "" : "s"} ready for forms.
                </p>
              ) : null}
            </div>
          )}
          {letter.trim() && (
            <div className="rounded-lg border border-outline-variant/70 bg-surface-container-lowest p-4">
              <p className="font-label-sm text-label-sm uppercase tracking-wide text-on-surface-variant">
                Cover letter
              </p>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-body-sm text-body-sm text-on-surface">
                {letter}
              </pre>
            </div>
          )}
          <div>
            <p className="font-label-sm text-label-sm uppercase tracking-wide text-on-surface-variant">
              Body
            </p>
            <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-container-low px-4 py-3 font-body-sm text-body-sm text-on-surface">
              {emailBody}
            </pre>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={sendApplication} loading={sending}>
              <Icon name="send" size={16} />
              {sending ? "Sending…" : "Send application"}
            </Button>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Sends from your Gmail, marks this Applied, and tracks replies.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
