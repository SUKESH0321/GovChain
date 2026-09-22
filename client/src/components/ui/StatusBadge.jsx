const TONES = {
  PLANNED: 'tone-slate',
  OPEN: 'tone-amber',
  PENDING: 'tone-amber',
  IN_PROGRESS: 'tone-blue',
  ASSIGNED: 'tone-indigo',
  SUBMITTED: 'tone-indigo',
  VERIFIED: 'tone-green',
  COMPLETED: 'tone-green',
  REJECTED: 'tone-red',
  CLOSED: 'tone-slate',
  CANCELLED: 'tone-red',
};

export default function StatusBadge({ status, label }) {
  const tone = TONES[status] || 'tone-slate';
  return <span className={`gc-badge ${tone}`}>{label || status.replace('_', ' ')}</span>;
}