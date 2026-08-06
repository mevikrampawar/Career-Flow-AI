import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Application, JobPosting, ResumeData } from "../lib/types";

interface AppState {
  resume: ResumeData | null;
  searchJobs: JobPosting[];
  savedJobs: JobPosting[];
  applications: Application[];

  setResume: (r: ResumeData | null) => void;
  updateResume: (patch: Partial<ResumeData>) => void;
  setSearchJobs: (jobs: JobPosting[]) => void;
  saveJob: (job: JobPosting) => void;
  removeSavedJob: (jobId: string) => void;
  updateJobMatch: (jobId: string, match: NonNullable<JobPosting["match"]>) => void;
  addApplication: (app: Application) => void;
  updateApplication: (id: string, patch: Partial<Application>) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      resume: null,
      searchJobs: [],
      savedJobs: [],
      applications: [],

      setResume: (resume) => set({ resume }),
      updateResume: (patch) =>
        set((s) =>
          s.resume ? { resume: { ...s.resume, ...patch, updatedAt: Date.now() } } : s,
        ),

      setSearchJobs: (searchJobs) => set({ searchJobs }),

      saveJob: (job) =>
        set((s) => {
          if (s.savedJobs.some((j) => j.id === job.id)) return s;
          return { savedJobs: [{ ...job, savedAt: Date.now() }, ...s.savedJobs] };
        }),

      removeSavedJob: (jobId) =>
        set((s) => ({
          savedJobs: s.savedJobs.filter((j) => j.id !== jobId),
        })),

      updateJobMatch: (jobId, match) =>
        set((s) => ({
          searchJobs: s.searchJobs.map((j) =>
            j.id === jobId ? { ...j, match, matchScore: match.score } : j,
          ),
          savedJobs: s.savedJobs.map((j) =>
            j.id === jobId ? { ...j, match, matchScore: match.score } : j,
          ),
        })),

      addApplication: (app) =>
        set((s) => ({ applications: [app, ...s.applications] })),

      updateApplication: (id, patch) =>
        set((s) => ({
          applications: s.applications.map((a) =>
            a.id === id ? { ...a, ...patch } : a,
          ),
        })),
    }),
    {
      name: "career-flow:app",
      version: 1,
      partialize: (s) => ({
        resume: s.resume,
        savedJobs: s.savedJobs,
        applications: s.applications,
      }),
    },
  ),
);


