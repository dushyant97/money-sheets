import { useEffect, useState } from 'react';

/** Subscribe to a CSS media query and re-render when it flips. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = () => setMatches(mql.matches);
    handler();
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/** Mobile breakpoint shared with the layout CSS (`@media (max-width: 760px)`). */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 760px)');
}
