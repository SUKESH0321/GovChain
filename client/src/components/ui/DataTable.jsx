import { Fragment } from 'react';

import EmptyState from './EmptyState';

// Presentational sortable table. Columns:
// { key, label, sortable?, align?, render?(row) }
export default function DataTable({
  columns,
  rows,
  rowKey = 'id',
  sort,
  onSort,
  onRowClick,
  renderExpanded,
  empty,
  hint,
}) {
  if (!rows.length) {
    return empty || <EmptyState title="No records" hint={hint || 'Nothing to display yet.'} />;
  }

  return (
    <div className="gc-table-scroll">
      <table className="gc-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={col.align === 'right' ? 'text-right' : ''}>
                {col.sortable ? (
                  <button type="button" className="gc-th-sort" onClick={() => onSort(col.key)}>
                    {col.label}
                    {sort && sort.key === col.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </button>
                ) : (
                  col.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <Fragment key={row[rowKey]}>
              <tr
                className={`${onRowClick ? 'gc-row-clickable gc-interactive hover:bg-gray-50 cursor-pointer' : ''} gc-animate-entrance gc-stagger-${Math.min(idx + 1, 5)} border-b border-gray-100 last:border-0`}
                onClick={() => onRowClick && onRowClick(row)}
              >
                {columns.map((col) => (
                  <td key={col.key} className={col.align === 'right' ? 'text-right' : ''}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
              {renderExpanded && renderExpanded(row)}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}