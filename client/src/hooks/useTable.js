import { useMemo, useState } from 'react';

import useDebouncedValue from './useDebouncedValue';

// Generic search + status filter + sort state around a row array.
// `searchKeys` are the row properties searched; `initialSort` is e.g. { key: 'name', dir: 'asc' }.
export default function useTable(rows = [], { searchKeys = [], initialSort = null } = {}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState(initialSort);

  const debouncedSearch = useDebouncedValue(search);

  const filtered = useMemo(() => {
    let out = rows || [];
    const query = debouncedSearch.trim().toLowerCase();
    if (query && searchKeys.length) {
      out = out.filter((row) =>
        searchKeys.some((key) => {
          const value = row[key];
          return (
            value !== null &&
            value !== undefined &&
            String(value).toLowerCase().includes(query)
          );
        })
      );
    }
    if (statusFilter) {
      out = out.filter((row) => row.status === statusFilter);
    }
    return out;
  }, [rows, debouncedSearch, searchKeys, statusFilter]);

  const sorted = useMemo(() => {
    if (!sort || !sort.key) {
      return filtered;
    }
    const { key, dir } = sort;
    return [...filtered].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv));
      return dir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sort]);

  function toggleSort(key) {
    setSort((current) =>
      current && current.key === key && current.dir === 'asc'
        ? { key, dir: 'desc' }
        : { key, dir: 'asc' }
    );
  }

  return { search, setSearch, statusFilter, setStatusFilter, sort, toggleSort, rows: sorted };
}