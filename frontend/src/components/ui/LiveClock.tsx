import { useEffect, useState } from 'react';

export function LiveClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="hidden text-right md:block">
      <p className="font-display text-sm font-bold tabular-nums text-white">
        {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
      </p>
      <p className="text-[11px] uppercase tracking-[0.18em] text-ink-faint">
        {now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
      </p>
    </div>
  );
}
