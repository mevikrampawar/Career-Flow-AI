import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { BrandLogo } from "../components/ui/Brand";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-surface font-body-md text-body-md text-on-surface antialiased">
      <nav className="sticky top-0 z-50 flex h-16 w-full items-center justify-between border-b border-variant bg-surface px-margin-desktop">
        <Link to="/" className="flex items-center gap-2.5">
          <BrandLogo className="h-8 w-auto" />
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/signin">
            <Button variant="ghost" size="sm">
              Log In
            </Button>
          </Link>
          <Link to="/signin">
            <Button size="sm">Sign Up</Button>
          </Link>
        </div>
      </nav>

      <section className="relative overflow-hidden pb-24 pt-32">
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-full w-full max-w-5xl -translate-x-1/2 -translate-y-1/2 opacity-30">
          <div className="animate-blob absolute right-10 top-0 h-64 w-64 rounded-full bg-primary-fixed opacity-70 blur-3xl mix-blend-multiply" />
          <div className="animate-blob absolute left-10 top-40 h-72 w-72 rounded-full bg-secondary-fixed opacity-70 blur-3xl mix-blend-multiply [animation-delay:2000ms]" />
          <div className="animate-blob absolute -bottom-20 left-1/2 h-80 w-80 rounded-full bg-surface-container-high opacity-70 blur-3xl mix-blend-multiply [animation-delay:4000ms]" />
        </div>

        <div className="relative z-10 mx-auto max-w-(--container-app) px-gutter">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-variant bg-surface-container-low px-3 py-1">
              <Icon name="auto_awesome" size={16} filled className="text-primary" />
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                Powered by Groq AI
              </span>
            </div>
            <h1 className="mb-6 font-headline-xl text-headline-xl tracking-tight text-on-surface md:text-[64px] md:leading-[1.05]">
              Automate your job search with AI precision.
            </h1>
            <p className="mx-auto mb-10 max-w-2xl font-body-lg text-body-lg text-on-surface-variant">
              Analyze resumes instantly, match with high-intent roles, and let our
              intelligent agents handle the application busywork. Reclaim your time
              and land your dream job faster.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link to="/signin" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto">
                  <GoogleIcon />
                  Continue with Google
                </Button>
              </Link>
            </div>
            <p className="mt-6 font-body-sm text-body-sm text-outline">
              Free to start — bring your own API keys, and your data syncs to your private cloud.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-surface-container-lowest py-24">
        <div className="mx-auto max-w-(--container-app) px-gutter">
          <div className="mb-16 md:mb-24">
            <h2 className="mb-4 font-headline-lg text-headline-lg text-on-surface">
              Core Infrastructure
            </h2>
            <p className="max-w-2xl font-body-md text-body-md text-on-surface-variant">
              Built for velocity. Our platform leverages advanced language models to
              parse, match, and prepare job applications with unprecedented accuracy.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-gutter md:grid-cols-12">
            <div className="group relative overflow-hidden rounded-xl border border-variant bg-surface p-8 transition-colors duration-300 hover:border-primary/30 md:col-span-8">
              <div className="absolute right-0 top-0 p-6 opacity-10 transition-opacity duration-300 group-hover:opacity-20">
                <Icon name="document_scanner" size={80} filled className="text-primary" />
              </div>
              <div className="relative z-10 flex h-full flex-col justify-between">
                <div>
                  <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-primary-fixed">
                    <Icon name="troubleshoot" className="text-on-primary-fixed" />
                  </div>
                  <h3 className="mb-3 font-headline-md text-headline-md text-on-surface">
                    Deep Resume Analysis
                  </h3>
                  <p className="max-w-md font-body-md text-body-md text-on-surface-variant">
                    Upload your PDF. Groq instantly parses your skills, experience and
                    projects, identifying gaps against target roles and suggesting
                    high-impact keywords.
                  </p>
                </div>
                <div className="mt-8 border-t border-variant/50 pt-6">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      Processing Speed
                    </span>
                    <span className="font-label-sm text-label-sm text-primary">
                      ~1.2 seconds
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
                    <div className="h-full w-[95%] rounded-full bg-primary" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col rounded-xl border border-variant bg-surface p-8 transition-colors duration-300 hover:border-primary/30 md:col-span-4">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-secondary-fixed">
                <Icon name="auto_awesome" className="text-on-secondary-fixed" />
              </div>
              <h3 className="mb-3 font-headline-md text-headline-md text-on-surface">
                AI Match Scoring
              </h3>
              <p className="mb-6 flex-grow font-body-md text-body-md text-on-surface-variant">
                Every job is scored against your resume with strengths, gaps and
                keyword suggestions — so you know exactly where you stand.
              </p>
              <Link to="/app/jobs" className="inline-flex items-center gap-2 font-label-md text-label-md text-primary transition-colors hover:text-primary-container">
                See how it works
                <Icon name="arrow_forward" size={16} />
              </Link>
            </div>

            <div className="flex flex-col items-center gap-12 rounded-xl border border-variant bg-surface-container-low p-8 transition-colors duration-300 hover:border-primary/30 md:col-span-12 md:flex-row">
              <div className="flex-1">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-variant bg-surface px-3 py-1">
                  <span className="h-2 w-2 rounded-full bg-accent-lime" />
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    Real-time Data
                  </span>
                </div>
                <h3 className="mb-4 font-headline-lg text-headline-lg text-on-surface">
                  Precision Job Matcher
                </h3>
                <p className="mb-6 max-w-lg font-body-md text-body-md text-on-surface-variant">
                  Scrape live openings from LinkedIn, Indeed and Workable via Apify.
                  Our matching algorithm scores semantic similarity between your
                  parsed skills and the raw job description requirements.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <Icon name="check_circle" className="text-primary" size={20} />
                    <span className="font-body-sm text-body-sm text-on-surface">
                      Filter by remote, hybrid, or on-site
                    </span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Icon name="check_circle" className="text-primary" size={20} />
                    <span className="font-body-sm text-body-sm text-on-surface">
                      Salary transparency extraction
                    </span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Icon name="check_circle" className="text-primary" size={20} />
                    <span className="font-body-sm text-body-sm text-on-surface">
                      Tailored summaries and cover letters for every shortlist
                    </span>
                  </li>
                </ul>
              </div>
              <div className="w-full flex-1 rounded-lg border border-variant bg-surface p-6 shadow-sm">
                <div className="mb-4 flex items-start justify-between border-b border-variant pb-4">
                  <div>
                    <div className="font-label-md text-label-md text-on-surface">
                      Senior Frontend Engineer
                    </div>
                    <div className="font-body-sm text-body-sm text-on-surface-variant">
                      Stripe · Remote
                    </div>
                  </div>
                  <span className="rounded bg-accent-lime/20 px-2 py-1 text-xs font-semibold text-on-surface">
                    98% Match
                  </span>
                </div>
                <div className="flex items-start justify-between opacity-50">
                  <div>
                    <div className="font-label-md text-label-md text-on-surface">
                      Fullstack Developer
                    </div>
                    <div className="font-body-sm text-body-sm text-on-surface-variant">
                      Vercel · Hybrid
                    </div>
                  </div>
                  <span className="rounded bg-surface-container-high px-2 py-1 text-xs font-semibold text-on-surface-variant">
                    85% Match
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-variant bg-surface py-12">
        <div className="mx-auto flex max-w-(--container-app) flex-col items-center justify-between gap-6 px-gutter md:flex-row">
          <div className="flex items-center gap-2.5">
            <BrandLogo className="h-7 w-auto" />
          </div>
          <div className="flex gap-6">
            <a className="font-body-sm text-body-sm text-on-surface-variant transition-colors hover:text-primary" href="#">
              Privacy
            </a>
            <a className="font-body-sm text-body-sm text-on-surface-variant transition-colors hover:text-primary" href="#">
              Terms
            </a>
            <a className="font-body-sm text-body-sm text-on-surface-variant transition-colors hover:text-primary" href="#">
              Contact
            </a>
          </div>
          <div className="font-body-sm text-body-sm text-outline">
            Client-side by design · Groq · Apify · Firebase
          </div>
        </div>
      </footer>
    </div>
  );
}
