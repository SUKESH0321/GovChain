export default function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-lg shadow p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-3xl font-bold mt-1">{value === null ? '…' : value}</p>
    </div>
  );
}