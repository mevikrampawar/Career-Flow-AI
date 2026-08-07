export function stripHtml(input: string): string {
  if (!input || !/<[a-z][\s\S]*>/i.test(input)) return input.trim();
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(input, "text/html");
    const text = (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text) return text;
  }
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function timeAgo(value?: string): string {
  if (!value) return "";
  const t = Date.parse(value);
  if (Number.isNaN(t)) return value;
  const diff = Date.now() - t;
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) {
    const hours = Math.floor(diff / 3_600_000);
    if (hours <= 0) return "Posted today";
    return `Posted ${hours}h ago`;
  }
  if (days === 1) return "Posted yesterday";
  if (days < 30) return `Posted ${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `Posted ${months}mo ago`;
  return `Posted ${Math.floor(months / 12)}y ago`;
}

export function scrapedAgo(ts?: number): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Scraped just now";
  if (minutes < 60) return `Scraped ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Scraped ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Scraped yesterday";
  if (days < 30) return `Scraped ${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `Scraped ${months}mo ago`;
  return `Scraped ${Math.floor(months / 12)}y ago`;
}

/** Relative time from a millisecond timestamp (e.g. application updates). */
export function timeAgoTs(ts?: number): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/**
 * Stable identity for a job used to detect duplicates across scrapes.
 * Prefers the canonical URL; falls back to board + title + company.
 */
export function jobDedupeKey(job: {
  board?: string;
  title?: string;
  company?: string;
  url?: string;
}): string {
  const norm = (s?: string) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const url = (job.url ?? "").split("?")[0].replace(/\/+$/, "").toLowerCase();
  if (url) return `url:${url}`;
  return `job:${job.board ?? ""}:${norm(job.title)}:${norm(job.company)}`;
}

/**
 * Canonical identity for a job, shared across Job Matcher results, Saved Jobs,
 * Scraped Jobs, and Applications. Uses the stamped `key` when present and falls
 * back to the stable dedupe key so older records still resolve to the same job.
 */
export function jobKey(job: {
  key?: string;
  board?: string;
  title?: string;
  company?: string;
  url?: string;
}): string {
  return job.key ?? jobDedupeKey(job);
}

/** Build a prefilled mailto link for reaching a job poster with one click. */
export function mailtoHref(
  emails: string[],
  job: { title?: string; company?: string; url?: string },
  resume?: { fullName?: string; summary?: string } | null,
): string {
  const { to, subject, body } = emailParts(emails, job, resume);
  if (!to) return "";
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Standard subject line for an application email. */
export function buildEmailSubject(job: {
  title?: string;
  company?: string;
}): string {
  return `Application: ${job.title ?? "Role"} at ${job.company ?? "your company"}`;
}

/** Plain-text body of the application email (no To/Subject headers). */
export function buildEmailBody(
  job: { title?: string; company?: string; url?: string },
  resume?: { fullName?: string; summary?: string } | null,
  coverLetter?: string,
): string {
  return [
    resume?.fullName ? `Hi ${job.company ?? "there"} team,` : "Hi there,",
    "",
    coverLetter ??
      [
        `I'm writing to apply for the ${job.title ?? "role"} position${job.company ? ` at ${job.company}` : ""}.`,
        resume?.summary ? `\n${resume.summary}\n` : "",
        job.url ? `Posting: ${job.url}` : "",
        "",
        "My resume is attached — I look forward to hearing from you.",
      ].filter(Boolean).join("\n"),
    "",
    "Best regards,",
    resume?.fullName ?? "Candidate",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * A ready-to-paste email draft (To / Subject / body) for an application.
 * This is what gets stored on the Application and offered with a "Copy".
 */
export function buildEmailDraft(
  emails: string[],
  job: { title?: string; company?: string; url?: string },
  resume?: { fullName?: string; summary?: string } | null,
): string {
  const { to, subject, body } = emailParts(emails, job, resume);
  if (!to) return "";
  return `To: ${to}\nSubject: ${subject}\n\n${body}`;
}

function emailParts(
  emails: string[],
  job: { title?: string; company?: string; url?: string },
  resume?: { fullName?: string; summary?: string } | null,
) {
  const to = emails.filter(Boolean).join(",");
  const subject = `Application: ${job.title ?? "Role"} at ${job.company ?? "your company"}`;
  const body = [
    resume?.fullName ? `Hi ${job.company ?? "there"} team,` : "Hi there,",
    "",
    `I'm writing to apply for the ${job.title ?? "role"} position${job.company ? ` at ${job.company}` : ""}.`,
    resume?.summary ? `\n${resume.summary}\n` : "",
    job.url ? `Posting: ${job.url}` : "",
    "",
    "My resume is attached — I look forward to hearing from you.",
  ]
    .filter(Boolean)
    .join("\n");
  return { to, subject, body };
}

