export type AnalysisStatus = "idle" | "parsing" | "analyzing" | "ready" | "error";

export interface ResumeData {
  id: string;
  fileName: string;
  rawText: string;
  /** Original PDF as a base64 data URL, kept so applications can attach it. */
  pdfDataUrl?: string;
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
  /**
   * Canonical identity shared across Job Matcher results, Saved Jobs, Scraped
   * Jobs, and Applications. Stable across scrapes (URL-based) so enrichment
   * like AI match, emails, and saved state travels with the job everywhere.
   */
  key?: string;
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
  department?: string;
  experienceLevel?: string;
  jobFunction?: string;
  snippet?: string;
  emails?: string[];
  matchScore?: number;
  match?: JobMatch;
  applied?: boolean;
  savedAt?: number;
  scrapedAt?: number;
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
  job: Pick<JobPosting, "key" | "id" | "title" | "company" | "url" | "board">;
  status: "draft" | "applied" | "interview" | "offer" | "rejected" | "closed";
  appliedAt?: number;
  createdAt: number;
  updatedAt?: number;
  emails?: string[];
  emailDraft?: string;
  emailSubject?: string;
  emailBody?: string;
  tailoredSummary?: string;
  coverLetter?: string;
  tailoredHighlights?: string;
  notes?: string;
  threadId?: string;
  sentMessageId?: string;
  sentAt?: number;
  /** Set when the fetched thread shows an inbound reply newer than sentAt. */
  lastReplyAt?: number;
}

export interface ApiKeys {
  groqApiKey: string;
  apifyApiToken: string;
  gmailClientId: string;
}

export interface ScreeningAnswer {
  question: string;
  answer: string;
}

/**
 * Global applicant details used by the auto-apply flow to prefill forms and
 * screening questions. Synced to Firestore like the rest of the user data.
 */
export interface CandidateProfile {
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  portfolio?: string;
  workAuthorization?: string;
  salaryExpectation?: string;
  noticePeriod?: string;
  yearsExperience?: string;
  screeningAnswers: ScreeningAnswer[];
  updatedAt: number;
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
  | "saved"
  | "apply"
  | "applications"
  | "settings";
