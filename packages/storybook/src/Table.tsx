import React, { useState } from 'react';

export interface TableColumn {
  key: string;
  title: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (record: any) => React.ReactNode;
}

export interface TableProps {
  columns: TableColumn[];
  data: any[];
  rowSelection?: boolean;
  pagination?: { pageSize: number; total: number };
  sorter?: boolean;
  filter?: boolean;
  resizable?: boolean;
  loading?: boolean;
  bordered?: boolean;
  striped?: boolean;
  hover?: boolean;
  size?: 'compact';
  expandable?: { expand: (record: any) => string };
}

export const Table: React.FC<TableProps> = ({
  columns, data, rowSelection, pagination, sorter, filter, resizable, loading, bordered, striped, hover, size, expandable,
}) => {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  const sorted = sortKey ? [...data].sort((a, b) => {
    const va = a[sortKey], vb = b[sortKey];
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  }) : data;

  const cellPad = size === 'compact' ? '6px 10px' : '10px 14px';
  const border = bordered ? '1px solid #e5e7eb' : 'none';

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 24, color: '#6b7280', fontSize: 14 }}>Loading...</div>;
  }

  return (
    <div style={{ overflowX: 'auto', width: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: '#f9fafb' }}>
            {rowSelection && <th style={{ padding: cellPad, borderBottom: border, textAlign: 'left', width: 40 }}><input type="checkbox" onChange={() => {/* select all */}} /></th>}
            {columns.map(col => (
              <th key={col.key} style={{ padding: cellPad, borderBottom: border, textAlign: 'left', fontWeight: 600, color: '#374151', cursor: col.sortable ? 'pointer' : undefined, whiteSpace: 'nowrap' }}
                onClick={col.sortable ? () => { setSortKey(col.key); setSortDir(d => d === 'asc' ? 'desc' : 'asc'); } : undefined}
              >
                {col.title}
                {col.sortable && sortKey === col.key && <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>}
              </th>
            ))}
            {expandable && <th style={{ padding: cellPad, borderBottom: border, width: 40 }} />}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr><td colSpan={columns.length + (rowSelection ? 1 : 0) + (expandable ? 1 : 0)} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>No data</td></tr>
          ) : sorted.map((row, idx) => (
            <React.Fragment key={row.key ?? idx}>
              <tr style={{
                background: striped && idx % 2 === 1 ? '#fafbfc' : '#fff',
                cursor: hover ? 'pointer' : undefined,
              }}
                onMouseEnter={hover ? e => (e.currentTarget.style.background = '#f3f4f6') : undefined}
                onMouseLeave={hover ? e => (e.currentTarget.style.background = striped && idx % 2 === 1 ? '#fafbfc' : '#fff') : undefined}
              >
                {rowSelection && <td style={{ padding: cellPad, borderBottom: border }}><input type="checkbox" checked={selectedRows.has(row.key)} onChange={() => { const s = new Set(selectedRows); s.has(row.key) ? s.delete(row.key) : s.add(row.key); setSelectedRows(s); }} /></td>}
                {columns.map(col => (
                  <td key={col.key} style={{ padding: cellPad, borderBottom: border, color: '#111827' }}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
                {expandable && (
                  <td style={{ padding: cellPad, borderBottom: border, textAlign: 'center' }}>
                    <button onClick={() => { const s = new Set(expandedRows); s.has(row.key) ? s.delete(row.key) : s.add(row.key); setExpandedRows(s); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>
                      {expandedRows.has(row.key) ? '▲' : '▼'}
                    </button>
                  </td>
                )}
              </tr>
              {expandable && expandedRows.has(row.key) && (
                <tr><td colSpan={columns.length + (rowSelection ? 1 : 0) + 1} style={{ padding: cellPad, borderBottom: border, background: '#f9fafb', fontSize: 13 }}>{expandable.expand(row)}</td></tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      {pagination && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 0', gap: 4 }}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>1-{Math.min(pagination.pageSize, data.length)} of {pagination.total}</span>
        </div>
      )}
    </div>
  );
};
