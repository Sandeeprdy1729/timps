import React, { useState, useEffect, useCallback, CSSProperties } from 'react';
import './DragDrop.css';

export interface DragDropZoneProps {
  accept?: string[];
  maxSize?: number;
  multiple?: boolean;
  onFilesDrop?: (files: File[]) => void;
  onError?: (error: string) => void;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  activeClassName?: string;
}

export const DragDropZone: React.FC<DragDropZoneProps> = ({
  accept,
  maxSize,
  multiple = true,
  onFilesDrop,
  onError,
  className = '',
  style,
  disabled = false,
  activeClassName = '',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const validateFiles = useCallback((files: File[]): File[] => {
    const validFiles: File[] = [];
    const newErrors: string[] = [];

    for (const file of files) {
      if (accept && accept.length > 0) {
        const ext = '.' + file.name.split('.').pop()!.toLowerCase();
        if (!accept.includes(ext) && !accept.includes(file.type)) {
          newErrors.push(`File ${file.name} has unsupported type`);
          continue;
        }
      }
      if (maxSize && file.size > maxSize) {
        newErrors.push(`File ${file.name} exceeds ${(maxSize / 1024 / 1024).toFixed(0)}MB limit`);
        continue;
      }
      validFiles.push(file);
    }

    if (newErrors.length > 0) {
      setErrors(newErrors);
      onError?.(newErrors.join(', '));
    } else {
      setErrors([]);
    }

    return validFiles;
  }, [accept, maxSize, onError]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    const validFiles = validateFiles(files);

    if (validFiles.length > 0) {
      if (!multiple && validFiles.length > 1) {
        onError?.('Only one file allowed');
        return;
      }
      onFilesDrop?.(multiple ? validFiles : [validFiles[0]]);
    }
  }, [disabled, multiple, validateFiles, onFilesDrop, onError]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = validateFiles(files);

    if (validFiles.length > 0) {
      if (!multiple && validFiles.length > 1) {
        onError?.('Only one file allowed');
        return;
      }
      onFilesDrop?.(multiple ? validFiles : [validFiles[0]]);
    }

    e.target.value = '';
  }, [multiple, validateFiles, onFilesDrop, onError]);

  return (
    <div
      className={`drag-drop-zone ${isDragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''} ${className} ${isDragging ? activeClassName : ''}`}
      style={style}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept={accept?.join(',')}
        multiple={multiple}
        onChange={handleFileInput}
        className="drag-drop-input"
        disabled={disabled}
      />
      <div className="drag-drop-content">
        <div className="drag-drop-icon">📁</div>
        <div className="drag-drop-text">Drag and drop files here</div>
        <div className="drag-drop-subtext">or click to browse</div>
        {accept && (
          <div className="drag-drop-accept">
            Accepted: {accept.join(', ')}
          </div>
        )}
        {maxSize && (
          <div className="drag-drop-size">
            Max size: {(maxSize / 1024 / 1024).toFixed(0)}MB
          </div>
        )}
      </div>
      {errors.length > 0 && (
        <div className="drag-drop-errors">
          {errors.map((err, i) => <div key={i}>{err}</div>)}
        </div>
      )}
    </div>
  );
};

export interface SortableListProps<T> {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
}

export function SortableList<T>({
  items,
  onReorder,
  renderItem,
  className = '',
}: SortableListProps<T>) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setTargetIndex(index);
    }
  }, [draggedIndex]);

  const handleDragEnd = useCallback(() => {
    if (draggedIndex !== null && targetIndex !== null && draggedIndex !== targetIndex) {
      const newItems = [...items];
      const [removed] = newItems.splice(draggedIndex, 1);
      newItems.splice(targetIndex, 0, removed);
      onReorder(newItems);
    }
    setDraggedIndex(null);
    setTargetIndex(null);
  }, [draggedIndex, targetIndex, items, onReorder]);

  return (
    <div className={`sortable-list ${className}`}>
      {items.map((item, index) => (
        <div
          key={index}
          draggable
          onDragStart={() => handleDragStart(index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragEnd={handleDragEnd}
          className={`sortable-item ${draggedIndex === index ? 'dragging' : ''} ${targetIndex === index ? 'target' : ''}`}
        >
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  );
}

export default DragDropZone;