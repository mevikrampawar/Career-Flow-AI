import type { JobPosting, ResumeData } from "./types";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GroqChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
}

export const GROQ_MODELS = {
  analysis: "llama-3.3-70b-versatile",
  fast: "llama-3.1-8b-instant",
} as const;

export class GroqError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "GroqError";
  }
}

export async function chat(
  apiKey: string,
  messages: GroqMessage[],
  opts: GroqChatOptions = {},
): Promise<string> {
  const res = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model ?? GROQ_MODELS.analysis,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 4096,
      messages,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body?.error?.message ?? body?.message ?? detail;
    } catch {
      /* ignore */
    }
    if (res.status === 401) {
      throw new GroqError("Invalid Groq API key. Check your key in Settings.", 401);
    }
    if (res.status === 429) {
      throw new GroqError("Groq rate limit hit. Wait a moment and retry.", 429);
    }
    throw new GroqError(`Groq request failed (${res.status}): ${detail}`, res.status);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

export async function chatJson<T>(
  apiKey: string,
  messages: GroqMessage[],
  opts: GroqChatOptions = {},
): Promise<T> {
  const text = await chat(apiKey, messages, { ...opts, json: true });
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new GroqError("Model did not return valid JSON.");
  }
  return JSON.parse(text.slice(start, end + 1)) as T;
}

export async function testGroqConnection(apiKey: string): Promise<string> {
  const out = await chat(
    apiKey,
    [
      {
        role: "system",
        content: "Reply with exactly: OK",
      },
      { role: "user", content: "ping" },
    ],
    { model: GROQ_MODELS.fast, maxTokens: 8, temperature: 0 },
  );
  return out.trim();
}

// ---- High-level AI tasks ----

const RESUME_SCHEMA_PROMPT = `You are an expert resume parser and career analyst.
Analyze the resume text and return a JSON object with EXACTLY this shape:
{
  "fullName": string | null,
  "email": string | null,
  "phone": string | null,
  "location": string | null,
  "linkedin": string | null,
  "headline": string | null,
  "summary": string,
  "skills": string[],
  "experience": [{ "title": string, "company": string, "location": string | null, "startDate": string | null, "endDate": string | null, "current": boolean, "bullets": string[], "technologies": string[] }],
  "education": [{ "degree": string, "institution": string, "startDate": string | null, "endDate": string | null }],
  "projects": [{ "name": string, "description": string, "technologies": string[], "link": string | null }],
  "certifications": string[],
  "languages": string[]
}
Rules:
- Extract only facts present in the resume. Do not invent.
- Normalize skill names (e.g. "javascript" -> "JavaScript", "react js" -> "React", "nodejs" -> "Node.js").
- Keep experience bullets as written, lightly cleaned.
- summary: a 2-3 sentence professional summary based on the resume.
Return JSON only, no markdown.`;

export async function analyzeResume(
  apiKey: string,
  rawText: string,
): Promise<Omit<ResumeData, "id" | "fileName" | "rawText" | "updatedAt">> {
  const data = await chatJson<Omit<ResumeData, "id" | "fileName" | "rawText" | "updatedAt">>(
    apiKey,
    [
      { role: "system", content: RESUME_SCHEMA_PROMPT },
      { role: "user", content: rawText.slice(0, 30000) },
    ],
    { model: GROQ_MODELS.analysis, temperature: 0.1, maxTokens: 4096 },
  );
  return {
    ...data,
    skills: data.skills ?? [],
    experience: data.experience ?? [],
    education: data.education ?? [],
    projects: data.projects ?? [],
    certifications: data.certifications ?? [],
    languages: data.languages ?? [],
  };
}

const MATCH_PROMPT = `You are a senior technical recruiter. Compare the candidate's resume to the job description and score the match.

Return a JSON object with EXACTLY this shape:
{
  "score": number (0-100 integer),
  "strengths": string[] (top 3-5 resume points that match the job),
  "gaps": string[] (top 2-4 requirements the candidate is missing or weak on),
  "suggestedKeywords": string[] (keywords from the job to weave into the resume to improve ATS match),
  "reasoning": string (2-3 sentence summary of the fit)
}
Be strict but fair. Score relative to the job requirements. Return JSON only, no markdown.`;

export interface MatchResult {
  score: number;
  strengths: string[];
  gaps: string[];
  suggestedKeywords: string[];
  reasoning: string;
}

export async function scoreJobMatch(
  apiKey: string,
  resume: ResumeData,
  job: JobPosting,
): Promise<MatchResult> {
  const resumeBlob = JSON.stringify(
    {
      summary: resume.summary,
      skills: resume.skills,
      experience: resume.experience,
      education: resume.education,
      projects: resume.projects,
    },
    null,
    1,
  ).slice(0, 24000);
  const jobBlob = [
    job.title,
    job.company,
    job.location,
    job.salary,
    job.employmentType,
    job.description,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 12000);

  return chatJson<MatchResult>(
    apiKey,
    [
      { role: "system", content: MATCH_PROMPT },
      {
        role: "user",
        content: `RESUME:\n${resumeBlob}\n\nJOB DESCRIPTION:\n${jobBlob}`,
      },
    ],
    { model: GROQ_MODELS.analysis, temperature: 0.1, maxTokens: 1024 },
  );
}

const COVER_LETTER_PROMPT = `You are a professional cover letter writer. Write a compelling, concise cover letter (250-350 words) for the candidate applying to the given job.

Guidelines:
- Use the candidate's real experience and skills; never fabricate facts.
- Address the specific company and role.
- Structure: greeting, hook, 2-3 body paragraphs tying experience to the role's requirements, closing + signature with the candidate's name and contact.
- Plain text paragraphs separated by blank lines. No markdown, no bullet lists, no subject line.`;

export async function generateCoverLetter(
  apiKey: string,
  resume: ResumeData,
  job: JobPosting,
): Promise<string> {
  const resumeBlob = JSON.stringify(
    {
      name: resume.fullName,
      summary: resume.summary,
      skills: resume.skills,
      experience: resume.experience,
      education: resume.education,
      projects: resume.projects,
      email: resume.email,
      phone: resume.phone,
      location: resume.location,
      linkedin: resume.linkedin,
    },
    null,
    1,
  ).slice(0, 24000);
  const jobBlob = [job.title, job.company, job.location, job.salary, job.employmentType, job.description]
    .filter(Boolean)
    .join("\n")
    .slice(0, 12000);

  return chat(
    apiKey,
    [
      { role: "system", content: COVER_LETTER_PROMPT },
      {
        role: "user",
        content: `CANDIDATE RESUME:\n${resumeBlob}\n\nJOB:\n${jobBlob}`,
      },
    ],
    { model: GROQ_MODELS.analysis, temperature: 0.6, maxTokens: 1200 },
  );
}

const TAILOR_PROMPT = `You are a resume-tailoring expert. Given the candidate's resume and a job description, produce a tailored version of the candidate's professional summary and their most relevant experience bullets for THIS specific job.

Return a JSON object with EXACTLY this shape:
{
  "tailoredSummary": string (2-3 sentence summary, rewritten to emphasize the skills this job asks for, using keywords from the job without lying),
  "tailoredHighlights": string[] (4-6 achievement bullets drawn from the candidate's real experience, rewritten to emphasize relevance to this job)
}
Return JSON only, no markdown.`;

export interface TailorResult {
  tailoredSummary: string;
  tailoredHighlights: string[];
}

export async function tailorResume(
  apiKey: string,
  resume: ResumeData,
  job: JobPosting,
): Promise<TailorResult> {
  const resumeBlob = JSON.stringify(
    { summary: resume.summary, skills: resume.skills, experience: resume.experience },
    null,
    1,
  ).slice(0, 24000);
  const jobBlob = [job.title, job.company, job.salary, job.employmentType, job.description]
    .filter(Boolean)
    .join("\n")
    .slice(0, 12000);

  return chatJson<TailorResult>(
    apiKey,
    [
      { role: "system", content: TAILOR_PROMPT },
      {
        role: "user",
        content: `CANDIDATE RESUME:\n${resumeBlob}\n\nJOB:\n${jobBlob}`,
      },
    ],
    { model: GROQ_MODELS.analysis, temperature: 0.4, maxTokens: 1024 },
  );
}
