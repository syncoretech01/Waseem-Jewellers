import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 px-gutter text-center">
      <p className="micro text-fg-2">The House of Waseem</p>
      <h1 className="display text-display-m">This page is not in the House.</h1>
      <p className="max-w-[34em] text-fg-muted">The piece may have been reserved, or the address mistyped.</p>
      <nav className="eyebrow flex flex-wrap items-center justify-center gap-8 text-fg-2">
        <Link href="/">The House</Link>
        <Link href="/collections/bridal">The Bridal House</Link>
      </nav>
    </main>
  );
}
