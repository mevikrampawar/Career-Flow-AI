import type { JobPosting, JobSearchParams } from "./types";
import { jobDedupeKey } from "./format";

const APIFY_API = "https://api.apify.com/v2";
const MAX_POLLS = 60;
const POLL_INTERVAL_MS = 5000;

export interface ApifyActorConfig {
  linkedin: string;
  indeed: string;
  workable: string;
}

export const DEFAULT_ACTORS: ApifyActorConfig = {
  linkedin: "curious_coder~linkedin-jobs-scraper",
  indeed: "misceres~indeed-scraper",
  workable: "schnellscrapers~workable-jobs-scraper",
};

export class ApifyError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "ApifyError";
  }
}

async function apifyFetch(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${APIFY_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body?.error?.message ?? body?.error?.type ?? detail;
    } catch {
      /* ignore */
    }
    if (res.status === 401) {
      throw new ApifyError("Invalid Apify API token. Check it in Settings.", 401);
    }
    throw new ApifyError(`Apify request failed (${res.status}): ${detail}`, res.status);
  }
  return res.json();
}

export async function testApifyConnection(token: string): Promise<string> {
  const data = await apifyFetch(token, "/users/me");
  return data?.username ?? "Apify";
}

// ---- Actor run + dataset helpers ----

export async function runActor(
  token: string,
  actorId: string,
  input: Record<string, unknown>,
): Promise<string> {
  const data = await apifyFetch(
    token,
    `/actors/${actorId}/runs?timeout=600`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
  return data?.data?.id as string;
}

async function getRun(token: string, runId: string) {
  return apifyFetch(token, `/actor-runs/${runId}`);
}

export async function waitForRun(
  token: string,
  runId: string,
  onProgress?: (status: string) => void,
): Promise<string> {
  for (let i = 0; i < MAX_POLLS; i++) {
    const run = await getRun(token, runId);
    const status = run?.data?.status as string;
    onProgress?.(status);
    if (status === "SUCCEEDED") return run?.data?.defaultDatasetId as string;
    if (status === "FAILED" || status === "ABORTED" || status === "TIMED_OUT") {
      const detail = run?.data?.statusMessage || run?.data?.exitInfo;
      throw new ApifyError(
        detail ? `Actor run ${status}: ${detail}` : `Actor run did not succeed (status: ${status}).`,
      );
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new ApifyError("Actor run timed out while waiting for results.");
}

async function getDatasetItems(
  token: string,
  datasetId: string,
): Promise<Record<string, unknown>[]> {
  const data = await apifyFetch(
    token,
    `/datasets/${datasetId}/items?clean=true&limit=50&format=json`,
  );
  return Array.isArray(data) ? data : [];
}

// ---- Board-specific input builders ----

function linkedInInput(params: JobSearchParams): Record<string, unknown> {
  const keywords = encodeURIComponent(params.query);
  const location = encodeURIComponent(params.location || "");
  const remote = params.remoteOnly ? "&f_WT=2" : "";
  return {
    urls: [
      `https://www.linkedin.com/jobs/search/?keywords=${keywords}&location=${location}${remote}`,
    ],
    scrapeCompany: false,
    count: Math.max(params.maxResults, 10),
  };
}

function indeedInput(params: JobSearchParams): Record<string, unknown> {
  return {
    position: params.query,
    location: params.location || "",
    country: "US",
    maxItemsPerSearch: params.maxResults,
    parseCompanyDetails: false,
  };
}

function workableInput(params: JobSearchParams): Record<string, unknown> {
  return {
    query: params.query,
    location: params.location || undefined,
    maxItems: params.maxResults,
    remoteOnly: params.remoteOnly ? true : undefined,
    parseDescription: true,
  };
}

// ---- Result normalization (tolerant of differing actor schemas) ----

function firstString(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "object" && v !== null) {
      const obj = v as Record<string, unknown>;
      for (const k of ["text", "value", "name", "title", "fullLocation"]) {
        if (typeof obj[k] === "string" && obj[k].trim()) return obj[k].trim();
      }
    }
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

function normalizeJob(
  raw: Record<string, unknown>,
  board: JobPosting["board"],
  fallbackQuery: string,
): JobPosting | null {
  const title = firstString(raw.title, raw.jobTitle, raw.positionName, raw.position, fallbackQuery);
  const company = firstString(raw.company, raw.companyName, raw.organizationName, raw.brand);
  if (!title || !company) return null;

  const description = firstString(
    raw.description,
    raw.descriptionHtml,
    raw.descriptionHTML,
    raw.jobDescription,
    raw.snippet,
    raw.body,
  ) ?? "";

  const emails = extractEmails(
    description,
    raw.contactEmail,
    raw.recruiterEmail,
    raw.email,
    raw.emails,
    raw.applyEmail,
  );

  let url = firstString(
    raw.url,
    raw.applyUrl,
    raw.positionUrl,
    raw.externalApplyLink,
    raw.link,
    raw.jobUrl,
    raw.href,
  );
  if (url && !url.startsWith("http")) {
    if (board === "linkedin") url = `https://www.linkedin.com${url}`;
    else if (board === "indeed") url = `https://www.indeed.com${url}`;
  }

  return {
    id: String(raw.id ?? raw.positionId ?? raw.jobId ?? `${board}-${title}-${company}`),
    key: jobDedupeKey({ board, title, company, url }),
    board,
    title,
    company,
    location: firstString(raw.location, raw.jobLocation, raw.place) ?? "",
    description,
    url: url ?? "",
    salary: firstString(raw.salary, raw.salaryText, raw.compensation) ?? undefined,
    postedAt: firstString(raw.postedAt, raw.publishedAt, raw.date, raw.postingDate) ?? undefined,
    employmentType: firstString(raw.employmentType, raw.jobType, raw.type) ?? undefined,
    department: firstString(raw.department, raw.departmentName) ?? undefined,
    experienceLevel: firstString(raw.experienceLevel, raw.seniorityLevel, raw.experience) ??
      undefined,
    jobFunction: firstString(raw.jobFunction, raw.function) ?? undefined,
    remote:
      Boolean(raw.remote) ||
      Boolean(raw.isRemote) ||
      (typeof raw.workplace === "string" && /remote/i.test(raw.workplace)) ||
      (typeof raw.location === "string" && /remote/i.test(raw.location)) ||
      undefined,
    emails,
  };
}

// Matches email-like strings and filters out obvious placeholder / junk values.
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const BAD_EMAIL = /example|sample|yourname|youremail|test|@2x|sentry|@png|@jpg|@webp|@svg|email\.com/i;

function extractEmails(...texts: unknown[]): string[] | undefined {
  const combined = texts
    .map((t) => {
      if (Array.isArray(t)) return t.filter((x) => typeof x === "string").join(" ");
      return firstString(t) ?? "";
    })
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

export async function searchJobs(
  token: string,
  params: JobSearchParams,
  actors: ApifyActorConfig,
  onProgress?: (message: string) => void,
): Promise<JobPosting[]> {
  const actorId = actors[params.board];
  const input = (() => {
    switch (params.board) {
      case "linkedin":
        return linkedInInput(params);
      case "indeed":
        return indeedInput(params);
      case "workable":
        return workableInput(params);
    }
  })();

  onProgress?.("Starting scrape on Apify...");
  const runId = await runActor(token, actorId, input);
  onProgress?.("Scrape started. Fetching results...");

  const datasetId = await waitForRun(token, runId, (status) => {
    if (status !== "RUNNING") onProgress?.(`Scrape status: ${status}.`);
  });

  const items = await getDatasetItems(token, datasetId);
  const jobs: JobPosting[] = [];
  for (const item of items) {
    // Some actors return an array of listings under a "results"/"items" key.
    if (Array.isArray(item.results)) {
      for (const sub of item.results as Record<string, unknown>[]) {
        const j = normalizeJob(sub, params.board, params.query);
        if (j) jobs.push(j);
      }
    } else {
      const j = normalizeJob(item, params.board, params.query);
      if (j) jobs.push(j);
    }
  }

  // De-duplicate by url/title+company
  const seen = new Set<string>();
  const unique = jobs.filter((j) => {
    const key = j.url || `${j.title}|${j.company}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.slice(0, params.maxResults);
}
