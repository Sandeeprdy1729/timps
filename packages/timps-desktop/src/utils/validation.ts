/**
 * TIMPS Desktop - Form validation
 * Form validation utilities.
 */

import { REGEX } from '../constants/index';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export type Validator = (value: string) => ValidationResult;

export const validators = {
  required: (message = 'This field is required'): Validator => (value) => ({
    valid: value.trim().length > 0,
    error: message,
  }),

  minLength: (min: number, message?: string): Validator => (value) => ({
    valid: value.length >= min,
    error: message || `Minimum ${min} characters required`,
  }),

  maxLength: (max: number, message?: string): Validator => (value) => ({
    valid: value.length <= max,
    error: message || `Maximum ${max} characters allowed`,
  }),

  email: (message = 'Invalid email address'): Validator => (value) => ({
    valid: REGEX.email.test(value),
    error: message,
  }),

  url: (message = 'Invalid URL'): Validator => (value) => ({
    valid: REGEX.url.test(value),
    error: message,
  }),

  pattern: (regex: RegExp, message = 'Invalid format'): Validator => (value) => ({
    valid: regex.test(value),
    error: message,
  }),

  match: (other: string, message = 'Values do not match'): Validator => (value, values) => ({
    valid: value === (values as Record<string, string>)[other],
    error: message,
  }),

  numeric: (message = 'Must be a number'): Validator => (value) => ({
    valid: !isNaN(Number(value)),
    error: message,
  }),

  positive: (message = 'Must be a positive number'): Validator => (value) => ({
    valid: Number(value) > 0,
    error: message,
  }),

  integer: (message = 'Must be a whole number'): Validator => (value) => ({
    valid: Number.isInteger(Number(value)),
    error: message,
  }),
};

export function createFormValidator(...validatorFns: Validator[]): Validator {
  return (value, values) => {
    for (const validator of validatorFns) {
      const result = validator(value, values);
      if (!result.valid) return result;
    }
    return { valid: true };
  };
}

export function validateForm(
  fields: Record<string, string>,
  rules: Record<string, Validator[]>
): Record<string, ValidationResult> {
  const errors: Record<string, ValidationResult> = {};
  
  for (const [name, validatorFns] of Object.entries(rules)) {
    const value = fields[name] || '';
    for (const validator of validatorFns) {
      const result = validator(value, fields);
      if (!result.valid) {
        errors[name] = result;
        break;
      }
    }
  }
  
  return errors;
}

export function hasErrors(errors: Record<string, ValidationResult>): boolean {
  return Object.keys(errors).length > 0;
}

export function getFirstError(errors: Record<string, ValidationResult>): string | undefined {
  const first = Object.values(errors)[0];
  return first?.error;
}