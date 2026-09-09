import Link from 'next/link';
import { Arrive } from '@/components/motion/Arrive';

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 px-gutter text-center">
      <Arrive />
      <p className="micro text-fg-2">Waseem Jewellers · Since 1952</p>
      <h1 className="display text-display-m">This page is not in the collection.</h1>
      <p className="max-w-[34em] text-fg-muted">The piece may have been reserved, or the address mistyped.</p>
      <nav className="eyebrow flex flex-wrap items-center justify-center gap-8 text-fg-2">
        <Link href="/">Home</Link>
        <Link href="/collections/bridal">Bridal</Link>
      </nav>
    </main>
  );
}
