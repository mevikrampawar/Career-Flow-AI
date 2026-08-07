/**
 * Gmail + Google Identity Services integration. Pure helpers — no React state.
 *
 * Auth model (BYOK): the user pastes their own Google OAuth "Web application"
 * Client ID in Settings. GIS (`google.accounts.oauth2`) mints an access token
 * against their signed-in Google session. Tokens live in memory only — they are
 * never persisted to localStorage or Firestore.
 */

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
];

const GIS_SRC = "https://accounts.google.com/gsi/client";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";

interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (res: TokenResponse) => void;
  error_callback?: (err: { type: string; message: string }) => void;
}

interface TokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: TokenClientConfig) => TokenClient;
          revoke: (token: string, done?: (res: unknown) => void) => void;
        };
        id: {
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

export class GmailError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "GmailError";
  }
}

/** In-memory token, never persisted. */
let cachedToken: { accessToken: string; expiresAt: number } | null = null;

export function setCachedToken(
  accessToken: string,
  expiresIn: number,
): void {
  cachedToken = { accessToken, expiresAt: Date.now() + expiresIn * 1000 };
}

export function clearCachedToken(): void {
  cachedToken = null;
}

export function getCachedToken(): string | null {
  if (!cachedToken) return null;
  if (cachedToken.expiresAt - Date.now() < 60_000) return null;
  return cachedToken.accessToken;
}

function loadGisScript(): Promise<void> {
  if (window.google?.accounts?.oauth2?.initTokenClient) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.getElementById("gis-script");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new GmailError("Failed to load Google Identity Services.")));
      return;
    }
    const script = document.createElement("script");
    script.id = "gis-script";
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new GmailError("Failed to load Google Identity Services."));
    document.head.appendChild(script);
  });
}

function tokenClient(clientId: string, scopes: string[], callback: (res: TokenResponse) => void): TokenClient {
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2?.initTokenClient) throw new GmailError("Google Identity Services unavailable.");
  return oauth2.initTokenClient({
    client_id: clientId,
    scope: scopes.join(" "),
    callback,
  });
}

/**
 * Mint (or silently refresh) an access token for the Gmail scopes against the
 * user's Google session. `prompt` controls whether a consent UI may appear.
 */
export function requestAccessToken(
  clientId: string,
  prompt: "consent" | "" = "",
): Promise<string> {
  return loadGisScript().then(() => {
    return new Promise<string>((resolve, reject) => {
      const handler = (res: TokenResponse) => {
        if (res.error) {
          reject(
            new GmailError(
              res.error_description ?? `Authorization failed (${res.error}).`,
              res.error,
            ),
          );
          return;
        }
        if (!res.access_token) {
          reject(new GmailError("No access token returned."));
          return;
        }
        setCachedToken(res.access_token, res.expires_in ?? 3600);
        resolve(res.access_token);
      };
      const client = tokenClient(clientId, GMAIL_SCOPES, handler);
      client.requestAccessToken({ prompt });
    });
  });
}

/**
 * Ensure we have a usable token, requesting a silent refresh if the cached one
 * is missing or about to expire. Throws GmailError if the user must re-consent.
 */
export async function ensureToken(clientId: string): Promise<string> {
  const existing = getCachedToken();
  if (existing) return existing;
  return requestAccessToken(clientId, "");
}

/** Revoke the current grant and forget the in-memory token. */
export async function revokeAccess(): Promise<void> {
  const token = cachedToken?.accessToken;
  clearCachedToken();
  window.google?.accounts?.id?.disableAutoSelect?.();
  if (token && window.google?.accounts?.oauth2?.revoke) {
    await new Promise<void>((resolve) => {
      window.google!.accounts.oauth2.revoke(token, () => resolve());
    });
  }
}

/** The Gmail account (email address) the token belongs to. */
export async function fetchGmailProfile(accessToken: string): Promise<{ emailAddress: string }> {
  const res = await fetch(`${GMAIL_API}/users/me/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw await parseGmailError(res, "Could not read your Gmail profile.");
  return (await res.json()) as { emailAddress: string };
}

export interface EmailAttachment {
  filename: string;
  mimeType: string;
  /** Raw file bytes. */
  data: Uint8Array;
}

/** Convert a base64 data URL (e.g. the stored resume PDF) into bytes + mime. */
export function dataUrlToBytes(dataUrl: string): { data: Uint8Array; mimeType: string } {
  const comma = dataUrl.indexOf(",");
  const head = dataUrl.slice(0, comma);
  const b64 = dataUrl.slice(comma + 1);
  const mimeType = head.match(/^data:([^;]+)/)?.[1] ?? "application/pdf";
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { data: bytes, mimeType };
}

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  attachments?: EmailAttachment[];
}

export function encodeRFC2047(value: string): string {
  // ASCII headers pass through untouched; anything else gets RFC 2047 encoded
  // so non-Latin subjects/names don't break the MIME parse on Google's side.
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function buildMimeWithAttachment(input: SendEmailInput): string {
  const boundary = `cfai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  const atts = input.attachments ?? [];
  const headers = [
    `To: ${sanitizeHeaderValue(input.to)}`,
    input.cc ? `Cc: ${sanitizeHeaderValue(input.cc)}` : null,
    `Subject: ${encodeRFC2047(sanitizeHeaderValue(input.subject))}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ]
    .filter(Boolean)
    .join("\r\n");

  const utf8 = new TextEncoder().encode(input.body);
  let bodyBinary = "";
  utf8.forEach((b) => {
    bodyBinary += String.fromCharCode(b);
  });

  const parts: string[] = [headers, "", `--${boundary}`];
  parts.push(
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    chunkBase64(btoa(bodyBinary)),
    "",
  );

  for (const att of atts) {
    const filename = encodeRFC2047(sanitizeHeaderValue(att.filename));
    parts.push(
      `--${boundary}`,
      `Content-Type: ${sanitizeHeaderValue(att.mimeType)}; name="${filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${filename}"`,
      "",
      chunkBase64(arrayBufferToBase64(att.data.buffer)),
      "",
    );
  }

  parts.push(`--${boundary}--`);
  return parts.join("\r\n");
}

function chunkBase64(base64: string, width = 76): string {
  if (base64.length <= width) return base64;
  const out: string[] = [];
  for (let i = 0; i < base64.length; i += width) {
    out.push(base64.slice(i, i + width));
  }
  return out.join("\r\n");
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

export function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function buildRawMime(input: SendEmailInput): string {
  const utf8 = new TextEncoder().encode(input.body);
  let bodyBinary = "";
  utf8.forEach((b) => {
    bodyBinary += String.fromCharCode(b);
  });
  const base64Body = chunkBase64(btoa(bodyBinary));

  if (!input.attachments?.length) {
    return [
      `To: ${sanitizeHeaderValue(input.to)}`,
      input.cc ? `Cc: ${sanitizeHeaderValue(input.cc)}` : null,
      `Subject: ${encodeRFC2047(sanitizeHeaderValue(input.subject))}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      base64Body,
    ]
      .filter(Boolean)
      .join("\r\n");
  }
  return buildMimeWithAttachment(input);
}

/** Send an email via the Gmail API. Returns { id, threadId }. */
export async function sendGmail(
  accessToken: string,
  input: SendEmailInput,
): Promise<{ id: string; threadId: string }> {
  const raw = toBase64Url(btoa(buildRawMime(input)));
  const res = await fetch(`${GMAIL_API}/users/me/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) throw await parseGmailError(res, "Gmail refused to send the message.");
  const data = (await res.json()) as { id: string; threadId: string };
  return { id: data.id, threadId: data.threadId };
}

export interface GmailThreadMessage {
  id: string;
  threadId: string;
  internalDate: string;
  snippet: string;
  from?: string;
  to?: string;
  subject?: string;
  body?: string;
  isReply: boolean;
}

function decodeHeaderValue(value: string | undefined): string {
  if (!value) return "";
  return value
    .replace(/=\?UTF-8\?B\?([^?]+)\?=/gi, (_m, b64) => {
      try {
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new TextDecoder().decode(bytes);
      } catch {
        return "";
      }
    })
    .replace(/=\?UTF-8\?Q\?([^?]+)\?=/gi, (_m, q) => q.replace(/_/g, " "));
}

function headerOf(msg: { payload?: { headers?: { name: string; value: string }[] } }, name: string): string {
  return msg.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function messageText(msg: { payload?: GmailPayload }): string {
  const parts: string[] = [];
  const walk = (part: GmailPayload | undefined) => {
    if (!part) return;
    if (part.body?.data) {
      try {
        parts.push(atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/")));
      } catch {
        /* ignore unparseable body */
      }
    }
    (part.parts ?? []).forEach(walk);
  };
  walk(msg.payload);
  return parts.join("\n\n").trim();
}

interface GmailPayload {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPayload[];
}

/** Fetch a thread and surface its messages (used for reply tracking). */
export async function fetchGmailThread(
  accessToken: string,
  threadId: string,
): Promise<GmailThreadMessage[]> {
  const res = await fetch(`${GMAIL_API}/users/me/threads/${encodeURIComponent(threadId)}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw await parseGmailError(res, "Could not load the Gmail thread.");
  const data = (await res.json()) as {
    messages?: {
      id: string;
      threadId: string;
      internalDate: string;
      snippet: string;
      payload?: GmailPayload & { headers?: { name: string; value: string }[] };
    }[];
  };
  return (data.messages ?? []).map((m) => {
    const subject = headerOf(m, "Subject");
    const from = decodeHeaderValue(headerOf(m, "From"));
    const to = decodeHeaderValue(headerOf(m, "To"));
    return {
      id: m.id,
      threadId: m.threadId,
      internalDate: m.internalDate,
      snippet: m.snippet,
      from,
      to,
      subject,
      body: messageText(m),
      isReply: /^(re|fw|fwd):/i.test(subject) || !/^application:/i.test(subject),
    };
  });
}

async function parseGmailError(res: Response, fallback: string): Promise<GmailError> {
  let detail = res.statusText;
  let code: string | undefined;
  try {
    const body = (await res.json()) as { error?: { message?: string; status?: string } };
    detail = body.error?.message ?? detail;
    code = body.error?.status;
  } catch {
    /* ignore */
  }
  if (res.status === 401) {
    return new GmailError("Gmail session expired. Reconnect to continue.", "UNAUTHENTICATED");
  }
  if (res.status === 403) {
    return new GmailError(
      "Permission denied. Make sure Gmail API is enabled and you approved the requested scopes.",
      "PERMISSION_DENIED",
    );
  }
  return new GmailError(`${fallback} (${res.status} ${detail})`, code);
}
