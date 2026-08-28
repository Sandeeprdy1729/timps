export function resolveDependencies(
  deps: Record<string, string> | undefined,
  available: Map<string, string[]>
): { flat: Map<string, string>; conflicts: string[] } {
  const flat = new Map<string, string>();
  const conflicts: string[] = [];

  if (!deps) return { flat, conflicts };

  function resolve(name: string, constraint: string, chain: string[]): void {
    const versions = available.get(name);
    if (!versions || versions.length === 0) {
      conflicts.push(`Dependency not found: ${name}`);
      return;
    }

    const best = semverMaxSatisfying(versions, constraint);
    if (!best) {
      conflicts.push(`No version of ${name} satisfies ${constraint} (available: ${versions.join(', ')})`);
      return;
    }

    const existing = flat.get(name);
    if (existing) {
      if (existing !== best) {
        conflicts.push(`Version conflict: ${name} requires ${best} but ${existing} is already resolved`);
      }
      return;
    }

    flat.set(name, best);

    const depDeps = pluginDependencies.get(name)?.[best];
    if (depDeps) {
      for (const [subName, subConstraint] of Object.entries(depDeps)) {
        resolve(subName, subConstraint, [...chain, name]);
      }
    }
  }

  for (const [name, constraint] of Object.entries(deps)) {
    resolve(name, constraint, []);
  }

  return { flat, conflicts };
}

function semverMaxSatisfying(versions: string[], constraint: string): string | null {
  const cleaned = constraint.replace(/^[\^~]/, '');
  const [major, minor, patch] = cleaned.split('.').map(Number);

  return versions
    .filter(v => satisfies(v, constraint))
    .sort(semverCompare)
    .pop() ?? null;
}

function satisfies(version: string, constraint: string): boolean {
  if (constraint === '*' || constraint === 'x') return true;
  const vParts = version.split('.').map(Number);
  const cParts = constraint.replace(/^[\^~>=< ]+/, '').split('.').map(Number);

  if (constraint.startsWith('^')) {
    return vParts[0] === cParts[0];
  }
  if (constraint.startsWith('~')) {
    return vParts[0] === cParts[0] && vParts[1] === (cParts[1] ?? 0);
  }
  for (let i = 0; i < Math.max(vParts.length, cParts.length); i++) {
    const v = vParts[i] ?? 0;
    const c = cParts[i] ?? 0;
    if (v !== c) return false;
  }
  return true;
}

function semverCompare(a: string, b: string): number {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (aParts[i] ?? 0) - (bParts[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

const pluginDependencies = new Map<string, Record<string, Record<string, string>>>();
