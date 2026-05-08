import React, { forwardRef, useState, useCallback, useEffect, useRef, ReactNode, CSSProperties } from 'react';
import './Grid.css';

export interface GridProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  columns?: number | string;
  gap?: string | number;
  rows?: string;
  templateColumns?: string;
  templateRows?: string;
  area?: string;
}

export const Grid = forwardRef<HTMLDivElement, GridProps>(({
  children,
  className = '',
  style,
  columns,
  gap,
  rows,
  templateColumns,
  templateRows,
  area,
}, ref) => {
  const gridStyle: CSSProperties = {
    ...style,
    gridTemplateColumns: columns ? (typeof columns === 'number' ? `repeat(${columns}, 1fr)` : columns) : templateColumns,
    gridTemplateRows: rows || templateRows,
    gap: gap as any,
    gridArea: area,
  };

  return (
    <div ref={ref} className={`grid ${className}`} style={gridStyle}>
      {children}
    </div>
  );
});

Grid.displayName = 'Grid';

export interface GridItemProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  column?: string;
  row?: string;
  area?: string;
  columnStart?: number;
  columnEnd?: number;
  rowStart?: number;
  rowEnd?: number;
}

export const GridItem = forwardRef<HTMLDivElement, GridItemProps>(({
  children,
  className = '',
  style,
  column,
  row,
  area,
  columnStart,
  columnEnd,
  rowStart,
  rowEnd,
}, ref) => {
  const [gridColumn, setGridColumn] = useState(column);
  const [gridRow, setGridRow] = useState(row);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      if (!column) setGridColumn(`span ${columnStart && columnEnd ? columnEnd - columnStart + 1 : 1}`);
      if (!row) setGridRow(`span ${rowStart && rowEnd ? rowEnd - rowStart + 1 : 1}`);
    }
  }, [column, row, columnStart, columnEnd, rowStart, rowEnd]);

  const gridStyle: CSSProperties = {
    ...style,
    gridColumn: column || (columnStart && columnEnd ? `${columnStart} / ${columnEnd + 1}` : gridColumn),
    gridRow: row || (rowStart && rowEnd ? `${rowStart} / ${rowEnd + 1}` : gridRow),
    gridArea: area,
  };

  return (
    <div ref={ref} className={`grid-item ${className}`} style={gridStyle}>
      {children}
    </div>
  );
});

GridItem.displayName = 'GridItem';

export interface ResponsiveGridProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  breakpoints?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  minColumnWidth?: number;
  maxColumns?: number;
}

export const ResponsiveGrid = forwardRef<HTMLDivElement, ResponsiveGridProps>(({
  children,
  className = '',
  style,
  breakpoints = { mobile: 480, tablet: 768, desktop: 1024 },
  minColumnWidth = 250,
  maxColumns = 4,
}, ref) => {
  const [columnCount, setColumnCount] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const updateColumns = useCallback(() => {
    const width = containerRef.current?.clientWidth || window.innerWidth;
    if (width >= breakpoints.desktop!) {
      setColumnCount(Math.min(maxColumns!, 4));
    } else if (width >= breakpoints.tablet!) {
      setColumnCount(Math.min(maxColumns! - 1, 3));
    } else if (width >= breakpoints.mobile!) {
      setColumnCount(2);
    } else {
      setColumnCount(1);
    }
  }, [breakpoints, maxColumns]);

  useEffect(() => {
    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, [updateColumns]);

  const computedStyle: CSSProperties = {
    ...style,
    gridTemplateColumns: `repeat(${columnCount}, minmax(${minColumnWidth}px, 1fr))`,
  };

  return (
    <div ref={(node) => {
      containerRef.current = node;
      if (typeof ref === 'function') ref(node);
    }} className={`responsive-grid ${className}`} style={computedStyle}>
      {children}
    </div>
  );
});

ResponsiveGrid.displayName = 'ResponsiveGrid';

export interface MasonryGridProps {
  items: Array<{ key: string; content: ReactNode }>;
  className?: string;
  style?: CSSProperties;
  columnCount?: number;
  gap?: number;
}

export const MasonryGrid: React.FC<MasonryGridProps> = ({
  items,
  className = '',
  style,
  columnCount = 3,
  gap = 16,
}) => {
  const [columns, setColumns] = useState<Array<Array<{ key: string; content: ReactNode }>>(
    Array.from({ length: columnCount }, () => [])
  );

  useEffect(() => {
    const distribution = Array.from({ length: columnCount }, () => [] as Array<{ key: string; content: ReactNode }>);
    const heights = new Array(columnCount).fill(0);

    items.forEach((item, index) => {
      const shortestColumn = heights.indexOf(Math.min(...heights));
      distribution[shortestColumn].push(item);
      heights[shortestColumn] += 1;
    });

    setColumns(distribution);
  }, [items, columnCount]);

  return (
    <div className={`masonry-grid ${className}`} style={style}>
      {columns.map((column, colIndex) => (
        <div key={colIndex} className="masonry-column" style={{ gap }}>
          {column.map((item) => (
            <div key={item.key} className="masonry-item">
              {item.content}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

MasonryGrid.displayName = 'MasonryGrid';

export default Grid;