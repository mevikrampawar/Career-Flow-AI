import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { useKeys } from "../lib/keys";
import { useGmail } from "../lib/GmailProvider";
import { useSync } from "../lib/sync";
import { wipeAccount } from "../lib/wipe";
import { testGroqConnection } from "../lib/groq";
import { testApifyConnection } from "../lib/apify";
import { Button, Spinner } from "./ui/Button";
import { Card, CardHeader } from "./ui/Card";
import { Field, Input } from "./ui/Input";
import { Icon } from "./ui/Icon";
import { Modal } from "./ui/Modal";
import { useToast } from "./ui/Toast";
import { CandidateProfileCard } from "./CandidateProfileCard";

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-primary transition-colors hover:text-primary-container hover:underline"
    >
      {children}
      <Icon name="arrow_outward" size={14} />
    </a>
  );
}

const GROQ_LINK = "https://console.groq.com/keys";
const APIFY_LINK = "https://console.apify.com";

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
  hint: React.ReactNode;
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
          <span className="inline-flex items-center gap-1 text-label-sm text-success">
            <Icon name="check_circle" size={16} filled />
            Saved
          </span>
        )}
      </div>
    </div>
  );
}

export function ProfilePanel() {
  const { user, signOut } = useAuth();
  const { keys, setKeys, clearKeys } = useKeys();
  const sync = useSync();
  const gmail = useGmail();
  const { push } = useToast();

  const [groqDraft, setGroqDraft] = useState(keys.groqApiKey);
  const [apifyDraft, setApifyDraft] = useState(keys.apifyApiToken);
  const [gmailDraft, setGmailDraft] = useState(keys.gmailClientId);
  const [testingGroq, setTestingGroq] = useState(false);
  const [testingApify, setTestingApify] = useState(false);
  const [gmailGuideOpen, setGmailGuideOpen] = useState(false);
  const [dangerOpen, setDangerOpen] = useState(false);
  const [dangerConfirm, setDangerConfirm] = useState("");
  const [wiping, setWiping] = useState(false);

  useEffect(() => {
    setGroqDraft(keys.groqApiKey);
  }, [keys.groqApiKey]);
  useEffect(() => {
    setApifyDraft(keys.apifyApiToken);
  }, [keys.apifyApiToken]);
  useEffect(() => {
    setGmailDraft(keys.gmailClientId);
  }, [keys.gmailClientId]);

  function saveGroq() {
    setKeys({ groqApiKey: groqDraft.trim() });
    push("success", "Groq API key saved.");
  }
  function saveApify() {
    setKeys({ apifyApiToken: apifyDraft.trim() });
    push("success", "Apify API token saved.");
  }
  function saveGmail() {
    setKeys({ gmailClientId: gmailDraft.trim() });
    push("success", "Gmail Client ID saved.");
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

  async function confirmWipe() {
    if (!user) return;
    setWiping(true);
    try {
      // Revoke the Gmail grant + clear the provider's in-memory state first.
      try {
        await gmail.disconnect();
      } catch {
        /* token already gone — keep going */
      }
      const result = await wipeAccount(user.uid);
      setDangerOpen(false);
      setDangerConfirm("");
      if (result.accountDeleted) {
        push("success", "All data and your account were deleted. See you next time!");
      } else {
        push(
          "info",
          "Data wiped. The Google account itself couldn't be deleted — sign in again and retry if you want it gone too.",
        );
      }
    } catch (e) {
      push("error", e instanceof Error ? e.message : "Could not wipe your data.");
    } finally {
      setWiping(false);
    }
  }

  const initial = (user?.displayName ?? user?.email ?? "?")
    .charAt(0)
    .toUpperCase();

  return (
    <>
      <div className="flex flex-col gap-6">
      <Card>
        <CardHeader
          title="Account"
          subtitle={user ? `Signed in as ${user.email}` : "Not signed in."}
        />
        <div className="px-5 pb-5">
          <div className="flex items-center gap-3 rounded-lg border border-border-variant bg-surface-container-lowest px-4 py-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-variant text-label-md font-semibold text-primary">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-label-md font-semibold text-on-surface">
                {user?.displayName ?? "Signed in"}
              </div>
              <div className="truncate text-body-sm text-on-surface-variant">
                {user?.email}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-body-sm text-on-surface-variant">
                {sync.syncing ? (
                  <>
                    <Spinner className="size-3.5" /> Syncing to your cloud…
                  </>
                ) : (
                  <>
                    <Icon
                      name={sync.signedIn ? "cloud_done" : "cloud_off"}
                      size={14}
                      filled
                      className={sync.signedIn ? "text-success" : "text-on-surface-variant"}
                    />
                    {sync.signedIn
                      ? sync.lastSynced
                        ? `Synced ${new Date(sync.lastSynced).toLocaleTimeString()}`
                        : "Data syncs to your account"
                      : "Sign in to back up data"}
                  </>
                )}
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => signOut()}>
              <Icon name="logout" size={16} />
              Sign out
            </Button>
          </div>
        </div>
      </Card>

      <CandidateProfileCard />

      <Card>
        <CardHeader
          title="AI keys"
          subtitle="Free tiers: Groq console and Apify free plan."
        />
        <div className="space-y-4 px-5 pb-5">
          <KeyField
            label="Groq API key"
            hint={
              <>
                Used for resume analysis, job matching, and emails.{" "}
                <ExternalLink href={GROQ_LINK}>Get a free key</ExternalLink>
              </>
            }
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
            hint={
              <>
                Used to scrape job boards.{" "}
                <ExternalLink href={APIFY_LINK}>Free monthly credits</ExternalLink>
              </>
            }
            value={apifyDraft}
            placeholder="apify_api_…"
            onChange={setApifyDraft}
            onSave={saveApify}
            testLabel="Test connection"
            onTest={testApify}
            testing={testingApify}
            saved={keys.apifyApiToken === apifyDraft.trim() && Boolean(apifyDraft.trim())}
          />
          <div className="flex items-center justify-between gap-4">
            <p className="text-body-sm text-on-surface-variant">
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
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Gmail"
          subtitle="Send applications straight from your Gmail account. One-time Google Cloud setup, then it's automatic."
          action={
            <Button size="sm" variant="ghost" onClick={() => setGmailGuideOpen((o) => !o)}>
              <Icon name={gmailGuideOpen ? "expand_less" : "expand_more"} size={16} />
              How to set this up
            </Button>
          }
        />
        <div className="space-y-4 px-5 pb-5">
          <Field
            label="Google OAuth Client ID"
            hint="A 'Web application' client from console.cloud.google.com."
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
            <Button size="sm" onClick={saveGmail} disabled={!gmailDraft.trim()}>
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
          </div>

          {gmail.connected && (
            <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success-container/40 px-4 py-3 text-body-sm text-on-surface">
              <Icon name="mark_email_read" size={18} className="text-success" />
              Connected as <span className="font-medium">{gmail.email}</span> — the app can send and read
              application emails for you.
            </div>
          )}
          {gmail.error && (
            <div className="flex items-center gap-2 rounded-lg border border-error/40 bg-error-container/40 px-4 py-3 text-body-sm text-error">
              <Icon name="error_outline" size={18} />
              {gmail.error}
            </div>
          )}

          {gmailGuideOpen && (
            <div className="space-y-3 rounded-lg border border-outline-variant/70 bg-surface-container-lowest p-4">
              <h4 className="text-headline-md text-on-surface">Google Cloud setup — done once, ~5 minutes</h4>
              <ol className="list-decimal space-y-3 pl-5 text-body-sm text-on-surface">
                <li>
                  <strong className="text-on-surface">Gmail API enabled</strong> — open{" "}
                  <ExternalLink href="https://console.cloud.google.com/apis/library/gmail.googleapis.com">
                    console.cloud.google.com/apis/library/gmail.googleapis.com
                  </ExternalLink>{" "}
                  (project <code className="font-mono">me-career-flow</code>) and click <em>Enable</em> if it
                  isn't already.
                </li>
                <li>
                  <strong className="text-on-surface">Consent screen approved</strong> — open{" "}
                  <ExternalLink href="https://console.cloud.google.com/auth/audience">
                    console.cloud.google.com/auth/audience
                  </ExternalLink>{" "}
                  and set publishing status to <em>In production</em> so nothing expires.
                </li>
                <li>
                  <strong className="text-on-surface">Web client created</strong> — open{" "}
                  <ExternalLink href="https://console.cloud.google.com/auth/clients">
                    console.cloud.google.com/auth/clients
                  </ExternalLink>{" "}
                  and make sure there's a <em>Web application</em> OAuth client with these Authorized
                  JavaScript origins:
                  <div className="mt-2 flex flex-wrap gap-2">
                    <code className="rounded-md bg-surface-container-high px-2 py-1 font-mono">http://localhost:5174</code>
                    <code className="rounded-md bg-surface-container-high px-2 py-1 font-mono">https://mevikrampawar.github.io</code>
                  </div>
                </li>
                <li>
                  <strong className="text-on-surface">Client ID pasted</strong> — the field above should hold
                  the ID ending in <code className="font-mono">…apps.googleusercontent.com</code>. Hit <em>Save
                  Client ID</em>, then <em>Connect Gmail</em> and pick the Google account to send from.
                </li>
              </ol>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Danger zone"
          subtitle="Erase everything and start over from scratch."
        />
        <div className="px-5 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-error/40 bg-error-container/40 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-label-md font-semibold text-on-surface">
                Delete all data and this account
              </p>
              <p className="mt-0.5 text-body-sm text-on-surface-variant">
                Removes your resume, jobs, applications, API keys, Gmail
                connection, cloud data, and the Google account. This can't be
                undone.
              </p>
            </div>
            <Button variant="danger" size="sm" onClick={() => setDangerOpen(true)}>
              <Icon name="delete_forever" size={16} />
              Delete everything
            </Button>
          </div>
        </div>
      </Card>
    </div>

    <Modal
      open={dangerOpen}
      onClose={() => {
        if (!wiping) setDangerOpen(false);
      }}
      title="Delete everything?"
    >
      <div className="space-y-4">
        <p className="text-body-sm text-on-surface-variant">
          This permanently deletes:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-body-sm text-on-surface">
          <li>Your resume, candidate profile, saved &amp; scraped jobs, and applications</li>
          <li>Your API keys and Gmail connection</li>
          <li>All cloud-synced data for your account</li>
          <li>The Google account itself — you'll need to sign up again to use the app</li>
        </ul>
        <Field label="Type DELETE to confirm">
          <Input
            value={dangerConfirm}
            onChange={(e) => setDangerConfirm(e.target.value)}
            placeholder="DELETE"
            className="font-mono"
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={() => setDangerOpen(false)} disabled={wiping}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={wiping}
            disabled={dangerConfirm.trim() !== "DELETE"}
            onClick={confirmWipe}
          >
            {wiping ? "Deleting…" : "Delete everything"}
          </Button>
        </div>
      </div>
    </Modal>
    </>
  );
}
