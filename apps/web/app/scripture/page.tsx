import { redirect } from 'next/navigation';

/**
 * The Scripture index lives on the Search page now — both answer "where was
 * that?", and two destinations for one job is one too many. Individual book
 * and chapter pages remain, so existing links keep working.
 */
export default function ScriptureIndexPage() {
  redirect('/search');
}
