export default function ErrorState({ message, onRetry }) {
  return (
    <div className="px-4 py-6 border border-red-200 bg-red-50 rounded">
      <p className="font-semibold text-red-700">Request failed</p>
      <p className="mt-1 text-sm text-red-600">{message}</p>
      {onRetry && (
        <button type="button" className="gc-btn gc-btn-outline gc-btn-sm mt-3" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}