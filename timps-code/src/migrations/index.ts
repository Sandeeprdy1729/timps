// ── TIMPS Code — Migrations
// Database and config migrations

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'os';

export const CURRENT_MIGRATION_VERSION = 2;

export interface Migration {
  version: number;
  up: () => Promise<void>;
  down?: () => Promise<void>;
}

const migrations: Migration[] = [
  {
    version: 1,
    async up() {
      // Ensure ~/.timps directory exists
      const timpsDir = path.join(os.homedir(), '.timps');
      fs.mkdirSync(timpsDir, { recursive: true });

      // Ensure subdirectories
      const subdirs = ['memory', 'sessions', 'snapshots', 'config'];
      for (const sub of subdirs) {
        fs.mkdirSync(path.join(timpsDir, sub), { recursive: true });
      }

      // Add migration version to config
      const cfgPath = path.join(timpsDir, 'config.json');
      if (fs.existsSync(cfgPath)) {
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
        cfg.migrationVersion = 1;
        fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
      }
    },
  },
  {
    version: 2,
    async up() {
      // Ensure knowledge graph storage
      const memDir = path.join(os.homedir(), '.timps', 'memory');
      fs.mkdirSync(path.join(memDir, 'graph'), { recursive: true });
      fs.mkdirSync(path.join(memDir, 'episodes'), { recursive: true });
      fs.mkdirSync(path.join(memDir, 'procedural'), { recursive: true });

      // Add new config fields if missing
      const cfgPath = path.join(os.homedir(), '.timps', 'config.json');
      if (fs.existsSync(cfgPath)) {
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
        cfg.migrationVersion = 2;
        cfg.maxContextTokens = cfg.maxContextTokens || 200000;
        cfg.autoCorrect = cfg.autoCorrect ?? true;
        fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
      }
    },
  },
];

export async function runMigrations(): Promise<void> {
  const timpsDir = path.join(os.homedir(), '.timps');
  fs.mkdirSync(timpsDir, { recursive: true });

  const cfgPath = path.join(timpsDir, 'config.json');
  let currentVersion = 0;

  if (fs.existsSync(cfgPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      currentVersion = cfg.migrationVersion || 0;
    } catch { /* ignore */ }
  }

  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      console.log(`  ${t.dim(`Running migration v${migration.version}...`)}`);
      try {
        await migration.up();
        currentVersion = migration.version;

        // Update config version
        if (fs.existsSync(cfgPath)) {
          const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
          cfg.migrationVersion = currentVersion;
          fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
        }
      } catch (err) {
        console.error(`  ${t.error(`Migration v${migration.version} failed:`)} ${(err as Error).message}`);
        throw err;
      }
    }
  }
}

export async function rollbackMigration(targetVersion: number): Promise<void> {
  for (const migration of [...migrations].reverse()) {
    if (migration.version >= targetVersion && migration.down) {
      console.log(`  ${t.dim(`Rolling back migration v${migration.version}...`)}`);
      await migration.down();
    }
  }
}

// Import t for console output
import { t } from '../config/theme.js';
