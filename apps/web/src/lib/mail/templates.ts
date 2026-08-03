import { chrome } from '@betterman/ui';
import type { MailMessage } from './send';

/**
 * Transactional mail, in BetterMan's own chrome — bone ground, light heading,
 * one clay CTA (spec §4). A source skin never appears here; these are from
 * BetterMan, not from a publication.
 */

/** Emails cannot rely on a font kit, so the fallback stack is used directly. */
const STACK = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export function passwordResetEmail(resetUrl: string, expiresInMinutes: number): MailMessage {
  const text = [
    'Reset your BetterMan Reader password',
    '',
    'Open this link to choose a new password:',
    resetUrl,
    '',
    `The link works once, and expires in ${expiresInMinutes} minutes.`,
    '',
    "If you didn't ask for this, you can ignore it — nothing has changed.",
  ].join('\n');

  const html = `<!doctype html>
<html lang="en"><body style="margin:0;padding:0;background:${chrome.bone};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${chrome.bone};">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
        <tr><td style="font-family:${STACK};color:${chrome.ink};">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${chrome.mute};">
            BetterMan Reader
          </p>
          <h1 style="margin:0 0 24px;font-size:32px;font-weight:300;line-height:1.15;color:${chrome.ink};">
            Choose a new password
          </h1>
          <p style="margin:0 0 28px;font-size:17px;line-height:1.65;color:${chrome.ink};">
            Open the link below and pick something new. It works once, and expires in
            ${expiresInMinutes} minutes.
          </p>
          <p style="margin:0 0 28px;">
            <a href="${resetUrl}" style="display:inline-block;background:${chrome.clay};color:#ffffff;text-decoration:none;border-radius:999px;padding:16px 32px;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">
              Reset password
            </a>
          </p>
          <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:${chrome.mute};word-break:break-all;">
            Or paste this into your browser:<br>${resetUrl}
          </p>
          <hr style="border:0;border-top:1px solid ${chrome.hair};margin:0 0 20px;">
          <p style="margin:0;font-size:15px;line-height:1.6;color:${chrome.mute};">
            If you didn&rsquo;t ask for this, you can ignore it — nothing has changed.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return {
    to: '',
    subject: 'Reset your BetterMan Reader password',
    text,
    html,
  };
}
