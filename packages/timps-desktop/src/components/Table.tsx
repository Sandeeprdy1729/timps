/**
 * TIMPS Desktop - Table
 * Data table component.
 */

import { useState, useMemo } from 'react';
import './Table.css';

interface Column<T> {
  key: keyof T;
  header: string;
  width?: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  sortKey?: keyof T;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: keyof T) => void;
  rowKey: keyof T;
  onRowClick?: (row: T) => void;
}

export function Table<T>({ data, columns, sortKey, sortDirection, onSort, rowKey, onRowClick }: TableProps<T>) {
  return (
    <div className="table-wrapper">
      <table className="table">
        <thead>
          <tr>
            {columns.map(col => (
              <th 
                key={String(col.key)} 
                style={{ width: col.width }}
                onClick={() => onSort?.(col.key)}
              >
                {col.header}
                {sortKey === col.key && (
                  <span className="sort-indicator">
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr 
              key={String(row[rowKey])} 
              onClick={() => onRowClick?.(row)}
            >
              {columns.map(col => (
                <td key={String(col.key)}>
                  {col.render 
                    ? col.render(row[col.key], row)
                    : String(row[col.key])
                  }
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface DataGridProps<T> {
  data: T[];
  columns: Column<T>[];
  sortable?: boolean;
}

export function DataGrid<T>({ data, columns, sortable = true }: DataGridProps<T>) {
  const [sort, setSort] = useState<{ key: keyof T; direction: 'asc' | 'desc' } | null>(null);

  const sortedData = useMemo(() => {
    if (!sort) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sort.key];
      const bVal = b[sort.key];
      if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sort]);

  const handleSort = (key: keyof T) => {
    setSort(prev => ({
      key,
      direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  return (
    <Table 
      data={sortedData} 
      columns={columns}
      sortKey={sort?.key}
      sortDirection={sort?.direction}
      onSort={sortable ? handleSort : undefined}
      rowKey={columns[0]?.key as keyof T}
    />
  );
}