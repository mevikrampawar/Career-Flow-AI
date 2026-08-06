import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";

const FEATURES = [
  {
    icon: "▤",
    title: "Resume intelligence",
    text: "Upload your PDF. Groq parses your skills, experience and projects into a structured profile.",
  },
  {
    icon: "⌕",
    title: "Automated job hunt",
    text: "Scrape live openings from LinkedIn, Indeed and Workable via Apify — all from your browser.",
  },
  {
    icon: "✨",
    title: "AI match scoring",
    text: "Every job is scored against your resume with strengths, gaps and keyword suggestions.",
  },
  {
    icon: "⚡",
    title: "Assisted apply",
    text: "Generate a tailored summary, highlights and cover letter, then jump to the application.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-outline-variant/60 bg-surface-container-lowest">
        <div className="mx-auto flex w-full max-w-(--container-app) items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-sm bg-primary-container text-sm font-semibold text-on-primary">
              CF
            </div>
            <span className="text-label-md font-semibold text-on-surface">
              Career Flow AI
            </span>
          </div>
          <Link to="/signin">
            <Button variant="secondary" size="sm">
              Sign in
            </Button>
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto w-full max-w-(--container-app) px-6 pb-16 pt-20 text-center">
          <span className="inline-block rounded-full border border-outline-variant bg-surface-container-low px-3 py-1 text-label-sm uppercase text-on-surface-variant">
            Free · Open source · Your keys
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-display-lg text-on-surface">
            Automate your job hunt.
            <br />
            <span className="text-primary-container">Land the right role.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-body-lg text-on-surface-variant">
            Upload your resume once. Career Flow parses it, hunts matching jobs
            across the web, and prepares a tailored application for each one.
            Bring your own API keys — your data stays yours.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link to="/signin">
              <Button size="lg">Start free</Button>
            </Link>
            <Link to="/app">
              <Button size="lg" variant="secondary">
                Open app
              </Button>
            </Link>
          </div>
        </section>

        <section className="mx-auto w-full max-w-(--container-app) px-6 pb-20">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-lg border border-outline-variant/70 bg-surface-container-lowest p-5"
              >
                <div className="grid size-10 place-items-center rounded-sm bg-primary-container/12 text-lg text-primary">
                  {f.icon}
                </div>
                <h3 className="mt-4 text-headline-md text-on-surface">
                  {f.title}
                </h3>
                <p className="mt-2 text-body-sm text-on-surface-variant">
                  {f.text}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-outline-variant/60 py-6">
        <div className="mx-auto flex w-full max-w-(--container-app) items-center justify-between px-6 text-body-sm text-on-surface-variant">
          <span>Career Flow AI · client-side by design</span>
          <span>Groq · Apify · Firebase · Google Stitch design</span>
        </div>
      </footer>
    </div>
  );
}
