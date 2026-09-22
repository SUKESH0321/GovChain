import { useState } from 'react';

const MILESTONE_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED'];

// Form used to create or edit a milestone. `initial` supplies values when editing.
export default function MilestoneForm({
  initial = {},
  onSubmit,
  submitLabel = 'Create Milestone',
  submitting = false,
}) {
  const [title, setTitle] = useState(initial.title || '');
  const [description, setDescription] = useState(initial.description || '');
  const [amount, setAmount] = useState(initial.amount || '');
  const [dueDate, setDueDate] = useState(initial.due_date || '');
  const [status, setStatus] = useState(initial.status || 'PENDING');

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({
      title,
      description,
      amount,
      due_date: dueDate,
      status,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="milestone-title" className="gc-label">Title</label>
        <input
          id="milestone-title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="gc-input"
          placeholder="e.g. Foundation work"
        />
      </div>

      <div>
        <label htmlFor="milestone-description" className="gc-label">Description</label>
        <textarea
          id="milestone-description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="gc-textarea"
          placeholder="Description of the milestone"
        />
      </div>

      <div className="gc-form-grid">
        <div>
          <label htmlFor="milestone-amount" className="gc-label">Amount (₹)</label>
          <input
            id="milestone-amount"
            type="number"
            min="0"
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="gc-input"
            placeholder="e.g. 1000000"
          />
        </div>
        <div>
          <label htmlFor="milestone-due-date" className="gc-label">Due date</label>
          <input
            id="milestone-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="gc-input"
          />
        </div>
      </div>

      <div>
        <label htmlFor="milestone-status" className="gc-label">Status</label>
        <select
          id="milestone-status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="gc-select"
        >
          {MILESTONE_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      <button type="submit" disabled={submitting} className="gc-btn gc-btn-primary w-full">
        {submitting ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}