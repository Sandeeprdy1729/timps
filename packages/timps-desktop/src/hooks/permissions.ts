/**
 * TIMPS Desktop - Permission system
 * Feature gating and permissions.
 */

import { useState, useEffect, useCallback } from 'react';

export type Permission = 
  | 'memory.read'
  | 'memory.write'
  | 'memory.delete'
  | 'chat.use'
  | 'settings.edit'
  | 'export.data'
  | 'import.data';

interface PermissionState {
  granted: boolean;
  reason?: string;
}

interface UserPermissions {
  [key: string]: PermissionState;
}

const PERMISSIONS: Permission[] = [
  'memory.read',
  'memory.write',
  'memory.delete',
  'chat.use',
  'settings.edit',
  'export.data',
  'import.data',
];

export const DEFAULT_PERMISSIONS: UserPermissions = PERMISSIONS.reduce(
  (acc, p) => ({ ...acc, [p]: { granted: true } }),
  {}
);

export function usePermission(permission: Permission) {
  const [state, setState] = useState<PermissionState>(() => 
    DEFAULT_PERMISSIONS[permission] || { granted: false }
  );

  const request = useCallback(async () => {
    // In a real app, this would request from the user
    setState({ granted: true });
  }, []);

  const revoke = useCallback(() => {
    setState({ granted: false, reason: 'Revoked by user' });
  }, []);

  return { ...state, request, revoke };
}

export function usePermissions(permissions: Permission[]) {
  const [states, setStates] = useState<Record<string, PermissionState>>(() => {
    const initial: Record<string, PermissionState> = {};
    for (const p of permissions) {
      initial[p] = DEFAULT_PERMISSIONS[p] || { granted: false };
    }
    return initial;
  });

  const grantAll = useCallback(() => {
    const updated: Record<string, PermissionState> = {};
    for (const p of permissions) {
      updated[p] = { granted: true };
    }
    setStates(updated);
  }, [permissions]);

  const revokeAll = useCallback(() => {
    const updated: Record<string, PermissionState> = {};
    for (const p of permissions) {
      updated[p] = { granted: false };
    }
    setStates(updated);
  }, [permissions]);

  return { states, grantAll, revokeAll };
}

export function hasPermission(states: UserPermissions, permission: Permission): boolean {
  return states[permission]?.granted || false;
}

export function checkPermissions(
  states: UserPermissions,
  required: Permission[]
): { allowed: boolean; missing: Permission[] } {
  const missing = required.filter(p => !hasPermission(states, p));
  return { allowed: missing.length === 0, missing };
}