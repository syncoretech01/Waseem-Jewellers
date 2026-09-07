const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Traps Tab focus inside `root`; returns a release function that restores the previous focus. */
export function trapFocus(root: HTMLElement, initial?: HTMLElement | null) {
  const previous = document.activeElement as HTMLElement | null;
  const focusables = () =>
    [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    );
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const list = focusables();
    if (list.length === 0) return;
    const first = list[0]!;
    const last = list[list.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  root.addEventListener('keydown', onKey);
  const target = initial ?? focusables()[0];
  target?.focus({ preventScroll: true });
  return () => {
    root.removeEventListener('keydown', onKey);
    previous?.focus({ preventScroll: true });
  };
}
