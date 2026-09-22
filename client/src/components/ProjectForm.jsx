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
        <label htmlFor="name" className="gc-label">Name</label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="gc-input"
          placeholder="e.g. New City Bridge"
        />
      </div>

      <div>
        <label htmlFor="description" className="gc-label">Description</label>
        <textarea
          id="description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="gc-textarea"
          placeholder="Short description of the project"
        />
      </div>

      <div className="gc-form-grid">
        <div>
          <label htmlFor="budget" className="gc-label">Budget (₹)</label>
          <input
            id="budget"
            type="number"
            min="0"
            step="0.01"
            required
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className="gc-input"
            placeholder="e.g. 5000000"
          />
        </div>
        <div>
          <label htmlFor="location" className="gc-label">Location</label>
          <input
            id="location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="gc-input"
            placeholder="e.g. Mumbai"
          />
        </div>
      </div>

      <div className="gc-form-grid">
        <div>
          <label htmlFor="start_date" className="gc-label">Start date</label>
          <input
            id="start_date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="gc-input"
          />
        </div>
        <div>
          <label htmlFor="end_date" className="gc-label">End date</label>
          <input
            id="end_date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="gc-input"
          />
        </div>
      </div>

      <div>
        <label htmlFor="status" className="gc-label">Status</label>
        <select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="gc-select"
        >
          {PROJECT_STATUSES.map((value) => (
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