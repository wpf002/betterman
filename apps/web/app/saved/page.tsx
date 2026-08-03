import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { getBookmarks, getSavedSteps } from '@/lib/reading/queries';
import { completeNextStep } from '@/lib/reading/actions';
import { formatLongDate } from '@/lib/dates';

export const metadata = { title: 'Saved' };
export const dynamic = 'force-dynamic';

export default async function SavedPage() {
  const user = await getSessionUser();
  if (!user) redirect('/sign-in?next=%2Fsaved');

  const [bookmarks, steps] = await Promise.all([getBookmarks(user.id), getSavedSteps(user.id)]);
  const open = steps.filter((s) => !s.completedAt);
  const done = steps.filter((s) => s.completedAt);

  return (
    <div className="mx-auto max-w-shell px-5 py-12 sm:py-16">
      <p className="bm-eyebrow">Saved</p>
      <h1 className="mt-4 text-display-sm sm:text-display-md">Your reading</h1>

      {/* Right Next Steps first — they are commitments, not references. */}
      <section className="mt-12">
        <h2 className="bm-eyebrow">Right next steps</h2>

        {steps.length === 0 ? (
          <p className="mt-4 max-w-measure text-mute">
            When a devotional gives you a next step worth keeping, save it and it will wait here.
          </p>
        ) : (
          <ul className="mt-4 border-t border-hair">
            {[...open, ...done].map((step) => (
              <li key={step.itemId} className="border-b border-hair py-6">
                <div className="flex items-start gap-4">
                  <form action={completeNextStep.bind(null, step.itemId, !step.completedAt)}>
                    <button
                      type="submit"
                      aria-pressed={Boolean(step.completedAt)}
                      aria-label={
                        step.completedAt ? 'Mark as not done' : 'Mark this step done'
                      }
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        step.completedAt
                          ? 'border-clay bg-clay text-white'
                          : 'border-hair hover:border-clay'
                      }`}
                    >
                      {step.completedAt ? '✓' : ''}
                    </button>
                  </form>

                  <div className="min-w-0">
                    <p
                      className={`max-w-measure text-[17px] ${
                        step.completedAt ? 'text-mute line-through' : 'text-ink'
                      }`}
                    >
                      {step.stepText}
                    </p>
                    <Link
                      href={step.href}
                      className="bm-eyebrow mt-2 inline-block hover:text-clay-deep"
                    >
                      {step.title}
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-16">
        <h2 className="bm-eyebrow">Bookmarks</h2>

        {bookmarks.length === 0 ? (
          <p className="mt-4 max-w-measure text-mute">Nothing bookmarked yet.</p>
        ) : (
          <ul className="mt-4 border-t border-hair">
            {bookmarks.map((piece) => (
              <li key={piece.itemId} className="border-b border-hair">
                <Link href={piece.href} className="group block py-6">
                  <p className="bm-eyebrow">
                    {piece.publication} · {formatLongDate(piece.publishedAt)}
                  </p>
                  <p className="mt-2 text-[22px] group-hover:text-clay-deep">{piece.title}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
