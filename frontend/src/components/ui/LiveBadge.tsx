export function LiveBadge({ label = 'LIVE' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-1 font-display text-[10px] font-bold tracking-[0.18em] text-rose-400">
      <span className="live-dot" />
      {label}
    </span>
  );
}
