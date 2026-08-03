import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-shell px-5 py-16 sm:py-24">
      <p className="bm-eyebrow">Not found</p>
      <h1 className="mt-4 max-w-measure text-display-sm sm:text-display-md">
        That page isn&rsquo;t <em className="bm-emphasis">here</em>.
      </h1>
      <p className="mt-4 max-w-measure text-mute">
        It may have moved, or the link may be wrong.
      </p>
      <Link href="/" className="bm-button mt-8">
        Back to reading
      </Link>
    </div>
  );
}
