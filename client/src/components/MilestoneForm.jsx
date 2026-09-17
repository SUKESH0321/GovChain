import { useState } from 'react';

const MILESTONE_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED'];

// Form used by Government Officers to create a milestone for a project.
export default function MilestoneForm({ onSubmit, submitting = false }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState('PENDING');

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
        <label htmlFor="milestone-title" className="block text-sm font-medium mb-1">
          Title
        </label>
        <input
          id="milestone-title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2"
          placeholder="e.g. Foundation work"
        />
      </div>

      <div>
        <label htmlFor="milestone-description" className="block text-sm font-medium mb-1">
          Description
        </label>
        <textarea
          id="milestone-description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2"
          placeholder="Description of the milestone"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="milestone-amount" className="block text-sm font-medium mb-1">
            Amount
          </label>
          <input
            id="milestone-amount"
            type="number"
            min="0"
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="e.g. 1000000"
          />
        </div>
        <div>
          <label htmlFor="milestone-due-date" className="block text-sm font-medium mb-1">
            Due date
          </label>
          <input
            id="milestone-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </div>
      </div>

      <div>
        <label htmlFor="milestone-status" className="block text-sm font-medium mb-1">
          Status
        </label>
        <select
          id="milestone-status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2"
        >
          {MILESTONE_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? 'Creating…' : 'Create Milestone'}
      </button>
    </form>
  );
}