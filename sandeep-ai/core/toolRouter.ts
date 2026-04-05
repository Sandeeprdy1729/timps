import { createModel } from '../models';
import { config } from '../config/env';

export interface ToolRoute {
  tool_name: string;
  operation: string;
  reason: string;
  priority: 'immediate' | 'background';
  params_hint: Record<string, any>;
}

export interface RouterResult {
  routes: ToolRoute[];
  needs_planning: boolean;
  complexity: 'simple' | 'moderate' | 'complex';
}

export interface VersionSelection {
  tier?: 'raw' | 'episodic' | 'semantic';
  branch?: string;
  versionId?: string;
  intent: 'latest' | 'lineage' | 'merge' | 'specific';
}

// Fast keyword map — zero LLM cost for obvious triggers
const KEYWORD_ROUTES: Array<{ patterns: RegExp[]; route: Omit<ToolRoute, 'reason'> }> = [
  {
    patterns: [/\bi think\b|\bi believe\b|\bshould\b|\bmust\b|\balways\b|\bnever\b|\beveryone\b|\bno one\b/i],
    route: { tool_name: 'argument_dna_mapper', operation: 'check', priority: 'immediate', params_hint: {} },
  },
  {
    patterns: [/\bmeeting\b|\bsync\b|\bstandup\b|\bcall with\b|\bdiscussed with\b|\bagreed to\b|\bcommitted\b/i],
    route: { tool_name: 'meeting_ghost', operation: 'extract_commitments', priority: 'immediate', params_hint: {} },
  },
  {
    patterns: [/\bburnout\b|\bexhausted\b|\boverwhelmed\b|\bstressed\b|\btired of\b|\bdrained\b|\bno energy\b/i],
    route: { tool_name: 'burnout_seismograph', operation: 'analyze', priority: 'immediate', params_hint: {} },
  },
  {
    patterns: [/\bi regret\b|\bi shouldn't have\b|\bbig mistake\b|\bwrong decision\b|\bshould have\b/i],
    route: { tool_name: 'regret_oracle', operation: 'log', priority: 'immediate', params_hint: {} },
  },
  {
    patterns: [/\bshould i\b|\bwhat if i\b|\bthinking of\b|\bconsidering\b|\bdeciding\b|\bshould we\b/i],
    route: { tool_name: 'regret_oracle', operation: 'check', priority: 'immediate', params_hint: {} },
  },
  {
    patterns: [/\bapi\b|\bendpoint\b|\bwebhook\b|\bsdk\b|\bstrange behavior\b|\bundocumented\b|\bquirk\b/i],
    route: { tool_name: 'api_archaeologist', operation: 'lookup', priority: 'immediate', params_hint: {} },
  },
  {
    patterns: [/\bbug\b|\bcrash\b|\berror\b|\brace condition\b|\bnull pointer\b|\bdeadlock\b|\bfailed test\b/i],
    route: { tool_name: 'bug_pattern_prophet', operation: 'warn', priority: 'immediate', params_hint: {} },
  },
  {
    patterns: [/\btechnical debt\b|\brefactor\b|\blegacy\b|\bthis code\b|\bwriting a\b|\bimplementing\b/i],
    route: { tool_name: 'tech_debt_seismograph', operation: 'check_pattern', priority: 'immediate', params_hint: {} },
  },
  {
    patterns: [/\bhow do i learn\b|\blearn\b.*\bin \d+ weeks\b|\bmaster\b|\bcurriculum\b|\bstudy plan\b/i],
    route: { tool_name: 'curriculum_architect', operation: 'build_curriculum', priority: 'immediate', params_hint: {} },
  },
  {
    patterns: [/\bstuck\b|\bcan't figure\b|\bnot sure how\b|\badvice\b|\bwhat should i do\b|\bhow should i approach\b/i],
    route: { tool_name: 'skill_shadow', operation: 'coach', priority: 'immediate', params_hint: {} },
  },
  {
    patterns: [/\bwhat will happen\b|\bfuture\b|\blong.?term\b|\bwhere will\b|\btrajectory\b|\bif i keep\b/i],
    route: { tool_name: 'dead_reckoning', operation: 'simulate', priority: 'immediate', params_hint: {} },
  },
  {
    patterns: [/\bwork with\b|\bteam up\b|\bhire\b|\bhiring\b|\bwork together\b|\bpartner with\b|\bcompatib\b/i],
    route: { tool_name: 'chemistry_engine', operation: 'analyze_pair', priority: 'background', params_hint: {} },
  },
  {
    patterns: [/\b(haven't talked|haven't heard|been a while|drifting|ghosting|miss)\b.*\b(from|with|to)\b/i],
    route: { tool_name: 'relationship_intelligence', operation: 'drift_alerts', priority: 'immediate', params_hint: {} },
  },
  {
    patterns: [/\bwhat do i value\b|\bwhat kind of person\b|\bwho am i\b|\bmy values\b|\bmy character\b/i],
    route: { tool_name: 'living_manifesto', operation: 'read', priority: 'immediate', params_hint: {} },
  },
  {
    patterns: [/\bwhy did\b|\bwho decided\b|\bhistory of\b|\boriginal reason\b|\bwhy was this\b|\bwhy did we\b/i],
    route: { tool_name: 'codebase_anthropologist', operation: 'query', priority: 'immediate', params_hint: {} },
  },
  {
    patterns: [/\bcurate\b|\btier\b|\bhierarch\b|\bcuration\b|\borganize memor\b|\bmemory tier\b|\bmemory hierarchy\b/i],
    route: { tool_name: 'curate_tier', operation: 'curate', priority: 'background', params_hint: {} },
  },
];

export class ToolRouter {
  // Fast path: keyword matching, zero LLM calls
  routeByKeywords(message: string): ToolRoute[] {
    const routes: ToolRoute[] = [];
    const seen = new Set<string>();

    for (const { patterns, route } of KEYWORD_ROUTES) {
      if (patterns.some(p => p.test(message))) {
        const key = `${route.tool_name}:${route.operation}`;
        if (!seen.has(key)) {
          seen.add(key);
          routes.push({ ...route, reason: `Keyword trigger in: "${message.slice(0, 60)}"` });
        }
      }
    }

    return routes;
  }

  // Slow path: LLM-based routing for ambiguous messages (used sparingly)
  async routeByLLM(message: string, userId: number): Promise<RouterResult> {
    const fast = this.routeByKeywords(message);

    // If keywords already found clear routes, skip LLM
    if (fast.length >= 1 && fast.some(r => r.priority === 'immediate')) {
      return {
        routes: fast,
        needs_planning: fast.length >= 3,
        complexity: fast.length >= 3 ? 'complex' : fast.length >= 2 ? 'moderate' : 'simple',
      };
    }

    // Only call LLM for routing if message is substantive (>15 words)
    const wordCount = message.split(/\s+/).length;
    if (wordCount < 15) {
      return { routes: fast, needs_planning: false, complexity: 'simple' };
    }

    try {
      const model = createModel(config.models.defaultProvider as any);
      const prompt = `You are a tool router for TIMPs. Analyze this message and return JSON listing which tools should activate.

Available tools (use EXACT names):
- temporal_mirror (behavioral patterns)
- regret_oracle (decision regret warnings)
- living_manifesto (value derivation)
- burnout_seismograph (burnout detection)
- argument_dna_mapper (contradiction detection)
- dead_reckoning (future simulation)
- skill_shadow (workflow coaching)
- curriculum_architect (learning plans)
- tech_debt_seismograph (code debt warnings)
- bug_pattern_prophet (bug pattern warnings)
- api_archaeologist (API quirk knowledge)
- codebase_anthropologist (codebase culture)
- institutional_memory (org knowledge)
- chemistry_engine (people compatibility)
- meeting_ghost (meeting commitments)
- collective_wisdom (crowd wisdom)
- relationship_intelligence (relationship health)
- curate_tier (hierarchical memory curation)

Message: "${message}"

Return ONLY JSON: {"routes":[{"tool_name":"...","operation":"...","priority":"immediate|background","reason":"...","params_hint":{}}],"needs_planning":bool,"complexity":"simple|moderate|complex"}
If no tools needed return: {"routes":[],"needs_planning":false,"complexity":"simple"}`;

      const res = await model.generate([{ role: 'user', content: prompt }], { max_tokens: 400 });
      const parsed = JSON.parse(res.content.replace(/```json|```/g, '').trim()) as RouterResult;

      // Merge with keyword routes, deduplicate
      const seen = new Set(fast.map(r => `${r.tool_name}:${r.operation}`));
      const merged = [...fast];
      for (const r of (parsed.routes || [])) {
        const key = `${r.tool_name}:${r.operation}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(r);
        }
      }

      return {
        routes: merged,
        needs_planning: parsed.needs_planning || merged.length >= 3,
        complexity: parsed.complexity || 'simple',
      };
    } catch {
      return { routes: fast, needs_planning: false, complexity: 'simple' };
    }
  }

  // Build a focused tool list for the model — only relevant tools, not all 20
  filterToolDefinitions(
    allTools: any[],
    routes: ToolRoute[]
  ): any[] {
    if (routes.length === 0) {
      // Return only the 3 base tools if no routes fired
      return allTools.filter(t => ['file_operations', 'web_search', 'web_fetch'].includes(t.function.name));
    }

    const activatedNames = new Set([
      'file_operations', 'web_search', 'web_fetch',
      ...routes.map(r => r.tool_name),
    ]);

    return allTools.filter(t => activatedNames.has(t.function.name));
  }

  // Build a routing hint for the system prompt
  buildRoutingHint(routes: ToolRoute[], userId: number): string {
    if (routes.length === 0) return '';

    const hints = routes
      .filter(r => r.priority === 'immediate')
      .map(r => `- CALL ${r.tool_name}(operation="${r.operation}", user_id=${userId}) NOW — ${r.reason}`)
      .join('\n');

    return hints ? `\n\n### ACTIVE TOOL DIRECTIVES (execute these)\n${hints}` : '';
  }

  // ForgeLink: detect whether a message has a specific intent for typed traversal
  detectQueryIntent(message: string): string | null {
    const intentPatterns: Array<{ pattern: RegExp; intent: string }> = [
      { pattern: /\b(how did .* affect|impact of|caused by|led to)\b/i, intent: 'coding_impact' },
      { pattern: /\b(burnout|stress|energy|workload)\b/i, intent: 'burnout_risk' },
      { pattern: /\b(decision|chose|why did (i|we)|history of)\b/i, intent: 'decision_history' },
      { pattern: /\b(skill|growth|improve|evolution|trajectory)\b/i, intent: 'skill_evolution' },
      { pattern: /\b(relationship|team|drift|colleague)\b/i, intent: 'relationship' },
      { pattern: /\b(branch|merge|version|latest semantic|provenance)\b/i, intent: 'provenance_forge' },
    ];

    for (const { pattern, intent } of intentPatterns) {
      if (pattern.test(message)) return intent;
    }
    return null;
  }

  /**
   * Detect version/tier selection intent from message.
   * Enables routing to specific ProvenForge tiers/branches.
   */
  detectVersionIntent(message: string): VersionSelection {
    const lower = message.toLowerCase();
    
    if (/\bmerge\b.*\bbranch\b|\bbranch\b.*\bmerge\b/i.test(lower)) {
      const branchMatch = lower.match(/branch[:\s]+(\w+)/i);
      return { intent: 'merge', branch: branchMatch?.[1] };
    }
    
    if (/\blatest\b.*\bsemantic\b|\bsemantic\b.*\blatest\b/i.test(lower)) {
      return { intent: 'latest', tier: 'semantic' };
    }
    
    if (/\blatest\b.*\bepisodic\b|\bepisodic\b.*\blatest\b/i.test(lower)) {
      return { intent: 'latest', tier: 'episodic' };
    }
    
    if (/\bversion\s+[a-f0-9-]{8,}/i.test(lower) || /\bcommit\s+[a-f0-9-]{8,}/i.test(lower)) {
      const vidMatch = lower.match(/([a-f0-9-]{36}|[a-f0-9]{8,})/i);
      return { intent: 'specific', versionId: vidMatch?.[1] };
    }
    
    if (/\bbranch\s+(\w+)/i.test(lower)) {
      const branchMatch = lower.match(/branch\s+(\w+)/i);
      return { intent: 'latest', branch: branchMatch?.[1] };
    }
    
    if (/\b(lineage|history|ancestor|parent)\b/i.test(lower)) {
      return { intent: 'lineage' };
    }
    
    if (/\b(semantic|episodic|raw)\s+tier\b/i.test(lower)) {
      const tierMatch = lower.match(/(semantic|episodic|raw)/i);
      return { intent: 'latest', tier: tierMatch?.[1] as any };
    }
    
    return { intent: 'latest' };
  }

  /**
   * Build version-aware routing hint for the system prompt.
   */
  buildVersionHint(selection: VersionSelection): string {
    const parts: string[] = ['[ProvenForge]'];
    
    if (selection.branch) {
      parts.push(`Branch: ${selection.branch}`);
    }
    if (selection.tier) {
      parts.push(`Tier: ${selection.tier}`);
    }
    if (selection.versionId) {
      parts.push(`Version: ${selection.versionId.slice(0, 8)}`);
    }
    parts.push(`Intent: ${selection.intent}`);
    
    return parts.join(' | ');
  }
}

export const toolRouter = new ToolRouter();