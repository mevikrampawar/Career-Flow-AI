import type { JobPosting, JobSearchParams } from "./types";

const APIFY_API = "https://api.apify.com/v2";
const MAX_POLLS = 60;
const POLL_INTERVAL_MS = 5000;

export interface ApifyActorConfig {
  linkedin: string;
  indeed: string;
  workable: string;
}

export const DEFAULT_ACTORS: ApifyActorConfig = {
  linkedin: "dscraping/linkedin-jobs-scraper",
  indeed: "mis1apep/indeed-jobs-scraper",
  workable: "dscraping/workable-scraper",
};

export class ApifyError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "ApifyError";
  }
}

async function apifyFetch(token: string, path: string, init?: RequestInit) {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(
    `${APIFY_API}${path}${sep}token=${encodeURIComponent(token)}`,
    {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    },
  );
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
    `/acts/${actorId}/runs?timeout=300&memory=2048`,
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
      const err = run?.data?.defaultKeyValueStoreId
        ? "Actor run did not succeed."
        : "Actor run did not succeed.";
      throw new ApifyError(`${err} (status: ${status})`);
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
  return {
    queries: [
      {
        query: params.query,
        location: params.location || "United States",
        country: "US",
      },
    ],
    resultsPerPage: Math.min(params.maxResults, 50),
    maxItems: params.maxResults,
    maxConcurrency: 5,
    scrapeCompanyUrl: true,
    scrapeFullDescription: true,
    onlyAtRemote: params.remoteOnly ? true : undefined,
  };
}

function indeedInput(params: JobSearchParams): Record<string, unknown> {
  return {
    position: params.query,
    location: params.location || "",
    country: "USA",
    maxItems: params.maxResults,
    parseCompanyDetails: false,
    ...(params.remoteOnly ? { remoteOnly: true } : {}),
  };
}

function workableInput(params: JobSearchParams): Record<string, unknown> {
  return {
    searchTerms: params.query,
    location: params.location || undefined,
    maxItems: params.maxResults,
    maxConcurrency: 3,
    parseCompanyDetails: true,
  };
}

// ---- Result normalization (tolerant of differing actor schemas) ----

function firstString(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "object" && v !== null) {
      const obj = v as Record<string, unknown>;
      for (const k of ["text", "value", "name", "title"]) {
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
    raw.jobDescription,
    raw.snippet,
    raw.body,
  ) ?? "";

  let url = firstString(raw.url, raw.externalApplyLink, raw.link, raw.applyLink, raw.jobUrl, raw.href);
  if (url && !url.startsWith("http")) {
    if (board === "linkedin") url = `https://www.linkedin.com${url}`;
    else if (board === "indeed") url = `https://www.indeed.com${url}`;
  }

  return {
    id: String(raw.id ?? raw.positionId ?? raw.jobId ?? `${board}-${title}-${company}`),
    board,
    title,
    company,
    location: firstString(raw.location, raw.jobLocation, raw.place) ?? "",
    description,
    url: url ?? "",
    salary: firstString(raw.salary, raw.salaryText, raw.compensation) ?? undefined,
    postedAt: firstString(raw.postedAt, raw.date, raw.postingDate) ?? undefined,
    employmentType: firstString(raw.employmentType, raw.jobType, raw.type) ?? undefined,
    remote:
      Boolean(raw.remote) ||
      (typeof raw.location === "string" && /remote/i.test(raw.location)) ||
      undefined,
  };
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
