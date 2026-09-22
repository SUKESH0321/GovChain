import { useEffect, useState } from 'react';

// Animated numeric counter with ease-out, tabular figures.
export default function CountUp({ value, duration = 650 }) {
  const [display, setDisplay] = useState(null);

  useEffect(() => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      setDisplay(null);
      return;
    }
    const target = Number(value);
    let raf;
    const start = performance.now();
    function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(target * eased));
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      }
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  if (display === null) {
    return <span>…</span>;
  }
  return <span>{display.toLocaleString('en-IN')}</span>;
}