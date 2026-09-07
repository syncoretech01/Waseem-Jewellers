import { cn } from '@/lib/cn';

/** The WJW monogram as an inline image (from the house logo, gold on transparent). */
export function Monogram({ className, gold = true }: { className?: string; gold?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/assets/waseem/brand/monogram.png"
      alt="Waseem Jewellers monogram"
      width={320}
      height={291}
      draggable={false}
      className={cn('block select-none', !gold && 'brightness-0 invert', className)}
      style={{ height: undefined }}
    />
  );
}
