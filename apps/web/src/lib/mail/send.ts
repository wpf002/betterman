import 'server-only';

/**
 * Outbound mail.
 *
 * Two transports, chosen by env, and no dependency for either:
 *
 *   console  (default) — writes the message to the server log, including the
 *                        full link. Lets the whole reset flow be built and
 *                        tested before a provider is chosen.
 *   resend             — posts to the Resend HTTP API. Set MAIL_TRANSPORT and
 *                        RESEND_API_KEY and nothing else changes.
 *
 * Adding Postmark or SES later means one more branch here, not a rewrite: the
 * callers only ever see `sendMail`.
 */

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export type MailResult = { ok: true } | { ok: false; error: string };

const transport = (process.env.MAIL_TRANSPORT ?? 'console').toLowerCase();
const from = process.env.MAIL_FROM ?? 'BetterMan Reader <no-reply@betterman.com>';

export function mailIsConfigured(): boolean {
  if (transport === 'resend') return Boolean(process.env.RESEND_API_KEY);
  return true; // console always "works"
}

export async function sendMail(message: MailMessage): Promise<MailResult> {
  if (transport === 'resend') return sendViaResend(message);
  return sendViaConsole(message);
}

function sendViaConsole(message: MailMessage): MailResult {
  // Deliberately loud and unambiguous: in development this IS the inbox.
  console.log(
    [
      '',
      '──────── mail (console transport) ────────',
      `to:      ${message.to}`,
      `from:    ${from}`,
      `subject: ${message.subject}`,
      '',
      message.text,
      '──────────────────────────────────────────',
      '',
    ].join('\n'),
  );
  return { ok: true };
}

async function sendViaResend(message: MailMessage): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: 'RESEND_API_KEY is not set' };

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      return { ok: false, error: `Resend responded ${response.status}: ${detail.slice(0, 200)}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
