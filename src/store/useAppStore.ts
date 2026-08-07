import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Application, CandidateProfile, JobPosting, JobSearchParams, ResumeData } from "../lib/types";
import { buildEmailDraft, extractEmails, jobKey } from "../lib/format";

/** An in-flight Apify scrape, persisted so a refresh/navigation can resume it. */
export interface ActiveScrape {
  runId: string;
  params: JobSearchParams;
  startedAt: number;
}

/**
 * localStorage with every access guarded. Corrupt JSON, quota errors, or
 * private-mode browsers can otherwise throw during persist rehydration and
 * blank out the whole app on load.
 */
const safeStorage = {
  getItem: (name: string) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      /* quota / private mode — ignore, state stays in memory */
    }
  },
  removeItem: (name: string) => {
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

export interface AppState {
  resume: ResumeData | null;
  candidateProfile: CandidateProfile | null;
  searchJobs: JobPosting[];
  savedJobs: JobPosting[];
  applications: Application[];
  scrapedJobs: JobPosting[];
  lastSearchParams: JobSearchParams | null;
  activeScrape: ActiveScrape | null;

  setResume: (r: ResumeData | null) => void;
  updateResume: (patch: Partial<ResumeData>) => void;
  setCandidateProfile: (p: CandidateProfile | null) => void;
  updateCandidateProfile: (patch: Partial<CandidateProfile>) => void;
  setSearchJobs: (jobs: JobPosting[]) => void;
  setScrapedJobs: (jobs: JobPosting[]) => void;
  setSavedJobs: (jobs: JobPosting[]) => void;
  saveJob: (job: JobPosting) => void;
  removeSavedJob: (jobId: string) => void;
  updateJobMatch: (jobId: string, match: NonNullable<JobPosting["match"]>) => void;
  addJobEmail: (job: JobPosting, email: string) => void;
  removeJobEmail: (job: JobPosting, email: string) => void;
  setJobEmails: (job: JobPosting, emails: string[]) => void;
  setApplications: (apps: Application[]) => void;
  ensureApplication: (job: JobPosting) => Application;
  updateApplication: (id: string, patch: Partial<Application>) => void;
  removeApplication: (id: string) => void;
  addScrapedJobs: (jobs: JobPosting[]) => { added: number; duplicates: number };
  backfillEmails: () => void;
  setLastSearchParams: (params: JobSearchParams) => void;
  setActiveScrape: (scrape: ActiveScrape | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      resume: null,
      candidateProfile: null,
      searchJobs: [],
      savedJobs: [],
      applications: [],
      scrapedJobs: [],
      lastSearchParams: null,
      activeScrape: null,

      setResume: (resume) => set({ resume }),
      updateResume: (patch) =>
        set((s) =>
          s.resume ? { resume: { ...s.resume, ...patch, updatedAt: Date.now() } } : s,
        ),

      setCandidateProfile: (candidateProfile) => set({ candidateProfile }),
      updateCandidateProfile: (patch) =>
        set((s) =>
          s.candidateProfile
            ? {
                candidateProfile: {
                  ...s.candidateProfile,
                  ...patch,
                  updatedAt: Date.now(),
                },
              }
            : s,
        ),

      setSearchJobs: (searchJobs) => set({ searchJobs }),

      setScrapedJobs: (scrapedJobs) => set({ scrapedJobs }),

      setSavedJobs: (savedJobs) => set({ savedJobs }),

      saveJob: (job) =>
        set((s) => {
          const key = jobKey(job);
          if (s.savedJobs.some((j) => jobKey(j) === key)) return s;
          return { savedJobs: [{ ...job, key, savedAt: Date.now() }, ...s.savedJobs] };
        }),

      removeSavedJob: (jobKeyOrId) =>
        set((s) => ({
          savedJobs: s.savedJobs.filter(
            (j) => jobKey(j) !== jobKeyOrId && j.id !== jobKeyOrId,
          ),
        })),

      updateJobMatch: (jobKeyOrId, match) =>
        set((s) => {
          const patch = (j: JobPosting) =>
            jobKey(j) === jobKeyOrId || j.id === jobKeyOrId
              ? { ...j, key: jobKey(j), match, matchScore: match.score }
              : j;
          return {
            searchJobs: s.searchJobs.map(patch),
            savedJobs: s.savedJobs.map(patch),
            scrapedJobs: s.scrapedJobs.map(patch),
          };
        }),

      // One application record per job — never create a duplicate for a job
      // that already has an application (any status), which also stops
      // accidental re-applies. Identity is the canonical job key, so an
      // application started from a Job Matcher result or a Scraped Jobs copy
      // of the same role resolves to the same record.
      ensureApplication: (job) => {
        const s = get();
        const key = jobKey(job);
        const existing = s.applications.find(
          (a) => jobKey(a.job) === key || a.job.id === job.id,
        );
        if (existing) {
          // Carry any newly-discovered contact emails onto the record so the
          // ready-to-send email stays available across every copy of the job.
          const emails = job.emails?.length ? job.emails : undefined;
          if (!existing.emails?.length && emails?.length) {
            set({
              applications: s.applications.map((a) =>
                a.id === existing.id
                  ? {
                      ...a,
                      job: { ...a.job, key },
                      emails,
                      emailDraft: rebuildDraft(existing, emails, s.resume),
                    }
                  : a,
              ),
            });
          }
          return existing;
        }
        const emails = job.emails?.length ? job.emails : undefined;
        const app: Application = {
          id: crypto.randomUUID(),
          job: {
            key,
            id: job.id,
            title: job.title,
            company: job.company,
            url: job.url,
            board: job.board,
          },
          status: "draft",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          ...(emails ? { emails } : {}),
          ...(emails ? { emailDraft: buildEmailDraft(emails, job, s.resume) } : {}),
        };
        set({ applications: [app, ...s.applications] });
        return app;
      },

      // Attach a contact email to a job. The email lands on every copy of the
      // job (search/saved/scraped) and its linked Application, keyed by the
      // canonical key so it propagates app-wide in real time.
      addJobEmail: (job, email) =>
        set((s) => {
          const emailNorm = email.trim();
          if (!emailNorm) return s;
          const key = jobKey(job);
          const current = currentEmails(s, key, job);
          if (current.includes(emailNorm)) return s;
          return applyEmails(s, key, [...current, emailNorm]);
        }),

      removeJobEmail: (job, email) =>
        set((s) => {
          const key = jobKey(job);
          const current = currentEmails(s, key, job);
          return applyEmails(s, key, current.filter((e) => e !== email));
        }),

      // Replace the whole contact list at once (used by the Apply page editor
      // where users can add several addresses from a single text field).
      setJobEmails: (job, emails) =>
        set((s) => {
          const key = jobKey(job);
          const clean = [...new Set(emails.map((e) => e.trim()).filter(Boolean))];
          return applyEmails(s, key, clean);
        }),

      setApplications: (applications) => set({ applications }),

      setLastSearchParams: (params) => set({ lastSearchParams: params }),

      setActiveScrape: (activeScrape) => set({ activeScrape }),

      updateApplication: (id, patch) =>
        set((s) => ({
          applications: s.applications.map((a) =>
            a.id === id ? { ...a, ...patch, updatedAt: Date.now() } : a,
          ),
        })),

      removeApplication: (id) =>
        set((s) => ({
          applications: s.applications.filter((a) => a.id !== id),
        })),

      addScrapedJobs: (jobs) => {
        const s = get();
        const seen = new Set(s.scrapedJobs.map((j) => jobKey(j)));
        // Index every existing copy of each job (search/saved/scraped) so a job
        // matched or saved in a previous hunt carries its data into the archive.
        const byKey = new Map<string, JobPosting>();
        for (const arr of [s.searchJobs, s.savedJobs, s.scrapedJobs]) {
          for (const j of arr) {
            const k = jobKey(j);
            if (!byKey.has(k)) byKey.set(k, j);
          }
        }
        const fresh: JobPosting[] = [];
        // Emails extracted by THIS scrape that an already-archived copy of the
        // job is still missing — propagated below so a re-scrape enriches it.
        const enrich = new Map<string, string[]>();
        let duplicates = 0;
        for (const job of jobs) {
          const key = jobKey(job);
          if (seen.has(key)) {
            duplicates += 1;
            const prior = byKey.get(key);
            if (job.emails?.length && !prior?.emails?.length) enrich.set(key, job.emails);
            continue;
          }
          seen.add(key);
          const prior = byKey.get(key);
          fresh.push({
            ...job,
            key,
            scrapedAt: Date.now(),
            ...(prior?.match && !job.match ? { match: prior.match, matchScore: prior.matchScore } : {}),
            ...(prior?.emails?.length && !job.emails?.length ? { emails: prior.emails } : {}),
          });
        }
        const patch: Partial<AppState> = {};
        if (fresh.length > 0) {
          patch.scrapedJobs = [...fresh, ...s.scrapedJobs];
        }
        if (enrich.size > 0) {
          const withEmails = (j: JobPosting): JobPosting => {
            const emails = enrich.get(jobKey(j));
            return emails ? { ...j, key: jobKey(j), emails } : j;
          };
          patch.scrapedJobs = (patch.scrapedJobs ?? s.scrapedJobs).map(withEmails);
          patch.searchJobs = s.searchJobs.map(withEmails);
          patch.savedJobs = s.savedJobs.map(withEmails);
          patch.applications = s.applications.map((a) =>
            a.emails?.length
              ? a
              : enrich.has(jobKey(a.job))
                ? { ...a, emails: enrich.get(jobKey(a.job))!, emailDraft: rebuildDraft(a, enrich.get(jobKey(a.job))!, s.resume) }
                : a,
          );
        }
        if (Object.keys(patch).length > 0) set(patch);
        return { added: fresh.length, duplicates };
      },

      // Scan every stored job for contact emails its description still hasn't
      // had captured, then attach them to every copy of the job (search/saved/
      // scraped) and any linked application. Runs on app load and after cloud
      // sync, so jobs scraped before email detection existed get auto-enriched.
      backfillEmails: () => {
        const s = get();
        const found = new Map<string, string[]>();
        for (const arr of [s.searchJobs, s.savedJobs, s.scrapedJobs]) {
          for (const job of arr) {
            if (job.emails?.length || !job.description) continue;
            const emails = extractEmails(job.description);
            if (emails?.length) found.set(jobKey(job), emails);
          }
        }
        if (found.size === 0) return;
        const withEmails = (j: JobPosting): JobPosting => {
          if (j.emails?.length) return j;
          const emails = found.get(jobKey(j));
          return emails ? { ...j, key: jobKey(j), emails } : j;
        };
        set({
          searchJobs: s.searchJobs.map(withEmails),
          savedJobs: s.savedJobs.map(withEmails),
          scrapedJobs: s.scrapedJobs.map(withEmails),
          applications: s.applications.map((a) =>
            a.emails?.length
              ? a
              : found.has(jobKey(a.job))
                ? { ...a, emails: found.get(jobKey(a.job))!, emailDraft: rebuildDraft(a, found.get(jobKey(a.job))!, s.resume) }
                : a,
          ),
        });
      },
    }),
    {
      name: "career-flow:app",
      version: 4,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({
        resume: s.resume,
        candidateProfile: s.candidateProfile,
        savedJobs: s.savedJobs,
        applications: s.applications,
        searchJobs: s.searchJobs,
        scrapedJobs: s.scrapedJobs,
        lastSearchParams: s.lastSearchParams,
        activeScrape: s.activeScrape,
      }),
      migrate: (persisted, _version) => {
        const s = (persisted ?? {}) as Partial<AppState>;
        const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
        const obj = (v: unknown) =>
          v && typeof v === "object" && !Array.isArray(v) ? v : null;
        const scrape = obj(s.activeScrape) as ActiveScrape | null;
        const activeScrape =
          scrape &&
          typeof scrape.runId === "string" &&
          typeof scrape.startedAt === "number" &&
          scrape.params &&
          typeof scrape.params === "object"
            ? scrape
            : null;
        return {
          resume: obj(s.resume) as ResumeData | null,
          candidateProfile: obj(s.candidateProfile) as CandidateProfile | null,
          savedJobs: arr<JobPosting>(s.savedJobs),
          applications: arr<Application>(s.applications),
          searchJobs: arr<JobPosting>(s.searchJobs),
          scrapedJobs: arr<JobPosting>(s.scrapedJobs),
          lastSearchParams: obj(s.lastSearchParams) as JobSearchParams | null,
          activeScrape,
        };
      },
    },
  ),
);

/** Current email list for a job across any of its copies, falling back to the passed-in job. */
function currentEmails(s: AppState, key: string, job: JobPosting): string[] {
  for (const arr of [s.searchJobs, s.savedJobs, s.scrapedJobs]) {
    const found = arr.find((j) => jobKey(j) === key);
    if (found?.emails?.length) return [...found.emails];
  }
  return job.emails?.length ? [...job.emails] : [];
}

/**
 * Rebuild the ready-to-send email draft for an application. Preserves any
 * AI-written or user-edited subject/body so recipient changes never discard
 * the message; falls back to the generic draft when none exists yet.
 */
function rebuildDraft(
  app: Application,
  emails: string[],
  resume: ResumeData | null,
): string | undefined {
  if (!emails.length) return undefined;
  if (app.emailSubject || app.emailBody) {
    return `To: ${emails.join(",")}\nSubject: ${app.emailSubject ?? ""}\n\n${app.emailBody ?? ""}`;
  }
  return buildEmailDraft(emails, app.job, resume);
}

/**
 * Apply a new contact email list to every copy of a job (search/saved/scraped)
 * and its linked Application. Rebuilds the ready-to-send email draft so the
 * draft always matches the current recipients.
 */
function applyEmails(s: AppState, key: string, emails: string[]): Partial<AppState> {
  const withEmail = (j: JobPosting): JobPosting =>
    jobKey(j) === key ? { ...j, key, emails } : j;
  const applications = s.applications.map((a) =>
    jobKey(a.job) === key
      ? {
          ...a,
          emails,
          emailDraft: rebuildDraft(a, emails, s.resume),
        }
      : a,
  );
  return {
    searchJobs: s.searchJobs.map(withEmail),
    savedJobs: s.savedJobs.map(withEmail),
    scrapedJobs: s.scrapedJobs.map(withEmail),
    applications,
  };
}


