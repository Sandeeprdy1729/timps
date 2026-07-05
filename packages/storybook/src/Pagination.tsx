import React, { useState } from 'react';

export interface PaginationProps {
  total: number;
  current?: number;
  pageSize?: number;
  onChange?: (page: number) => void;
  mode?: 'simple' | 'button' | 'prevNext' | 'pager';
  showTotal?: boolean;
  size?: 'small' | 'large';
  disabled?: boolean;
  showJump?: boolean;
  pageSizeOptions?: number[];
}

export const Pagination: React.FC<PaginationProps> = ({
  total, current: externalCurrent, pageSize = 10, onChange, mode, showTotal, size, disabled, showJump, pageSizeOptions,
}) => {
  const [internalCurrent, setInternalCurrent] = useState(1);
  const current = externalCurrent ?? internalCurrent;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const goTo = (p: number) => {
    if (p < 1 || p > totalPages || disabled) return;
    setInternalCurrent(p);
    onChange?.(p);
  };

  const btnStyle: React.CSSProperties = {
    padding: size === 'small' ? '2px 8px' : size === 'large' ? '8px 16px' : '4px 12px',
    border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 14, opacity: disabled ? 0.5 : 1,
  };
  const activeStyle: React.CSSProperties = { ...btnStyle, background: '#4f46e5', color: '#fff', border: 'none' };

  if (mode === 'simple') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button disabled={current <= 1 || disabled} onClick={() => goTo(current - 1)} style={btnStyle}>←</button>
        <span style={{ fontSize: 14 }}>{current} / {totalPages}</span>
        <button disabled={current >= totalPages || disabled} onClick={() => goTo(current + 1)} style={btnStyle}>→</button>
      </div>
    );
  }

  if (mode === 'button') {
    return (
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
          <button key={p} onClick={() => goTo(p)} style={p === current ? activeStyle : btnStyle}>{p}</button>
        ))}
      </div>
    );
  }

  if (mode === 'prevNext') {
    return (
      <div style={{ display: 'flex', gap: 4 }}>
        <button disabled={current <= 1 || disabled} onClick={() => goTo(current - 1)} style={btnStyle}>Previous</button>
        <button disabled={current >= totalPages || disabled} onClick={() => goTo(current + 1)} style={btnStyle}>Next</button>
      </div>
    );
  }

  if (mode === 'pager') {
    const pages: (number | string)[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= current - 1 && i <= current + 1)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }
    return (
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <button disabled={current <= 1 || disabled} onClick={() => goTo(current - 1)} style={btnStyle}>‹</button>
        {pages.map((p, i) =>
          typeof p === 'string' ? <span key={`dots-${i}`} style={{ padding: '0 4px', fontSize: 14 }}>...</span> :
            <button key={p} onClick={() => goTo(p)} style={p === current ? activeStyle : btnStyle}>{p}</button>
        )}
        <button disabled={current >= totalPages || disabled} onClick={() => goTo(current + 1)} style={btnStyle}>›</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {showTotal && <span style={{ fontSize: 14, marginRight: 8, color: '#6b7280' }}>Total {total} items</span>}
      <button disabled={current <= 1 || disabled} onClick={() => goTo(current - 1)} style={btnStyle}>‹</button>
      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
        let p = current <= 3 ? i + 1 : Math.min(totalPages, current + i - 2);
        if (p < 1) p = 1;
        return <button key={p} onClick={() => goTo(p)} style={p === current ? activeStyle : btnStyle}>{p}</button>;
      })}
      <button disabled={current >= totalPages || disabled} onClick={() => goTo(current + 1)} style={btnStyle}>›</button>
      {showJump && (
        <span style={{ fontSize: 14, marginLeft: 8 }}>
          Go to: <input type="number" min={1} max={totalPages} style={{ width: 50, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 14 }} onKeyDown={e => { if (e.key === 'Enter') goTo(Number((e.target as HTMLInputElement).value)); }} />
        </span>
      )}
    </div>
  );
};
