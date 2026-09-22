// Skeleton placeholder for a table body while data is loading.
export default function LoadingState({ rows = 5, cols = 5 }) {
  return (
    <div className="py-2 space-y-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className={`flex gap-3 gc-animate-entrance gc-stagger-${Math.min(r + 1, 5)}`}>
          {Array.from({ length: cols }).map((__, c) => (
            <div key={c} className="gc-skeleton flex-1 rounded" style={{ height: 16 }} />
          ))}
        </div>
      ))}
    </div>
  );
}