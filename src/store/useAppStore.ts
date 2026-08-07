import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Application, CandidateProfile, JobPosting, ResumeData } from "../lib/types";
import { buildEmailDraft, jobKey } from "../lib/format";

export interface AppState {
  resume: ResumeData | null;
  candidateProfile: CandidateProfile | null;
  searchJobs: JobPosting[];
  savedJobs: JobPosting[];
  applications: Application[];
  scrapedJobs: JobPosting[];

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
  setApplications: (apps: Application[]) => void;
  ensureApplication: (job: JobPosting) => Application;
  updateApplication: (id: string, patch: Partial<Application>) => void;
  removeApplication: (id: string) => void;
  addScrapedJobs: (jobs: JobPosting[]) => { added: number; duplicates: number };
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
                      emailDraft: buildEmailDraft(emails, job, s.resume),
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
          const withEmail = (j: JobPosting): JobPosting => {
            if (jobKey(j) !== key) return j;
            if (j.emails?.includes(emailNorm)) return j;
            return { ...j, key, emails: [...(j.emails ?? []), emailNorm] };
          };
          const applications = s.applications.map((a) => {
            if (jobKey(a.job) !== key) return a;
            if (a.emails?.includes(emailNorm)) return a;
            return { ...a, emails: [...(a.emails ?? []), emailNorm] };
          });
          return {
            searchJobs: s.searchJobs.map(withEmail),
            savedJobs: s.savedJobs.map(withEmail),
            scrapedJobs: s.scrapedJobs.map(withEmail),
            applications,
          };
        }),

      setApplications: (applications) => set({ applications }),

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
        let duplicates = 0;
        for (const job of jobs) {
          const key = jobKey(job);
          if (seen.has(key)) {
            duplicates += 1;
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
        if (fresh.length > 0) {
          set({ scrapedJobs: [...fresh, ...s.scrapedJobs] });
        }
        return { added: fresh.length, duplicates };
      },
    }),
    {
      name: "career-flow:app",
      version: 3,
      partialize: (s) => ({
        resume: s.resume,
        candidateProfile: s.candidateProfile,
        savedJobs: s.savedJobs,
        applications: s.applications,
        searchJobs: s.searchJobs,
        scrapedJobs: s.scrapedJobs,
      }),
      migrate: (persisted, version) => {
        const s = (persisted ?? {}) as Partial<AppState>;
        if (version < 3) {
          return {
            resume: s.resume ?? null,
            candidateProfile: s.candidateProfile ?? null,
            savedJobs: s.savedJobs ?? [],
            applications: s.applications ?? [],
            searchJobs: s.searchJobs ?? [],
            scrapedJobs: s.scrapedJobs ?? [],
          };
        }
        return s as AppState;
      },
    },
  ),
);


