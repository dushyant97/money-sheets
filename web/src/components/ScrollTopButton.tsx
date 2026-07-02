import { useEffect, useState } from 'react';

/**
 * Floating "back to top" button. Appears once the page is scrolled past
 * `threshold` pixels and smooth-scrolls the window back to the top on click.
 */
export function ScrollTopButton({ threshold = 320 }: { threshold?: number }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  if (!show) return null;

  return (
    <button
      type="button"
      className="scroll-top-fab"
      aria-label="Scroll to top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      ↑
    </button>
  );
}
