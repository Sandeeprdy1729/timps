// TIMPS Code — Trusted Device Module
// Device enrollment and trusted device token management

import { platform, hostname } from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';

const TRUSTED_DEVICE_CONFIG_PATH = path.join(process.env.HOME || '', '.timps', 'trusted_device.json');

export interface TrustedDeviceData {
  deviceToken?: string;
  deviceId?: string;
  enrolledAt?: number;
}

export function getTrustedDeviceToken(): string | undefined {
  try {
    const envToken = process.env.TIMPS_TRUSTED_DEVICE_TOKEN;
    if (envToken) return envToken;

    if (!fs.existsSync(TRUSTED_DEVICE_CONFIG_PATH)) return undefined;
    const data = JSON.parse(fs.readFileSync(TRUSTED_DEVICE_CONFIG_PATH, 'utf-8'));
    return data?.deviceToken;
  } catch {
    return undefined;
  }
}

export function clearTrustedDeviceToken(): void {
  try {
    if (fs.existsSync(TRUSTED_DEVICE_CONFIG_PATH)) {
      fs.unlinkSync(TRUSTED_DEVICE_CONFIG_PATH);
    }
  } catch {
    // Best-effort
  }
}

export async function enrollTrustedDevice(
  baseUrl: string,
  accessToken: string,
): Promise<{ deviceToken?: string; deviceId?: string } | null> {
  try {
    const response = await fetch(`${baseUrl}/api/auth/trusted_devices`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        display_name: `TIMPS on ${hostname()} · ${platform()}`,
      }),
    });

    if (!response.ok) {
      console.error(`[trusted-device] Enrollment failed: ${response.status}`);
      return null;
    }

    const data = await response.json() as { device_token?: string; device_id?: string };
    
    if (data.device_token) {
      const dir = path.dirname(TRUSTED_DEVICE_CONFIG_PATH);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        TRUSTED_DEVICE_CONFIG_PATH,
        JSON.stringify({
          deviceToken: data.device_token,
          deviceId: data.device_id,
          enrolledAt: Date.now(),
        }, null, 2),
      );
    }

    return { deviceToken: data.device_token, deviceId: data.device_id };
  } catch (err) {
    console.error('[trusted-device] Enrollment error:', err);
    return null;
  }
}

export function isTrustedDeviceEnabled(): boolean {
  return process.env.TIMPS_TRUSTED_DEVICE_ENABLED !== 'false';
}