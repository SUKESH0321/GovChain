import { useEffect, useState } from 'react';

// Viewports at or below this width are treated as compact (phone / small tablet).
const COMPACT_QUERY = '(max-width: 640px)';

function readCompact() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(COMPACT_QUERY).matches;
}

// Viewport-aware presets for the GradientWaves background layers, so phones
// render fewer raymarch steps and get gentler motion than desktops.
export default function useWavesProfile() {
  const [compact, setCompact] = useState(readCompact);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const query = window.matchMedia(COMPACT_QUERY);
    const onChange = (event) => setCompact(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return {
    compact,
    detail: compact ? 'low' : 'medium',
    grainIntensity: compact ? 0.03 : 0.045,
    // Full-page background (login / register).
    pageParallax: compact ? 0.28 : 0.5,
    // Section hero background (dashboard / project header) — barely moves.
    sectionParallax: compact ? 0.12 : 0.2,
  };
}
