/**
 * Inbound email parsing. The dedicated BetterMornings mailbox forwards raw
 * MIME to POST /ingest/email (spec §9); this turns that into the HTML body
 * the devotional normalizer reads.
 */
import { simpleParser } from 'mailparser';

export interface ParsedEmail {
  messageId: string | null;
  from: string | null;
  subject: string | null;
  date: Date | null;
  html: string | null;
  text: string | null;
}

export async function parseMime(raw: string | Buffer): Promise<ParsedEmail> {
  const mail = await simpleParser(raw);
  return {
    messageId: mail.messageId ?? null,
    from: mail.from?.value?.[0]?.address ?? null,
    subject: mail.subject ?? null,
    date: mail.date ?? null,
    html: typeof mail.html === 'string' ? mail.html : null,
    text: mail.text ?? null,
  };
}

/** Only mail actually from BetterMan should reach the normalizer. */
export const BETTERMORNINGS_SENDER = 'info@betterman.com';

export function isBettermorningsEmail(email: Pick<ParsedEmail, 'from' | 'subject'>): boolean {
  const from = email.from?.toLowerCase() ?? '';
  if (from !== BETTERMORNINGS_SENDER) return false;
  // The devotional subject has been stable ("BetterMornings Devo"), but match
  // loosely so a subject tweak does not silently drop a morning.
  return /bettermornings/i.test(email.subject ?? '');
}
