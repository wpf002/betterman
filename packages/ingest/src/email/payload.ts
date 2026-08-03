import { parseMime, type ParsedEmail } from './mime.js';

/**
 * Recovers the HTML body from a stored payload.
 *
 * `raw_payloads` holds two shapes under the same `email-mime` kind: full MIME
 * from the webhook and the IMAP backfill, and bare HTML from
 * `pnpm ingest:email-dir` when it is pointed at `.html` files. Running
 * `parseMime` over the second returns nothing, which made replays skip those
 * pieces without saying so.
 */
export interface RecoveredPayload {
  html: string | null;
  messageId?: string;
  receivedAt?: Date;
}

export async function recoverHtml(body: string): Promise<RecoveredPayload> {
  let mail: ParsedEmail | null = null;
  try {
    mail = await parseMime(body);
  } catch {
    mail = null;
  }

  if (mail?.html) {
    return {
      html: mail.html,
      messageId: mail.messageId ?? undefined,
      receivedAt: mail.date ?? undefined,
    };
  }

  // Not MIME, or MIME with no HTML part. If the payload is itself markup, it
  // came from a saved .html file and is already the body we want.
  const looksLikeHtml = /<\s*(html|body|div|table|p)\b/i.test(body);
  return { html: looksLikeHtml ? body : null };
}
