import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { loadOverview } from '../utils/stats';

const CommandPaletteContext = createContext(null);

// Global Ctrl/Cmd+K command palette: searches projects, tenders and milestones
// loaded from the live APIs, and navigates to the selected record.
export function CommandPaletteProvider({ children }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const openPalette = useCallback(() => {
    setOpen((wasOpen) => !wasOpen);
    setQuery('');
  }, []);

  useEffect(() => {
    function onKey(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setQuery('');
        setOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    setLoading(true);
    loadOverview()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [open]);

  const items = useMemo(() => {
    if (!data) {
      return [];
    }
    const list = [
      ...(data.projects || []).map((p) => ({
        id: `p-${p.id}`,
        type: 'Project',
        title: p.name,
        subtitle: p.location || 'No location',
        to: `/projects/${p.id}`,
      })),
      ...(data.tenders || []).map((t) => ({
        id: `t-${t.id}`,
        type: 'Tender',
        title: t.title,
        subtitle: t.project_name || '—',
        to: `/tenders/${t.id}`,
      })),
      ...(data.milestones || []).map((m) => ({
        id: `m-${m.id}`,
        type: 'Milestone',
        title: m.title,
        subtitle: m.project_name || '—',
        to: `/projects/${m.project_id}`,
      })),
    ];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? list.filter((item) =>
          `${item.type} ${item.title} ${item.subtitle}`.toLowerCase().includes(q)
        )
      : list;
    return filtered.slice(0, 12);
  }, [data, query]);

  function goTo(item) {
    navigate(item.to);
    setOpen(false);
  }

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(event) {
      if (event.key === 'Escape') {
        setOpen(false);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlight((h) => (items.length ? Math.min(h + 1, items.length - 1) : 0));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
      } else if (event.key === 'Enter' && items[highlight]) {
        goTo(items[highlight]);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, items, highlight, navigate]);

  return (
    <CommandPaletteContext.Provider value={{ openPalette }}>
      {children}
      {open && (
        <div className="gc-modal-backdrop" onMouseDown={() => setOpen(false)} role="presentation">
          <div
            className="gc-modal"
            style={{ maxWidth: 560 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="gc-modal-body">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects, tenders, milestones…"
                className="gc-input"
              />
              <p className="gc-eyebrow mt-3 mb-1">Results</p>
              {loading ? (
                <p className="text-sm text-gray-500">Loading records…</p>
              ) : items.length === 0 ? (
                <p className="text-sm text-gray-500">No matches.</p>
              ) : (
                <ul className="divide-y" style={{ borderColor: 'var(--gc-line)' }}>
                  {items.map((item, index) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 rounded flex items-center justify-between gap-2"
                        style={{
                          background: index === highlight ? 'var(--gc-blue-soft)' : 'transparent',
                        }}
                        onMouseEnter={() => setHighlight(index)}
                        onClick={() => goTo(item)}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="gc-badge tone-slate">{item.type}</span>
                          <span className="font-medium truncate">{item.title}</span>
                        </span>
                        <span className="text-xs text-gray-500 truncate">{item.subtitle}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error('useCommandPalette must be used inside a CommandPaletteProvider');
  }
  return context;
}