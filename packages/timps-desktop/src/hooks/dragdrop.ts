/**
 * TIMPS Desktop - Drag and drop
 * Drag and drop utilities for the desktop app.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

interface UseDragOptions<T> {
  onDrop?: (items: T[]) => void;
  onDragOver?: (e: React.DragEvent) => void;
}

export function useDragDrop<T>(options?: UseDragOptions<T>) {
  const [isDragging, setIsDragging] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    options?.onDragOver?.(e);
  }, [options]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    options?.onDrop?.(files as unknown as T[]);
  }, [options]);

  useEffect(() => {
    const element = dropRef.current;
    if (element) {
      element.addEventListener('dragenter', handleDragEnter);
      element.addEventListener('dragleave', handleDragLeave);
      element.addEventListener('dragover', handleDragOver);
      element.addEventListener('drop', handleDrop);
      
      return () => {
        element.removeEventListener('dragenter', handleDragEnter);
        element.removeEventListener('dragleave', handleDragLeave);
        element.removeEventListener('dragover', handleDragOver);
        element.removeEventListener('drop', handleDrop);
      };
    }
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  return { isDragging, dropRef };
}

export function useDraggable<T>(data: T) {
  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify(data));
    e.dataTransfer.effectAllowed = 'move';
  }, [data]);

  return { draggable: true, onDragStart: handleDragStart };
}

export function useDroppable<T>(onDrop: (data: T) => void) {
  const [isOver, setIsOver] = useState(false);
  
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);
    const json = e.dataTransfer.getData('application/json');
    if (json) {
      const data = JSON.parse(json) as T;
      onDrop(data);
    }
  }, [onDrop]);

  return { isOver, handleDragEnter, handleDragLeave, handleDrop };
}