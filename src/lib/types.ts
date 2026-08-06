export type AnalysisStatus = "idle" | "parsing" | "analyzing" | "ready" | "error";

export interface ResumeData {
  id: string;
  fileName: string;
  rawText: string;
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  website?: string;
  headline?: string;
  summary?: string;
  skills: string[];
  experience: WorkExperience[];
  education: Education[];
  projects?: Project[];
  certifications?: string[];
  languages?: string[];
  updatedAt: number;
}

export interface WorkExperience {
  title: string;
  company: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  bullets: string[];
  technologies?: string[];
}

export interface Education {
  degree: string;
  institution: string;
  startDate?: string;
  endDate?: string;
  details?: string[];
}

export interface Project {
  name: string;
  description: string;
  technologies?: string[];
  link?: string;
}

export interface JobPosting {
  id: string;
  board: "linkedin" | "indeed" | "workable";
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  salary?: string;
  postedAt?: string;
  employmentType?: string;
  remote?: boolean;
  snippet?: string;
  matchScore?: number;
  match?: JobMatch;
  applied?: boolean;
  savedAt?: number;
}

export interface JobMatch {
  score: number;
  strengths: string[];
  gaps: string[];
  suggestedKeywords: string[];
  reasoning: string;
}

export interface Application {
  id: string;
  job: Pick<JobPosting, "id" | "title" | "company" | "url" | "board">;
  status: "draft" | "applied" | "interview" | "offer" | "rejected" | "closed";
  appliedAt?: number;
  createdAt: number;
  coverLetter?: string;
  tailoredHighlights?: string;
  notes?: string;
}

export interface ApiKeys {
  groqApiKey: string;
  apifyApiToken: string;
}

export interface JobSearchParams {
  query: string;
  location: string;
  board: "linkedin" | "indeed" | "workable";
  maxResults: number;
  remoteOnly: boolean;
}

export type Route =
  | "dashboard"
  | "resume"
  | "jobs"
  | "apply"
  | "applications"
  | "settings";
