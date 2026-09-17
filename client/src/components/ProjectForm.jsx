import { useState } from 'react';

const PROJECT_STATUSES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

// Shared form for creating and editing a project.
// `initial` supplies existing values when editing; `onSubmit` receives the
// filled-in project fields as one object.
export default function ProjectForm({ initial = {}, onSubmit, submitLabel = 'Save', submitting = false }) {
  const [name, setName] = useState(initial.name || '');
  const [description, setDescription] = useState(initial.description || '');
  const [budget, setBudget] = useState(initial.budget || '');
  const [location, setLocation] = useState(initial.location || '');
  const [startDate, setStartDate] = useState(initial.start_date || '');
  const [endDate, setEndDate] = useState(initial.end_date || '');
  const [status, setStatus] = useState(initial.status || 'PLANNED');

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({
      name,
      description,
      budget,
      location,
      start_date: startDate,
      end_date: endDate,
      status,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          Name
        </label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2"
          placeholder="e.g. New City Bridge"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1">
          Description
        </label>
        <textarea
          id="description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2"
          placeholder="Short description of the project"
        />
      </div>

      <div>
        <label htmlFor="budget" className="block text-sm font-medium mb-1">
          Budget
        </label>
        <input
          id="budget"
          type="number"
          min="0"
          step="0.01"
          required
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2"
          placeholder="e.g. 5000000"
        />
      </div>

      <div>
        <label htmlFor="location" className="block text-sm font-medium mb-1">
          Location
        </label>
        <input
          id="location"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2"
          placeholder="e.g. Mumbai"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="start_date" className="block text-sm font-medium mb-1">
            Start date
          </label>
          <input
            id="start_date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="end_date" className="block text-sm font-medium mb-1">
            End date
          </label>
          <input
            id="end_date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </div>
      </div>

      <div>
        <label htmlFor="status" className="block text-sm font-medium mb-1">
          Status
        </label>
        <select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2"
        >
          {PROJECT_STATUSES.map((value) => (
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
        {submitting ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}