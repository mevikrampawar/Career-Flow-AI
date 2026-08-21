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

/** Query params that carry campaign/referrer noise, never job identity. */
const TRACKING_PARAM_RE = /^(utm_[^=]*|fbclid|gclid|mc_cid|mc_eid|ref|source|from)$/i;

type DedupeJob = {
  board?: string;
  title?: string;
  company?: string;
  url?: string;
};

/**
 * Canonical form of a posting URL for identity purposes: lowercased
 * host+path, trailing slashes dropped, tracking params removed, and the
 * remaining params (including identity params like Indeed's `jk`) sorted
 * alphabetically so URL variants of one posting collapse to a single key.
 */
function canonicalUrl(rawUrl: string): string {
  if (!rawUrl) return "";
  try {
    const u = new URL(rawUrl);
    // searchParams yields decoded values; re-encode so the rebuilt query
    // stays unambiguous (values containing & or = can't forge separators).
    const params = [...u.searchParams.entries()]
      .filter(([name]) => !TRACKING_PARAM_RE.test(name))
      .sort((a, b) =>
        a[0] === b[0] ? (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) : a[0] < b[0] ? -1 : 1,
      )
      .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
    const path = `${u.host}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
    return params.length ? `${u.protocol}//${path}?${params.join("&")}` : `${u.protocol}//${path}`;
  } catch {
    // Unparseable URL: degrade to the legacy whole-string treatment.
    return rawUrl.split("?")[0].replace(/\/+$/, "").toLowerCase();
  }
}

/**
 * Stable identity for a job used to detect duplicates across scrapes.
 * Prefers the canonical URL (tracking params stripped, identity params such as
 * Indeed's `jk` preserved); falls back to board + title + company when there
 * is no usable URL.
 */
export function jobDedupeKey(job: DedupeJob): string {
  const norm = (s?: string) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const url = canonicalUrl((job.url ?? "").trim());
  if (url) return `url:${url}`;
  return `job:${job.board ?? ""}:${norm(job.title)}:${norm(job.company)}`;
}

/** Key shape stamped before TASK-007: the ENTIRE query string was stripped, so every Indeed posting collided on `...viewjob`. */
function legacyDedupeKey(job: DedupeJob): string {
  const norm = (s?: string) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const url = (job.url ?? "").split("?")[0].replace(/\/+$/, "").toLowerCase();
  if (url) return `url:${url}`;
  return `job:${job.board ?? ""}:${norm(job.title)}:${norm(job.company)}`;
}

/**
 * Canonical identity for a job, shared across Job Matcher results, Saved Jobs,
 * Scraped Jobs, and Applications.
 *
 * Backward-compatibility strategy: rows scraped before TASK-007 carry
 * query-stripped keys (all Indeed rows collided on `...viewjob`). We never
 * rewrite those stored keys here; instead the COMPARISON converges
 * representations — a stamp we can reproduce from the record itself via the
 * legacy scheme carries no information beyond the record's own fields, so the
 * freshly computed canonical key wins and old rows dedupe against new ones.
 * Stamps we cannot derive locally are trusted verbatim.
 */
export function jobKey(job: {
  key?: string;
  board?: string;
  title?: string;
  company?: string;
  url?: string;
}): string {
  if (!job.key) return jobDedupeKey(job);
  return job.key === legacyDedupeKey(job) ? jobDedupeKey(job) : job.key;
}

/**
 * Parse a free-form list of email addresses, splitting on whitespace, commas,
 * and semicolons so users can paste "a@b.com, c@d.com" or newline-separated
 * addresses in a single field. Returns deduplicated, trimmed addresses.
 */
export function parseEmailList(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(/[\s,;]+/)) {
    const email = raw.trim().replace(/\.$/, "");
    if (!email) continue;
    const norm = email.toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(email);
  }
  return out;
}

// Matches email-like strings and filters out obvious placeholder / junk values.
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const BAD_EMAIL = /example|sample|yourname|youremail|test|@2x|sentry|@png|@jpg|@webp|@svg|email\.com/i;

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.filter((x) => typeof x === "string").join(" ");
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const k of ["text", "value", "name", "title", "fullLocation"]) {
      if (typeof obj[k] === "string" && obj[k].trim()) return obj[k].trim();
    }
  }
  return "";
}

/**
 * Find contact email addresses inside free text (job descriptions, explicit
 * actor fields, etc.), dropping placeholders and junk. Returns up to 5 unique
 * addresses, or undefined when none are found.
 */
export function extractEmails(...texts: unknown[]): string[] | undefined {
  const combined = texts
    .map(textOf)
    .join(" ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;|&lt;|&gt;|&quot;|&#39;/g, " ");
  const found = combined.match(EMAIL_RE);
  if (!found) return undefined;
  const set = new Set<string>();
  for (const m of found) {
    const email = m.toLowerCase();
    if (BAD_EMAIL.test(email)) continue;
    if (email.length > 60) continue;
    set.add(email);
  }
  return set.size ? [...set].slice(0, 5) : undefined;
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

