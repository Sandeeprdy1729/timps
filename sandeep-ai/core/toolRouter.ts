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
    patterns: [/\bpredict\b|\bforecast\b|\btrajectory\b|\bripple\b|\bechoforge\b|\bwhat.if\b|\banticipate\b|\bproactive\b/i],
    route: { tool_name: 'echoforge_engine', operation: 'predictions', priority: 'immediate', params_hint: {} },
  },
  {
    patterns: [/\bconsolidate\b.*\bmemor/i],
    route: { tool_name: 'echoforge_engine', operation: 'consolidate', priority: 'background', params_hint: {} },
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
- echoforge_engine (predictive memory, temporal DAG, ripple simulation)

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
}

export const toolRouter = new ToolRouter();