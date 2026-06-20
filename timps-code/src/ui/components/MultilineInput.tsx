import React, { useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';

interface MultilineInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
}

export const MultilineInput = ({ value, onChange, onSubmit, placeholder }: MultilineInputProps) => {
  const cursorRef = useRef(value.length);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    cursorRef.current = value.length;
  }, [value]);

  useInput((input, key) => {
    if (key.return && !key.shift) {
      if (valueRef.current.trim()) {
        onSubmit(valueRef.current);
      }
      return;
    }

    if (key.return && key.shift) {
      const pos = cursorRef.current;
      const newVal = valueRef.current.slice(0, pos) + '\n' + valueRef.current.slice(pos);
      onChange(newVal);
      cursorRef.current = pos + 1;
      return;
    }

    if (key.backspace || key.delete) {
      const pos = cursorRef.current;
      if (pos > 0) {
        const newVal = valueRef.current.slice(0, pos - 1) + valueRef.current.slice(pos);
        onChange(newVal);
        cursorRef.current = pos - 1;
      }
      return;
    }

    if (key.leftArrow && cursorRef.current > 0) {
      cursorRef.current--;
      return;
    }

    if (key.rightArrow && cursorRef.current < valueRef.current.length) {
      cursorRef.current++;
      return;
    }

    if (key.upArrow || key.downArrow || key.pageUp || key.pageDown || key.escape) {
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      const pos = cursorRef.current;
      const newVal = valueRef.current.slice(0, pos) + input + valueRef.current.slice(pos);
      onChange(newVal);
      cursorRef.current = pos + input.length;
    }
  });

  const lines = value.split('\n');

  return (
    <Box flexDirection="column" flexGrow={1}>
      {lines.map((line, i) => (
        <Text key={i}>
          {line || (i === lines.length - 1 && !value ? <Text dimColor>{placeholder}</Text> : ' ')}
        </Text>
      ))}
    </Box>
  );
};
