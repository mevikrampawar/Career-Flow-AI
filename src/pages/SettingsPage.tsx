import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { useKeys } from "../lib/keys";
import { useSync } from "../lib/sync";
import { useGmail } from "../lib/GmailProvider";
import { useAppStore } from "../store/useAppStore";
import { testGroqConnection } from "../lib/groq";
import { testApifyConnection } from "../lib/apify";
import { Button, Spinner } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { Field, Input } from "../components/ui/Input";
import { Icon } from "../components/ui/Icon";
import { useToast } from "../components/ui/Toast";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-outline-variant/70 px-4 py-2.5">
      <span className="font-body-sm text-body-sm text-on-surface-variant">{label}</span>
      <span className="truncate font-body-sm text-body-sm font-medium text-on-surface">
        {value}
      </span>
    </div>
  );
}

function KeyField({
  label,
  hint,
  value,
  placeholder,
  onChange,
  onSave,
  testLabel,
  onTest,
  testing,
  saved,
}: {
  label: string;
  hint: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  onSave: () => void;
  testLabel: string;
  onTest: () => Promise<void>;
  testing: boolean;
  saved?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="rounded-lg border border-outline-variant/70 p-4">
      <Field label={label} hint={hint}>
        <div className="flex gap-2">
          <Input
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="font-mono"
            autoComplete="off"
            spellCheck={false}
          />
          <Button variant="ghost" size="md" onClick={() => setShow((s) => !s)}>
            <Icon name={show ? "visibility_off" : "visibility"} size={18} />
            {show ? "Hide" : "Show"}
          </Button>
        </div>
      </Field>
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" onClick={onSave} disabled={!value.trim()}>
          Save key
        </Button>
        <Button size="sm" variant="secondary" onClick={onTest} loading={testing} disabled={!value.trim()}>
          {testLabel}
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-success">
            <Icon name="check_circle" size={16} filled />
            Saved
          </span>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user, signOut, firebaseEnabled } = useAuth();
  const { keys, setKeys, clearKeys, syncing } = useKeys();
  const sync = useSync();
  const resume = useAppStore((s) => s.resume);
  const savedJobs = useAppStore((s) => s.savedJobs);
  const applications = useAppStore((s) => s.applications);
  const searchJobs = useAppStore((s) => s.searchJobs);
  const scrapedJobs = useAppStore((s) => s.scrapedJobs);
  const { push } = useToast();

  const [groqDraft, setGroqDraft] = useState(keys.groqApiKey);
  const [apifyDraft, setApifyDraft] = useState(keys.apifyApiToken);
  const [gmailDraft, setGmailDraft] = useState(keys.gmailClientId);
  const [testingGroq, setTestingGroq] = useState(false);
  const [testingApify, setTestingApify] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const gmail = useGmail();

  useEffect(() => {
    setGmailDraft(keys.gmailClientId);
  }, [keys.gmailClientId]);

  function saveGmail() {
    setKeys({ gmailClientId: gmailDraft.trim() });
    push("success", "Gmail Client ID saved.");
  }

  function saveGroq() {
    setKeys({ groqApiKey: groqDraft.trim() });
    push("success", "Groq API key saved.");
  }
  function saveApify() {
    setKeys({ apifyApiToken: apifyDraft.trim() });
    push("success", "Apify API token saved.");
  }

  async function testGroq() {
    setTestingGroq(true);
    try {
      await testGroqConnection(groqDraft.trim());
      push("success", "Groq connection OK.");
    } catch (e) {
      push("error", e instanceof Error ? e.message : "Connection failed.");
    } finally {
      setTestingGroq(false);
    }
  }

  async function testApify() {
    setTestingApify(true);
    try {
      const who = await testApifyConnection(apifyDraft.trim());
      push("success", `Apify connected as @${who}.`);
    } catch (e) {
      push("error", e instanceof Error ? e.message : "Connection failed.");
    } finally {
      setTestingApify(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <header>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Settings</h1>
        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
          Bring your own keys — all AI and scraping calls run from your browser.
        </p>
      </header>

      {syncing && (
        <div className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
          <Spinner className="size-4" /> Syncing keys with Firestore…
        </div>
      )}

      {firebaseEnabled ? (
        <Card>
          <CardHeader
            title="Account"
            subtitle={user ? `Signed in as ${user.email}` : "Firebase is configured but not signed in."}
          />
          <div className="flex flex-wrap items-center gap-3 px-5 pb-5">
            {user ? (
              <Button variant="secondary" size="sm" onClick={() => signOut()}>
                Sign out
              </Button>
            ) : null}
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Keys are synced to your private Firestore document when signed in.
            </p>
          </div>
        </Card>
      ) : (
        <Card className="p-6">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Firebase isn't configured yet — keys stay on this device in
            localStorage. Add <code className="font-mono">VITE_FIREBASE_*</code>{" "}
            env vars to enable Google sign-in and cloud sync.
          </p>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Cloud data"
          subtitle={
            sync.signedIn
              ? sync.syncing
                ? "Syncing your data to Firestore…"
                : sync.lastSynced
                  ? `Synced to Firestore ${new Date(sync.lastSynced).toLocaleTimeString()}.`
                  : "Signed in — data syncs to Firestore."
              : "Sign in to back up your data to Firestore."
          }
          action={
            sync.syncing ? (
              <Spinner className="size-5" />
            ) : (
              <Icon
                name={sync.signedIn ? "cloud_done" : "cloud_off"}
                size={22}
                filled
                className={sync.signedIn ? "text-success" : "text-on-surface-variant"}
              />
            )
          }
        />
        <div className="space-y-3 px-5 pb-5">
          <Row label="Resume" value={resume ? resume.fileName || "Parsed" : "None"} />
          <Row label="Saved jobs" value={String(savedJobs.length)} />
          <Row label="Applications" value={String(applications.length)} />
          <Row label="Scraped jobs archive" value={String(scrapedJobs.length)} />
          <Row label="Latest search results" value={String(searchJobs.length)} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="AI keys"
          subtitle="Free tiers: Groq console and Apify free plan."
        />
        <div className="space-y-4 px-5 pb-5">
          <KeyField
            label="Groq API key"
            hint="Used for resume analysis, job matching, cover letters. Get one free at console.groq.com"
            value={groqDraft}
            placeholder="gsk_…"
            onChange={setGroqDraft}
            onSave={saveGroq}
            testLabel="Test connection"
            onTest={testGroq}
            testing={testingGroq}
            saved={keys.groqApiKey === groqDraft.trim() && Boolean(groqDraft.trim())}
          />
          <KeyField
            label="Apify API token"
            hint="Used to scrape job boards. Free monthly credits at console.apify.com"
            value={apifyDraft}
            placeholder="apify_api_…"
            onChange={setApifyDraft}
            onSave={saveApify}
            testLabel="Test connection"
            onTest={testApify}
            testing={testingApify}
            saved={keys.apifyApiToken === apifyDraft.trim() && Boolean(apifyDraft.trim())}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Gmail"
          subtitle="Send applications straight from your Gmail account. One-time Google Cloud setup, then it's automatic."
        />
        <div className="space-y-4 px-5 pb-5">
          <Field
            label="Google OAuth Client ID"
            hint="A 'Web application' client from console.cloud.google.com. Click 'How to set this up' for the 4-step guide."
          >
            <Input
              value={gmailDraft}
              onChange={(e) => setGmailDraft(e.target.value)}
              placeholder="…apps.googleusercontent.com"
              className="font-mono"
              autoComplete="off"
              spellCheck={false}
            />
          </Field>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={saveGmail}
              disabled={!gmailDraft.trim()}
            >
              Save Client ID
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!keys.gmailClientId || gmail.connected || gmail.connecting}
              loading={gmail.connecting}
              onClick={async () => {
                try {
                  await gmail.connect();
                  push("success", "Gmail connected.");
                } catch (e) {
                  push("error", e instanceof Error ? e.message : "Gmail connection failed.");
                }
              }}
            >
              <Icon name="link" size={16} />
              {gmail.connected ? "Connected" : "Connect Gmail"}
            </Button>
            {gmail.connected && (
              <Button
                size="sm"
                variant="outline-danger"
                onClick={async () => {
                  await gmail.disconnect();
                  push("info", "Gmail disconnected.");
                }}
              >
                Disconnect
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setGuideOpen((o) => !o)}>
              <Icon name={guideOpen ? "expand_less" : "expand_more"} size={16} />
              How to set this up
            </Button>
          </div>

          {gmail.connected && (
            <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success-container/40 px-4 py-3 font-body-sm text-body-sm text-on-surface">
              <Icon name="mark_email_read" size={18} className="text-success" />
              Connected as <span className="font-medium">{gmail.email}</span> — the app can send and read
              application emails for you.
            </div>
          )}
          {gmail.error && (
            <div className="flex items-center gap-2 rounded-lg border border-error/40 bg-error-container/40 px-4 py-3 font-body-sm text-body-sm text-error">
              <Icon name="error_outline" size={18} />
              {gmail.error}
            </div>
          )}

          {guideOpen && (
            <div className="space-y-3 rounded-lg border border-outline-variant/70 bg-surface-container-lowest p-4">
              <h4 className="font-headline-md text-headline-md text-on-surface">Google Cloud setup (once, ~5 min)</h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                We can't create Google credentials for you — Google only allows that from its own
                console. This app does everything after these four steps automatically.
              </p>
              <ol className="list-decimal space-y-3 pl-5 font-body-sm text-body-sm text-on-surface">
                <li>
                  <strong className="text-on-surface">Enable the Gmail API</strong> — open{" "}
                  <a
                    href="https://console.cloud.google.com/apis/library/gmail.googleapis.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    console.cloud.google.com/apis/library/gmail.googleapis.com
                  </a>{" "}
                  (project <code className="font-mono">me-career-flow</code>) and click Enable.
                </li>
                <li>
                  <strong className="text-on-surface">Configure the OAuth consent screen</strong> —{" "}
                  <a
                    href="https://console.cloud.google.com/auth/audience"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    console.cloud.google.com/auth/audience
                  </a>
                  . Set the user type to <em>External</em> and add your email to{" "}
                  <em>Test users</em>. You'll see "Google hasn't verified this app" the first time you
                  connect — that's expected and safe to click through.
                </li>
                <li>
                  <strong className="text-on-surface">Create a Web client</strong> —{" "}
                  <a
                    href="https://console.cloud.google.com/auth/clients"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    console.cloud.google.com/auth/clients
                  </a>{" "}
                  → Create credentials → OAuth client ID → <em>Web application</em>. Add these
                  Authorized JavaScript origins:
                  <div className="mt-2 flex flex-wrap gap-2">
                    <code className="rounded-md bg-surface-container-high px-2 py-1 font-mono">http://localhost:5174</code>
                    <code className="rounded-md bg-surface-container-high px-2 py-1 font-mono">https://mevikrampawar.github.io</code>
                  </div>
                </li>
                <li>
                  <strong className="text-on-surface">Copy the Client ID</strong> — paste it in the
                  field above and hit <em>Save Client ID</em>, then <em>Connect Gmail</em>.
                </li>
              </ol>
              <div className="flex items-start gap-2 rounded-lg bg-warning-container/60 px-3 py-2 font-body-sm text-body-sm text-warning">
                <Icon name="info" size={16} className="mt-0.5 shrink-0" />
                <span>
                  Gmail scopes are "sensitive", so Testing-mode access tokens expire every 7 days —
                  reconnect then. Publishing the app (Audience tab) removes that limit and the warning
                  screen.
                </span>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <div className="mt-3 flex items-center justify-between gap-4">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Remove all locally stored keys.
          </p>
          <Button
            variant="outline-danger"
            size="sm"
            onClick={() => {
              clearKeys();
              setGroqDraft("");
              setApifyDraft("");
              setGmailDraft("");
              push("info", "Keys cleared.");
            }}
          >
            Clear keys
          </Button>
        </div>
      </Card>
    </div>
  );
}
