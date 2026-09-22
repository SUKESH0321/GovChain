export default function EmptyState({ title, hint }) {
  return (
    <div className="py-10 text-center">
      <p className="text-lg font-semibold text-gray-600">∅</p>
      <p className="mt-1 font-semibold text-gray-700">{title}</p>
      {hint && <p className="mt-1 text-sm text-gray-500">{hint}</p>}
    </div>
  );
}