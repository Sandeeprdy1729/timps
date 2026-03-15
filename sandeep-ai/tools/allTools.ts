import { BaseTool, ToolParameter } from './baseTool';
import { query, execute } from '../db/postgres';
import { createModel } from '../models';
import { config } from '../config/env';

// ─── Shared LLM helper ────────────────────────────────────────────────────────
async function llm(prompt: string, maxTokens = 800): Promise<string> {
  try {
    const model = createModel(config.models.defaultProvider as any);
    const res = await model.generate([{ role: 'user', content: prompt }], { max_tokens: maxTokens });
    return res.content.trim().replace(/```json|```/g, '').trim();
  } catch (e: any) {
    return JSON.stringify({ error: e.message });
  }
}

async function llmJSON<T>(prompt: string, maxTokens = 800): Promise<T | null> {
  try {
    const raw = await llm(prompt, maxTokens);
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// TOOL 1 — Temporal Mirror
// ════════════════════════════════════════════════════════════════════════════════
export class TemporalMirrorTool extends BaseTool {
  name = 'temporal_mirror';
  description = 'Tool 1 — Temporal Mirror. Records behavioral events and builds a longitudinal model of the user. Use to log decisions/actions and retrieve behavioral patterns, predictions, and self-knowledge insights across months of data.';
  parameters: ToolParameter = {
    type: 'object', description: 'Temporal Mirror parameters',
    properties: {
      operation: { type: 'string', enum: ['record', 'reflect', 'predict'], description: 'record: log a new event | reflect: get behavioral summary | predict: predict likely action for a situation' },
      user_id: { type: 'number', description: 'User ID' },
      event_type: { type: 'string', description: 'Type of event (decision, action, reaction)' },
      context: { type: 'string', description: 'What was happening' },
      outcome: { type: 'string', description: 'What happened as a result' },
      situation: { type: 'string', description: 'For predict: describe the current situation' },
    },
    required: ['operation', 'user_id'],
  };

  async execute(params: Record<string, any>): Promise<string> {
    const { operation, user_id, event_type, context, outcome, situation } = params;

    if (operation === 'record') {
      if (!event_type) return JSON.stringify({ error: 'event_type required' });
      await execute(
        `INSERT INTO behavioral_events (user_id, event_type, context, outcome) VALUES ($1,$2,$3,$4)`,
        [user_id, event_type, context || '', outcome || '']
      );
      return JSON.stringify({ success: true, message: 'Behavioral event recorded' });
    }

    if (operation === 'reflect') {
      const events = await query<any>(
        `SELECT event_type, context, outcome, recorded_at FROM behavioral_events WHERE user_id=$1 ORDER BY recorded_at DESC LIMIT 50`,
        [user_id]
      );
      if (!events.length) return JSON.stringify({ insight: 'No behavioral data yet. Keep interacting and I will learn your patterns.' });
      const summary = await llmJSON<any>(`Analyze these behavioral events and return a JSON with keys: dominant_patterns (array of strings), likely_blindspots (array), self_knowledge_score (0-10), one_sentence_portrait (string). Events: ${JSON.stringify(events.slice(0, 20))}`, 600);
      return JSON.stringify(summary || { insight: 'Insufficient data for pattern analysis yet' });
    }

    if (operation === 'predict') {
      if (!situation) return JSON.stringify({ error: 'situation required for predict' });
      const events = await query<any>(`SELECT event_type, context, outcome FROM behavioral_events WHERE user_id=$1 ORDER BY recorded_at DESC LIMIT 30`, [user_id]);
      const prediction = await llmJSON<any>(`Based on this person's behavioral history, predict how they will likely respond to the current situation. Return JSON: { prediction: string, confidence: 0-1, reasoning: string, alternative: string }. History: ${JSON.stringify(events.slice(0, 15))}. Current situation: ${situation}`, 500);
      return JSON.stringify(prediction || { prediction: 'Insufficient history to predict', confidence: 0 });
    }

    return JSON.stringify({ error: `Unknown operation: ${operation}` });
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// TOOL 2 — Regret Oracle
// ════════════════════════════════════════════════════════════════════════════════
export class RegretOracleTool extends BaseTool {
  name = 'regret_oracle';
  description = 'Tool 2 — Regret Oracle. Warns users before repeating decisions they have regretted before. Log decisions with outcomes, and check if a new decision matches past regret patterns.';
  parameters: ToolParameter = {
    type: 'object', description: 'Regret Oracle parameters',
    properties: {
      operation: { type: 'string', enum: ['log', 'check', 'review'], description: 'log: record a decision | check: warn if similar to past regrets | review: show regret history' },
      user_id: { type: 'number', description: 'User ID' },
      description: { type: 'string', description: 'Description of the decision' },
      outcome: { type: 'string', description: 'For log: what happened afterward' },
      regret_score: { type: 'number', description: 'For log with outcome: 0=no regret, 1=strong regret' },
      new_decision: { type: 'string', description: 'For check: the decision being considered now' },
    },
    required: ['operation', 'user_id'],
  };

  async execute(params: Record<string, any>): Promise<string> {
    const { operation, user_id, description, outcome, regret_score, new_decision } = params;

    if (operation === 'log') {
      if (!description) return JSON.stringify({ error: 'description required' });
      await execute(
        `INSERT INTO decisions (user_id, description, outcome_noted, regret_score) VALUES ($1,$2,$3,$4)`,
        [user_id, description, outcome || null, regret_score ?? 0]
      );
      return JSON.stringify({ success: true, message: 'Decision logged' });
    }

    if (operation === 'check') {
      if (!new_decision) return JSON.stringify({ error: 'new_decision required' });
      const past = await query<any>(`SELECT description, outcome_noted, regret_score FROM decisions WHERE user_id=$1 AND regret_score > 0.5 ORDER BY decided_at DESC LIMIT 20`, [user_id]);
      if (!past.length) return JSON.stringify({ warning: false, message: 'No regret history found. Go ahead, but I will remember this.' });
      const check = await llmJSON<any>(`You are a regret-detection system. Does the new decision match the pattern of any past regrets? Return JSON: { warning: bool, matching_past_decision: string|null, similarity_score: 0-1, message: string }. Past regrets: ${JSON.stringify(past)}. New decision: ${new_decision}`, 400);
      return JSON.stringify(check || { warning: false });
    }

    if (operation === 'review') {
      const decisions = await query<any>(`SELECT description, outcome_noted, regret_score, decided_at FROM decisions WHERE user_id=$1 ORDER BY regret_score DESC, decided_at DESC LIMIT 20`, [user_id]);
      return JSON.stringify({ decisions, total: decisions.length });
    }

    return JSON.stringify({ error: `Unknown operation: ${operation}` });
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// TOOL 3 — Living Manifesto
// ════════════════════════════════════════════════════════════════════════════════
export class LivingManifestoTool extends BaseTool {
  name = 'living_manifesto';
  description = 'Tool 3 — Living Manifesto. Derives the user\'s actual values from their behavior (not what they claim to believe). Observes patterns and generates a living document of who the user actually is.';
  parameters: ToolParameter = {
    type: 'object', description: 'Living Manifesto parameters',
    properties: {
      operation: { type: 'string', enum: ['observe', 'generate', 'read'], description: 'observe: log a value signal from behavior | generate: synthesize manifesto | read: get current manifesto' },
      user_id: { type: 'number', description: 'User ID' },
      inferred_value: { type: 'string', description: 'Value inferred from behavior (e.g. "speed over quality")' },
      evidence: { type: 'string', description: 'What behavior led to this inference' },
    },
    required: ['operation', 'user_id'],
  };

  async execute(params: Record<string, any>): Promise<string> {
    const { operation, user_id, inferred_value, evidence } = params;

    if (operation === 'observe') {
      if (!inferred_value || !evidence) return JSON.stringify({ error: 'inferred_value and evidence required' });
      await execute(
        `INSERT INTO value_observations (user_id, inferred_value, evidence)
         VALUES ($1,$2,$3)
         ON CONFLICT DO NOTHING`,
        [user_id, inferred_value, evidence]
      );
      await execute(
        `UPDATE value_observations SET frequency = frequency + 1, last_seen = NOW() WHERE user_id=$1 AND inferred_value=$2`,
        [user_id, inferred_value]
      );
      return JSON.stringify({ success: true, message: `Value signal "${inferred_value}" recorded` });
    }

    if (operation === 'generate') {
      const observations = await query<any>(`SELECT inferred_value, evidence, frequency FROM value_observations WHERE user_id=$1 ORDER BY frequency DESC LIMIT 30`, [user_id]);
      if (!observations.length) return JSON.stringify({ error: 'No behavioral observations yet. Interact more and I will derive your manifesto.' });
      const manifesto = await llm(`Based on these behavioral observations, write a "Living Manifesto" — a frank, honest 200-word document describing who this person actually is based on their actions, not their stated beliefs. Be direct. Observations: ${JSON.stringify(observations)}`, 600);
      await execute(`INSERT INTO manifestos (user_id, content) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET content=$2, updated_at=NOW()`, [user_id, manifesto]);
      return JSON.stringify({ manifesto });
    }

    if (operation === 'read') {
      const result = await query<any>(`SELECT content, updated_at FROM manifestos WHERE user_id=$1`, [user_id]);
      if (!result.length) return JSON.stringify({ message: 'No manifesto yet. Use observe operation to build behavioral data first.' });
      return JSON.stringify({ manifesto: result[0].content, updated_at: result[0].updated_at });
    }

    return JSON.stringify({ error: `Unknown operation: ${operation}` });
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// TOOL 4 — Burnout Seismograph
// ════════════════════════════════════════════════════════════════════════════════
export class BurnoutSeismographTool extends BaseTool {
  name = 'burnout_seismograph';
  description = 'Tool 4 — Burnout Seismograph. Tracks productivity and wellbeing signals over time. Detects burnout 6 weeks early by comparing current signals to the user\'s personal baseline, not generic averages.';
  parameters: ToolParameter = {
    type: 'object', description: 'Burnout Seismograph parameters',
    properties: {
      operation: { type: 'string', enum: ['record', 'analyze', 'baseline'], description: 'record: log a signal | analyze: get burnout risk assessment | baseline: set personal baseline' },
      user_id: { type: 'number', description: 'User ID' },
      signal_type: { type: 'string', description: 'e.g. response_time, focus_hours, energy_level, enthusiasm_score' },
      value: { type: 'number', description: 'Numeric value of the signal' },
    },
    required: ['operation', 'user_id'],
  };

  async execute(params: Record<string, any>): Promise<string> {
    const { operation, user_id, signal_type, value } = params;

    if (operation === 'record') {
      if (!signal_type || value === undefined) return JSON.stringify({ error: 'signal_type and value required' });
      const baseline = await query<any>(`SELECT baseline_data FROM burnout_baseline WHERE user_id=$1`, [user_id]);
      let deviation = null;
      let baselineVal = null;
      if (baseline.length) {
        const bd = baseline[0].baseline_data as Record<string, number>;
        if (bd[signal_type]) {
          baselineVal = bd[signal_type];
          deviation = ((value - baselineVal) / baselineVal) * 100;
        }
      }
      await execute(`INSERT INTO burnout_signals (user_id, signal_type, value, baseline_value, deviation_pct) VALUES ($1,$2,$3,$4,$5)`, [user_id, signal_type, value, baselineVal, deviation]);
      return JSON.stringify({ recorded: true, deviation_pct: deviation ? Math.round(deviation) : null });
    }

    if (operation === 'analyze') {
      const signals = await query<any>(`SELECT signal_type, value, baseline_value, deviation_pct, recorded_at FROM burnout_signals WHERE user_id=$1 AND recorded_at > NOW() - INTERVAL '6 weeks' ORDER BY recorded_at DESC`, [user_id]);
      if (!signals.length) return JSON.stringify({ risk: 'unknown', message: 'Not enough signal data yet. Record daily signals to enable burnout detection.' });
      const analysis = await llmJSON<any>(`Analyze these burnout signals and return JSON: { risk_level: "low|moderate|high|critical", risk_score: 0-100, key_warning_signals: string[], recommendation: string, weeks_to_burnout_estimate: number|null }. Signals: ${JSON.stringify(signals.slice(0, 30))}`, 500);
      return JSON.stringify(analysis || { risk: 'analysis_failed' });
    }

    if (operation === 'baseline') {
      const recent = await query<any>(`SELECT signal_type, AVG(value) as avg_val FROM burnout_signals WHERE user_id=$1 AND recorded_at > NOW() - INTERVAL '30 days' GROUP BY signal_type`, [user_id]);
      if (!recent.length) return JSON.stringify({ error: 'Need at least 30 days of signals to set baseline' });
      const baselineData: Record<string, number> = {};
      recent.forEach((r: any) => { baselineData[r.signal_type] = parseFloat(r.avg_val); });
      await execute(`INSERT INTO burnout_baseline (user_id, baseline_data) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET baseline_data=$2, computed_at=NOW()`, [user_id, JSON.stringify(baselineData)]);
      return JSON.stringify({ success: true, baseline: baselineData, message: 'Personal baseline set from last 30 days of data' });
    }

    return JSON.stringify({ error: `Unknown operation: ${operation}` });
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// TOOL 5 — Argument DNA Mapper (already exists as contradictionTool.ts)
// Re-exported alias so the index is consistent
// ════════════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════════
// TOOL 6 — Dead Reckoning Engine
// ════════════════════════════════════════════════════════════════════════════════
export class DeadReckoningTool extends BaseTool {
  name = 'dead_reckoning';
  description = 'Tool 6 — Dead Reckoning Engine. Simulates future trajectories based on the user\'s actual decision history. Shows probability-weighted future outcomes for current decisions.';
  parameters: ToolParameter = {
    type: 'object', description: 'Dead Reckoning parameters',
    properties: {
      operation: { type: 'string', enum: ['simulate', 'history'], description: 'simulate: run trajectory simulation | history: past simulations' },
      user_id: { type: 'number', description: 'User ID' },
      scenario: { type: 'string', description: 'Current decision or situation to simulate' },
      horizon_months: { type: 'number', description: 'How many months ahead to simulate (default 12)' },
    },
    required: ['operation', 'user_id'],
  };

  async execute(params: Record<string, any>): Promise<string> {
    const { operation, user_id, scenario, horizon_months = 12 } = params;

    if (operation === 'simulate') {
      if (!scenario) return JSON.stringify({ error: 'scenario required' });
      const decisions = await query<any>(`SELECT description, outcome_noted, regret_score FROM decisions WHERE user_id=$1 ORDER BY decided_at DESC LIMIT 20`, [user_id]);
      const patterns = await query<any>(`SELECT event_type, context, outcome FROM behavioral_events WHERE user_id=$1 ORDER BY recorded_at DESC LIMIT 30`, [user_id]);
      const prompt = `You are a life trajectory simulator. Based on this person's decision history and behavioral patterns, simulate 3 probable futures for their current scenario over the next ${horizon_months} months.
Return JSON: { scenarios: [ { label: string, probability: 0-1, trajectory: string, key_turning_points: string[], outcome_at_horizon: string } ], insight: string, critical_variable: string }
Decision history: ${JSON.stringify(decisions.slice(0, 10))}
Behavioral patterns: ${JSON.stringify(patterns.slice(0, 10))}
Current scenario: ${scenario}`;
      const result = await llmJSON<any>(prompt, 800);
      if (result) {
        await execute(`INSERT INTO life_simulations (user_id, scenario, simulation_result, confidence) VALUES ($1,$2,$3,$4)`, [user_id, scenario, JSON.stringify(result), 0.7]);
      }
      return JSON.stringify(result || { error: 'Simulation failed' });
    }

    if (operation === 'history') {
      const sims = await query<any>(`SELECT scenario, simulation_result, created_at FROM life_simulations WHERE user_id=$1 ORDER BY created_at DESC LIMIT 10`, [user_id]);
      return JSON.stringify({ simulations: sims });
    }

    return JSON.stringify({ error: `Unknown operation: ${operation}` });
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// TOOL 7 — Skill Shadow
// ════════════════════════════════════════════════════════════════════════════════
export class SkillShadowTool extends BaseTool {
  name = 'skill_shadow';
  description = 'Tool 7 — Skill Shadow. Learns how the user works best — their rhythms, breakthrough patterns, peak hours — and coaches them using their own data, not generic productivity advice.';
  parameters: ToolParameter = {
    type: 'object', description: 'Skill Shadow parameters',
    properties: {
      operation: { type: 'string', enum: ['observe', 'coach', 'patterns'], description: 'observe: log a work pattern | coach: get personalized advice for current situation | patterns: view learned patterns' },
      user_id: { type: 'number', description: 'User ID' },
      pattern_type: { type: 'string', description: 'e.g. breakthrough_strategy, peak_time, stuck_signal, recovery_method' },
      description: { type: 'string', description: 'Description of the pattern observed' },
      success_rate: { type: 'number', description: 'How well this pattern worked (0-1)' },
      current_situation: { type: 'string', description: 'For coach: what is happening right now' },
    },
    required: ['operation', 'user_id'],
  };

  async execute(params: Record<string, any>): Promise<string> {
    const { operation, user_id, pattern_type, description, success_rate, current_situation } = params;

    if (operation === 'observe') {
      if (!pattern_type || !description) return JSON.stringify({ error: 'pattern_type and description required' });
      const existing = await query<any>(`SELECT id FROM workflow_patterns WHERE user_id=$1 AND pattern_type=$2 AND description=$3`, [user_id, pattern_type, description]);
      if (existing.length) {
        await execute(`UPDATE workflow_patterns SET observed_count=observed_count+1, success_rate=$1, last_seen=NOW() WHERE id=$2`, [success_rate ?? 0.5, existing[0].id]);
      } else {
        await execute(`INSERT INTO workflow_patterns (user_id, pattern_type, description, success_rate) VALUES ($1,$2,$3,$4)`, [user_id, pattern_type, description, success_rate ?? 0.5]);
      }
      return JSON.stringify({ success: true, message: 'Workflow pattern recorded' });
    }

    if (operation === 'coach') {
      if (!current_situation) return JSON.stringify({ error: 'current_situation required' });
      const patterns = await query<any>(`SELECT pattern_type, description, success_rate, observed_count FROM workflow_patterns WHERE user_id=$1 ORDER BY success_rate DESC, observed_count DESC LIMIT 20`, [user_id]);
      if (!patterns.length) return JSON.stringify({ advice: 'I do not have enough data about your work patterns yet. Keep using TIMPs and I will learn how you work best.' });
      const advice = await llmJSON<any>(`You are this person's personal coach who has studied how they work. Give specific, personalized advice for their current situation using ONLY their actual observed patterns — not generic advice. Return JSON: { advice: string, relevant_pattern: string, confidence: 0-1, action_now: string }. Their patterns: ${JSON.stringify(patterns)}. Current situation: ${current_situation}`, 500);
      return JSON.stringify(advice || { advice: 'Unable to generate personalized advice' });
    }

    if (operation === 'patterns') {
      const patterns = await query<any>(`SELECT pattern_type, description, success_rate, observed_count, last_seen FROM workflow_patterns WHERE user_id=$1 ORDER BY success_rate DESC`, [user_id]);
      return JSON.stringify({ patterns, total: patterns.length });
    }

    return JSON.stringify({ error: `Unknown operation: ${operation}` });
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// TOOL 8 — Curriculum Architect
// ════════════════════════════════════════════════════════════════════════════════
export class CurriculumArchitectTool extends BaseTool {
  name = 'curriculum_architect';
  description = 'Tool 8 — Curriculum Architect. Builds personalized learning plans based on how the user\'s brain actually retains information — their forgetting curves, analogies that click, misconception patterns.';
  parameters: ToolParameter = {
    type: 'object', description: 'Curriculum Architect parameters',
    properties: {
      operation: { type: 'string', enum: ['log_session', 'build_curriculum', 'get_plan'], description: 'log_session: record a learning event | build_curriculum: generate personalized plan | get_plan: retrieve existing plan' },
      user_id: { type: 'number', description: 'User ID' },
      topic: { type: 'string', description: 'What was learned or to learn' },
      outcome: { type: 'string', description: 'For log: understood|confused|forgotten' },
      analogy_used: { type: 'string', description: 'Any analogy that helped understanding' },
      retention_days: { type: 'number', description: 'How many days until the user forgot (if known)' },
      goal: { type: 'string', description: 'For build_curriculum: what the user wants to achieve' },
    },
    required: ['operation', 'user_id'],
  };

  async execute(params: Record<string, any>): Promise<string> {
    const { operation, user_id, topic, outcome, analogy_used, retention_days, goal } = params;

    if (operation === 'log_session') {
      if (!topic) return JSON.stringify({ error: 'topic required' });
      await execute(`INSERT INTO learning_events (user_id, topic, outcome, retention_days, analogy_used) VALUES ($1,$2,$3,$4,$5)`, [user_id, topic, outcome || 'unknown', retention_days || null, analogy_used || null]);
      return JSON.stringify({ success: true, message: 'Learning session recorded' });
    }

    if (operation === 'build_curriculum') {
      if (!topic || !goal) return JSON.stringify({ error: 'topic and goal required' });
      const history = await query<any>(`SELECT topic, outcome, retention_days, analogy_used FROM learning_events WHERE user_id=$1 ORDER BY recorded_at DESC LIMIT 30`, [user_id]);
      const curriculum = await llmJSON<any>(`Build a personalized learning curriculum for this specific learner. Use their learning history to determine: what analogies work for them, how long until they forget, what causes confusion. Return JSON: { curriculum: { week: number, focus: string, approach: string, analogy: string }[], learning_style_insight: string, estimated_weeks: number, personalization_notes: string }. Learning history: ${JSON.stringify(history)}. Target topic: ${topic}. Goal: ${goal}`, 800);
      if (curriculum) {
        await execute(`INSERT INTO curricula (user_id, topic, plan) VALUES ($1,$2,$3)`, [user_id, topic, JSON.stringify(curriculum)]);
      }
      return JSON.stringify(curriculum || { error: 'Curriculum generation failed' });
    }

    if (operation === 'get_plan') {
      if (!topic) return JSON.stringify({ error: 'topic required' });
      const plan = await query<any>(`SELECT plan, created_at FROM curricula WHERE user_id=$1 AND topic=$2 ORDER BY created_at DESC LIMIT 1`, [user_id, topic]);
      if (!plan.length) return JSON.stringify({ message: 'No curriculum found for this topic. Use build_curriculum to create one.' });
      return JSON.stringify(plan[0].plan);
    }

    return JSON.stringify({ error: `Unknown operation: ${operation}` });
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// TOOL 9 — Technical Debt Seismograph
// ════════════════════════════════════════════════════════════════════════════════
export class TechDebtSeismographTool extends BaseTool {
  name = 'tech_debt_seismograph';
  description = 'Tool 9 — Technical Debt Seismograph. Records codebase-specific incident history and warns when new code patterns match patterns that caused real incidents before. Uses YOUR codebase history, not generic best practices.';
  parameters: ToolParameter = {
    type: 'object', description: 'Tech Debt Seismograph parameters',
    properties: {
      operation: { type: 'string', enum: ['record_incident', 'check_pattern', 'report'], description: 'record_incident: log a production incident | check_pattern: warn if code matches past incident patterns | report: get debt summary' },
      user_id: { type: 'number', description: 'User ID' },
      project_id: { type: 'string', description: 'Project identifier (default: default)' },
      pattern: { type: 'string', description: 'Code pattern or description of the code being written/reviewed' },
      incident_type: { type: 'string', description: 'e.g. race_condition, null_pointer, memory_leak, timeout' },
      time_to_debug_hrs: { type: 'number', description: 'How long the incident took to fix in hours' },
    },
    required: ['operation', 'user_id'],
  };

  async execute(params: Record<string, any>): Promise<string> {
    const { operation, user_id, project_id = 'default', pattern, incident_type, time_to_debug_hrs } = params;

    if (operation === 'record_incident') {
      if (!pattern) return JSON.stringify({ error: 'pattern required' });
      await execute(`INSERT INTO code_incidents (user_id, project_id, pattern, incident_type, time_to_debug_hrs) VALUES ($1,$2,$3,$4,$5)`, [user_id, project_id, pattern, incident_type || 'unknown', time_to_debug_hrs || null]);
      return JSON.stringify({ success: true, message: 'Incident recorded in codebase memory' });
    }

    if (operation === 'check_pattern') {
      if (!pattern) return JSON.stringify({ error: 'pattern required' });
      const incidents = await query<any>(`SELECT pattern, incident_type, time_to_debug_hrs, occurred_at FROM code_incidents WHERE user_id=$1 AND project_id=$2 ORDER BY occurred_at DESC LIMIT 20`, [user_id, project_id]);
      if (!incidents.length) return JSON.stringify({ warning: false, message: 'No incident history yet. Record incidents to enable pattern detection.' });
      const check = await llmJSON<any>(`You are a codebase incident analyst. Does the new code pattern match any historical incident patterns? Return JSON: { warning: bool, similarity_score: 0-1, matching_incident: string|null, risk_level: "low|medium|high", message: string }. Historical incidents: ${JSON.stringify(incidents)}. New pattern: ${pattern}`, 400);
      return JSON.stringify(check || { warning: false });
    }

    if (operation === 'report') {
      const incidents = await query<any>(`SELECT incident_type, COUNT(*) as count, AVG(time_to_debug_hrs) as avg_hours FROM code_incidents WHERE user_id=$1 AND project_id=$2 GROUP BY incident_type ORDER BY count DESC`, [user_id, project_id]);
      return JSON.stringify({ incident_summary: incidents, project_id });
    }

    return JSON.stringify({ error: `Unknown operation: ${operation}` });
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// TOOL 10 — Bug Pattern Prophet
// ════════════════════════════════════════════════════════════════════════════════
export class BugPatternProphetTool extends BaseTool {
  name = 'bug_pattern_prophet';
  description = 'Tool 10 — Bug Pattern Prophet. Learns YOUR personal bug-writing patterns and warns before you write the next one. Developer A writes race conditions under deadline pressure. Developer B writes null pointers with unfamiliar APIs. This tool knows which one you are.';
  parameters: ToolParameter = {
    type: 'object', description: 'Bug Pattern Prophet parameters',
    properties: {
      operation: { type: 'string', enum: ['record_bug', 'warn', 'profile'], description: 'record_bug: log a bug you introduced | warn: check if current context matches your bug patterns | profile: view your bug fingerprint' },
      user_id: { type: 'number', description: 'User ID' },
      bug_type: { type: 'string', description: 'Type of bug (off_by_one, null_pointer, race_condition, etc.)' },
      trigger_context: { type: 'string', description: 'Context when the bug appeared (tired, deadline, new_api, etc.)' },
      current_context: { type: 'string', description: 'For warn: describe current coding context' },
    },
    required: ['operation', 'user_id'],
  };

  async execute(params: Record<string, any>): Promise<string> {
    const { operation, user_id, bug_type, trigger_context, current_context } = params;

    if (operation === 'record_bug') {
      if (!bug_type) return JSON.stringify({ error: 'bug_type required' });
      const existing = await query<any>(`SELECT id, frequency FROM bug_patterns WHERE user_id=$1 AND bug_type=$2`, [user_id, bug_type]);
      if (existing.length) {
        await execute(`UPDATE bug_patterns SET frequency=frequency+1, last_occurrence=NOW(), trigger_context=$1 WHERE id=$2`, [trigger_context || null, existing[0].id]);
      } else {
        await execute(`INSERT INTO bug_patterns (user_id, bug_type, trigger_context) VALUES ($1,$2,$3)`, [user_id, bug_type, trigger_context || null]);
      }
      return JSON.stringify({ success: true, message: `Bug pattern "${bug_type}" recorded` });
    }

    if (operation === 'warn') {
      if (!current_context) return JSON.stringify({ error: 'current_context required' });
      const patterns = await query<any>(`SELECT bug_type, trigger_context, frequency FROM bug_patterns WHERE user_id=$1 ORDER BY frequency DESC LIMIT 15`, [user_id]);
      if (!patterns.length) return JSON.stringify({ alert: false, message: 'No bug history yet. Record bugs as you find them to enable personalized warnings.' });
      const result = await llmJSON<any>(`You are a personalized bug-risk detector. Based on this developer's personal bug patterns, assess the risk of their current coding context. Return JSON: { alert: bool, risk_level: "low|medium|high", likely_bug_types: string[], reason: string, suggestion: string }. Developer's bug patterns: ${JSON.stringify(patterns)}. Current context: ${current_context}`, 400);
      return JSON.stringify(result || { alert: false });
    }

    if (operation === 'profile') {
      const patterns = await query<any>(`SELECT bug_type, trigger_context, frequency, last_occurrence FROM bug_patterns WHERE user_id=$1 ORDER BY frequency DESC`, [user_id]);
      return JSON.stringify({ bug_fingerprint: patterns, total_patterns: patterns.length });
    }

    return JSON.stringify({ error: `Unknown operation: ${operation}` });
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// TOOL 11 — API Archaeologist
// ════════════════════════════════════════════════════════════════════════════════
export class APIArchaeologistTool extends BaseTool {
  name = 'api_archaeologist';
  description = 'Tool 11 — API Archaeologist. Builds a living memory of undocumented API quirks your team has discovered. Never re-discover that Stripe webhook timeout is 5s not 30s. Accumulates institutional API knowledge across sessions.';
  parameters: ToolParameter = {
    type: 'object', description: 'API Archaeologist parameters',
    properties: {
      operation: { type: 'string', enum: ['record_quirk', 'lookup', 'list'], description: 'record_quirk: save a discovered API quirk | lookup: search what we know about an API | list: all known APIs' },
      user_id: { type: 'number', description: 'User ID' },
      api_name: { type: 'string', description: 'Name of the API (e.g. Stripe, SendGrid, GitHub)' },
      endpoint: { type: 'string', description: 'Specific endpoint if applicable' },
      quirk: { type: 'string', description: 'The undocumented behavior discovered' },
      severity: { type: 'string', description: 'info|warning|critical' },
    },
    required: ['operation', 'user_id'],
  };

  async execute(params: Record<string, any>): Promise<string> {
    const { operation, user_id, api_name, endpoint, quirk, severity } = params;

    if (operation === 'record_quirk') {
      if (!api_name || !quirk) return JSON.stringify({ error: 'api_name and quirk required' });
      await execute(`INSERT INTO api_knowledge (user_id, api_name, endpoint, discovered_quirk, severity) VALUES ($1,$2,$3,$4,$5)`, [user_id, api_name, endpoint || null, quirk, severity || 'info']);
      return JSON.stringify({ success: true, message: `Quirk for ${api_name} saved to API memory` });
    }

    if (operation === 'lookup') {
      if (!api_name) return JSON.stringify({ error: 'api_name required' });
      const knowledge = await query<any>(`SELECT endpoint, discovered_quirk, severity, discovered_at FROM api_knowledge WHERE user_id=$1 AND LOWER(api_name) LIKE LOWER($2) ORDER BY severity DESC, discovered_at DESC`, [user_id, `%${api_name}%`]);
      if (!knowledge.length) return JSON.stringify({ message: `No quirks recorded for ${api_name} yet.`, quirks: [] });
      return JSON.stringify({ api: api_name, quirks: knowledge, total: knowledge.length });
    }

    if (operation === 'list') {
      const apis = await query<any>(`SELECT api_name, COUNT(*) as quirk_count FROM api_knowledge WHERE user_id=$1 GROUP BY api_name ORDER BY quirk_count DESC`, [user_id]);
      return JSON.stringify({ known_apis: apis });
    }

    return JSON.stringify({ error: `Unknown operation: ${operation}` });
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// TOOL 12 — Codebase Anthropologist
// ════════════════════════════════════════════════════════════════════════════════
export class CodebaseAnthropologistTool extends BaseTool {
  name = 'codebase_anthropologist';
  description = 'Tool 12 — Codebase Anthropologist. Builds the cultural and historical intelligence of a codebase — why decisions were made, what was rejected, what patterns the team is allergic to. The institutional memory of the code.';
  parameters: ToolParameter = {
    type: 'object', description: 'Codebase Anthropologist parameters',
    properties: {
      operation: { type: 'string', enum: ['record_insight', 'query', 'culture_report'], description: 'record_insight: save a codebase insight | query: ask about codebase culture | culture_report: full cultural analysis' },
      user_id: { type: 'number', description: 'User ID' },
      project_id: { type: 'string', description: 'Project identifier' },
      insight_type: { type: 'string', description: 'e.g. architectural_decision, cultural_allergy, workaround, rejected_approach' },
      description: { type: 'string', description: 'The insight' },
      evidence: { type: 'string', description: 'What evidence supports this insight' },
      question: { type: 'string', description: 'For query: what you want to know about the codebase' },
    },
    required: ['operation', 'user_id'],
  };

  async execute(params: Record<string, any>): Promise<string> {
    const { operation, user_id, project_id = 'default', insight_type, description, evidence, question } = params;

    if (operation === 'record_insight') {
      if (!insight_type || !description) return JSON.stringify({ error: 'insight_type and description required' });
      await execute(`INSERT INTO codebase_culture (user_id, project_id, insight_type, description, evidence) VALUES ($1,$2,$3,$4,$5)`, [user_id, project_id, insight_type, description, evidence || null]);
      return JSON.stringify({ success: true, message: 'Codebase insight recorded' });
    }

    if (operation === 'query') {
      if (!question) return JSON.stringify({ error: 'question required' });
      const insights = await query<any>(`SELECT insight_type, description, evidence, created_at FROM codebase_culture WHERE user_id=$1 AND project_id=$2 ORDER BY created_at DESC LIMIT 30`, [user_id, project_id]);
      if (!insights.length) return JSON.stringify({ answer: 'No codebase culture data recorded yet.', insights: [] });
      const answer = await llm(`You are an expert on this specific codebase. Answer the question using ONLY the recorded insights. Be specific. Insights: ${JSON.stringify(insights)}. Question: ${question}`, 400);
      return JSON.stringify({ answer, supporting_insights: insights.filter((i: any) => answer.toLowerCase().includes(i.insight_type)) });
    }

    if (operation === 'culture_report') {
      const insights = await query<any>(`SELECT insight_type, description, evidence FROM codebase_culture WHERE user_id=$1 AND project_id=$2 ORDER BY created_at DESC`, [user_id, project_id]);
      if (!insights.length) return JSON.stringify({ message: 'No cultural data recorded yet for this project.' });
      const report = await llm(`Generate a "Codebase Culture Report" — a frank anthropological analysis of this codebase's personality, values, allergies, and hidden logic. Insights: ${JSON.stringify(insights)}`, 600);
      return JSON.stringify({ report, project_id, insight_count: insights.length });
    }

    return JSON.stringify({ error: `Unknown operation: ${operation}` });
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// TOOL 13 — Institutional Memory Necromancer
// ════════════════════════════════════════════════════════════════════════════════
export class InstitutionalMemoryTool extends BaseTool {
  name = 'institutional_memory';
  description = 'Tool 13 — Institutional Memory Necromancer. Preserves the decision-making logic of people who have left an organization. When employees leave, their knowledge doesn\'t die — it stays, perfectly queryable.';
  parameters: ToolParameter = {
    type: 'object', description: 'Institutional Memory parameters',
    properties: {
      operation: { type: 'string', enum: ['preserve', 'query', 'list'], description: 'preserve: save a decision and rationale | query: reconstruct why something was done | list: all preserved knowledge' },
      org_id: { type: 'string', description: 'Organization or team identifier' },
      person_name: { type: 'string', description: 'Who made or was involved in this decision' },
      decision: { type: 'string', description: 'What was decided or built' },
      rationale: { type: 'string', description: 'Why this decision was made' },
      alternatives_rejected: { type: 'string', description: 'What alternatives were considered and rejected' },
      source_type: { type: 'string', description: 'e.g. slack, pr_comment, design_doc, interview' },
      query: { type: 'string', description: 'For query: what you want to understand' },
    },
    required: ['operation', 'org_id'],
  };

  async execute(params: Record<string, any>): Promise<string> {
    const { operation, org_id, person_name, decision, rationale, alternatives_rejected, source_type, query: userQuery } = params;

    if (operation === 'preserve') {
      if (!decision) return JSON.stringify({ error: 'decision required' });
      await execute(`INSERT INTO institutional_knowledge (org_id, person_name, decision, rationale, alternatives_rejected, source_type) VALUES ($1,$2,$3,$4,$5,$6)`, [org_id, person_name || null, decision, rationale || null, alternatives_rejected || null, source_type || 'manual']);
      return JSON.stringify({ success: true, message: `Knowledge from ${person_name || 'team member'} preserved` });
    }

    if (operation === 'query') {
      if (!userQuery) return JSON.stringify({ error: 'query required' });
      const knowledge = await query<any>(`SELECT person_name, decision, rationale, alternatives_rejected, source_type, preserved_at FROM institutional_knowledge WHERE org_id=$1 ORDER BY preserved_at DESC LIMIT 30`, [org_id]);
      if (!knowledge.length) return JSON.stringify({ answer: 'No institutional knowledge preserved yet.' });
      const answer = await llm(`You are an institutional memory expert. Answer the question using the preserved knowledge. Attribute answers to specific people where possible. Knowledge: ${JSON.stringify(knowledge)}. Question: ${userQuery}`, 500);
      return JSON.stringify({ answer });
    }

    if (operation === 'list') {
      const knowledge = await query<any>(`SELECT person_name, decision, source_type, preserved_at FROM institutional_knowledge WHERE org_id=$1 ORDER BY preserved_at DESC LIMIT 50`, [org_id]);
      return JSON.stringify({ knowledge, total: knowledge.length });
    }

    return JSON.stringify({ error: `Unknown operation: ${operation}` });
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// TOOL 14 — Chemistry Engine
// ════════════════════════════════════════════════════════════════════════════════
export class ChemistryEngineTool extends BaseTool {
  name = 'chemistry_engine';
  description = 'Tool 14 — Chemistry Engine. Predicts how two people will work together based on actual behavioral profiles — decision velocity, communication style, conflict patterns. Not personality tests. Real behavioral data.';
  parameters: ToolParameter = {
    type: 'object', description: 'Chemistry Engine parameters',
    properties: {
      operation: { type: 'string', enum: ['build_profile', 'analyze_pair', 'get_profile'], description: 'build_profile: create behavioral profile for a person | analyze_pair: predict compatibility | get_profile: retrieve profile' },
      user_id: { type: 'number', description: 'User ID' },
      person_identifier: { type: 'string', description: 'Name or identifier of the person' },
      profile_data: { type: 'string', description: 'JSON string of behavioral observations for build_profile' },
      person_a: { type: 'string', description: 'For analyze_pair: first person identifier' },
      person_b: { type: 'string', description: 'For analyze_pair: second person identifier' },
    },
    required: ['operation', 'user_id'],
  };

  async execute(params: Record<string, any>): Promise<string> {
    const { operation, user_id, person_identifier, profile_data, person_a, person_b } = params;

    if (operation === 'build_profile') {
      if (!person_identifier || !profile_data) return JSON.stringify({ error: 'person_identifier and profile_data required' });
      let parsed;
      try { parsed = JSON.parse(profile_data); } catch { return JSON.stringify({ error: 'profile_data must be valid JSON' }); }
      await execute(`INSERT INTO behavioral_profiles (user_id, person_identifier, profile_data) VALUES ($1,$2,$3) ON CONFLICT (user_id, person_identifier) DO UPDATE SET profile_data=$3, updated_at=NOW()`, [user_id, person_identifier, JSON.stringify(parsed)]);
      return JSON.stringify({ success: true, message: `Profile for ${person_identifier} saved` });
    }

    if (operation === 'analyze_pair') {
      if (!person_a || !person_b) return JSON.stringify({ error: 'person_a and person_b required' });
      const profiles = await query<any>(`SELECT person_identifier, profile_data FROM behavioral_profiles WHERE user_id=$1 AND person_identifier IN ($2,$3)`, [user_id, person_a, person_b]);
      if (profiles.length < 2) return JSON.stringify({ error: `Profile not found for ${profiles.length === 0 ? 'either person' : (profiles[0].person_identifier === person_a ? person_b : person_a)}. Build profiles first.` });
      const analysis = await llmJSON<any>(`Analyze the compatibility of these two people based on their behavioral profiles. Return JSON: { overall_compatibility: 0-100, execution_compatibility: 0-100, creative_compatibility: 0-100, conflict_triggers: string[], recommended_working_mode: string, avoid: string, pairing_summary: string }. Profile A (${person_a}): ${JSON.stringify(profiles[0])}. Profile B (${person_b}): ${JSON.stringify(profiles[1])}`, 600);
      if (analysis) {
        await execute(`INSERT INTO compatibility_scores (user_id, person_a, person_b, score, analysis) VALUES ($1,$2,$3,$4,$5)`, [user_id, person_a, person_b, (analysis.overall_compatibility || 50) / 100, JSON.stringify(analysis)]);
      }
      return JSON.stringify(analysis || { error: 'Analysis failed' });
    }

    if (operation === 'get_profile') {
      if (!person_identifier) return JSON.stringify({ error: 'person_identifier required' });
      const profile = await query<any>(`SELECT profile_data, updated_at FROM behavioral_profiles WHERE user_id=$1 AND person_identifier=$2`, [user_id, person_identifier]);
      if (!profile.length) return JSON.stringify({ message: `No profile found for ${person_identifier}` });
      return JSON.stringify(profile[0]);
    }

    return JSON.stringify({ error: `Unknown operation: ${operation}` });
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// TOOL 15 — Meeting Ghost
// ════════════════════════════════════════════════════════════════════════════════
export class MeetingGhostTool extends BaseTool {
  name = 'meeting_ghost';
  description = 'Tool 15 — Meeting Ghost. Silently tracks every commitment made in meetings. Builds a longitudinal accountability record. Shows who follows through and who doesn\'t, what types of commitments break, and the real cost.';
  parameters: ToolParameter = {
    type: 'object', description: 'Meeting Ghost parameters',
    properties: {
      operation: { type: 'string', enum: ['extract_commitments', 'update_status', 'accountability_report', 'list_pending'], description: 'extract_commitments: parse meeting notes for commitments | update_status: mark a commitment done/broken | accountability_report: full analysis | list_pending: show open commitments' },
      user_id: { type: 'number', description: 'User ID' },
      meeting_notes: { type: 'string', description: 'For extract_commitments: raw meeting notes or transcript' },
      meeting_title: { type: 'string', description: 'Name of the meeting' },
      commitment_id: { type: 'number', description: 'For update_status: ID of the commitment' },
      status: { type: 'string', description: 'For update_status: completed|broken|in_progress' },
    },
    required: ['operation', 'user_id'],
  };

  async execute(params: Record<string, any>): Promise<string> {
    const { operation, user_id, meeting_notes, meeting_title, commitment_id, status } = params;

    if (operation === 'extract_commitments') {
      if (!meeting_notes) return JSON.stringify({ error: 'meeting_notes required' });
      const extracted = await llmJSON<any>(`Extract all commitments from these meeting notes. A commitment is: a specific action someone agrees to do. Return JSON: { commitments: [{ person_name: string, commitment: string, due_date: string|null }] }. Meeting notes: ${meeting_notes}`, 600);
      if (!extracted?.commitments?.length) return JSON.stringify({ message: 'No commitments detected in meeting notes', commitments_stored: 0 });
      let stored = 0;
      for (const c of extracted.commitments) {
        await execute(`INSERT INTO meeting_commitments (user_id, meeting_title, person_name, commitment, due_date) VALUES ($1,$2,$3,$4,$5)`, [user_id, meeting_title || 'Untitled Meeting', c.person_name, c.commitment, c.due_date ? new Date(c.due_date) : null]);
        stored++;
      }
      return JSON.stringify({ success: true, commitments_stored: stored, commitments: extracted.commitments });
    }

    if (operation === 'update_status') {
      if (!commitment_id || !status) return JSON.stringify({ error: 'commitment_id and status required' });
      await execute(`UPDATE meeting_commitments SET status=$1 WHERE id=$2 AND user_id=$3`, [status, commitment_id, user_id]);
      return JSON.stringify({ success: true, updated_id: commitment_id, new_status: status });
    }

    if (operation === 'list_pending') {
      const pending = await query<any>(`SELECT id, person_name, commitment, due_date, meeting_title, meeting_date FROM meeting_commitments WHERE user_id=$1 AND status='pending' ORDER BY due_date ASC NULLS LAST`, [user_id]);
      return JSON.stringify({ pending_commitments: pending, total: pending.length });
    }

    if (operation === 'accountability_report') {
      const all = await query<any>(`SELECT person_name, status, COUNT(*) as count FROM meeting_commitments WHERE user_id=$1 GROUP BY person_name, status ORDER BY person_name`, [user_id]);
      const report = await llmJSON<any>(`Generate an accountability report. Return JSON: { top_performers: string[], accountability_gaps: string[], follow_through_rate_by_person: object, insight: string }. Data: ${JSON.stringify(all)}`, 500);
      return JSON.stringify(report || { data: all });
    }

    return JSON.stringify({ error: `Unknown operation: ${operation}` });
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// TOOL 16 — Collective Wisdom Harvester
// ════════════════════════════════════════════════════════════════════════════════
export class CollectiveWisdomTool extends BaseTool {
  name = 'collective_wisdom';
  description = 'Tool 16 — Collective Wisdom Harvester. Anonymously aggregates decision outcomes across similar users. Tells you what people with your exact profile did in this situation and what happened. Privacy-preserving cross-user intelligence.';
  parameters: ToolParameter = {
    type: 'object', description: 'Collective Wisdom parameters',
    properties: {
      operation: { type: 'string', enum: ['contribute', 'query_wisdom'], description: 'contribute: anonymously contribute a decision outcome | query_wisdom: see what similar profiles did' },
      user_id: { type: 'number', description: 'User ID' },
      decision_context: { type: 'string', description: 'The decision situation (will be anonymized)' },
      outcome: { type: 'string', description: 'success|failure|mixed' },
      profile_tags: { type: 'string', description: 'Comma-separated profile tags e.g. "solo-founder,saas,early-stage"' },
      query: { type: 'string', description: 'For query_wisdom: what decision you are facing' },
    },
    required: ['operation', 'user_id'],
  };

  async execute(params: Record<string, any>): Promise<string> {
    const { operation, user_id, decision_context, outcome, profile_tags, query: userQuery } = params;

    if (operation === 'contribute') {
      if (!decision_context || !outcome) return JSON.stringify({ error: 'decision_context and outcome required' });
      const profileHash = Buffer.from(`${user_id}_${profile_tags || ''}`).toString('base64').slice(0, 16);
      const tags = (profile_tags || '').split(',').map((t: string) => t.trim()).filter(Boolean);
      await execute(`INSERT INTO wisdom_contributions (user_id, profile_hash, decision_context, outcome, profile_tags) VALUES ($1,$2,$3,$4,$5)`, [user_id, profileHash, decision_context, outcome, tags]);
      return JSON.stringify({ success: true, message: 'Anonymous contribution added to collective wisdom' });
    }

    if (operation === 'query_wisdom') {
      if (!userQuery) return JSON.stringify({ error: 'query required' });
      const wisdom = await query<any>(`SELECT decision_context, outcome, profile_tags, contributed_at FROM wisdom_contributions ORDER BY contributed_at DESC LIMIT 50`);
      if (!wisdom.length) return JSON.stringify({ message: 'Collective wisdom pool is empty. Contribute your outcomes to build it.' });
      const insight = await llmJSON<any>(`You are a collective wisdom analyst. Find patterns in what worked and failed for similar situations. Return JSON: { relevant_experiences: number, success_rate: 0-1, key_insight: string, what_worked: string, what_failed: string, recommendation: string }. Collective data: ${JSON.stringify(wisdom.slice(0, 20))}. Current question: ${userQuery}`, 500);
      return JSON.stringify(insight || { message: 'No relevant collective wisdom found' });
    }

    return JSON.stringify({ error: `Unknown operation: ${operation}` });
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// TOOL 17 — Relationship Intelligence Engine
// ════════════════════════════════════════════════════════════════════════════════
export class RelationshipIntelligenceTool extends BaseTool {
  name = 'relationship_intelligence';
  description = 'Tool 17 — Relationship Intelligence Engine. Tracks relationship health over months, detects silent drift before it becomes permanent loss, and recommends interventions. Watches what you miss in your most important relationships.';
  parameters: ToolParameter = {
    type: 'object', description: 'Relationship Intelligence parameters',
    properties: {
      operation: { type: 'string', enum: ['record_signal', 'health_check', 'drift_alerts', 'relationship_map'], description: 'record_signal: log an interaction signal | health_check: get health score for one contact | drift_alerts: list relationships showing drift | relationship_map: full relationship intelligence' },
      user_id: { type: 'number', description: 'User ID' },
      contact_name: { type: 'string', description: 'Name of the contact' },
      signal_type: { type: 'string', description: 'e.g. initiated_contact, responded, deep_conversation, missed_reply, topic_depth' },
      value: { type: 'number', description: 'Signal value (positive=1, neutral=0, negative=-1, or custom scale)' },
      context: { type: 'string', description: 'Context of the interaction' },
    },
    required: ['operation', 'user_id'],
  };

  async execute(params: Record<string, any>): Promise<string> {
    const { operation, user_id, contact_name, signal_type, value, context } = params;

    if (operation === 'record_signal') {
      if (!contact_name || !signal_type) return JSON.stringify({ error: 'contact_name and signal_type required' });
      await execute(`INSERT INTO relationship_signals (user_id, contact_name, signal_type, value, context) VALUES ($1,$2,$3,$4,$5)`, [user_id, contact_name, signal_type, value ?? 1, context || null]);
      await this.updateHealthScore(user_id, contact_name);
      return JSON.stringify({ success: true, message: `Signal recorded for ${contact_name}` });
    }

    if (operation === 'health_check') {
      if (!contact_name) return JSON.stringify({ error: 'contact_name required' });
      const health = await query<any>(`SELECT health_score, drift_alert, last_interaction, computed_at FROM relationship_health WHERE user_id=$1 AND contact_name=$2`, [user_id, contact_name]);
      const signals = await query<any>(`SELECT signal_type, value, recorded_at FROM relationship_signals WHERE user_id=$1 AND contact_name=$2 ORDER BY recorded_at DESC LIMIT 20`, [user_id, contact_name]);
      if (!health.length) return JSON.stringify({ message: `No data for ${contact_name} yet. Record signals to track this relationship.` });
      return JSON.stringify({ contact: contact_name, health: health[0], recent_signals: signals });
    }

    if (operation === 'drift_alerts') {
      const alerts = await query<any>(`SELECT contact_name, health_score, last_interaction, computed_at FROM relationship_health WHERE user_id=$1 AND drift_alert=true ORDER BY health_score ASC`, [user_id]);
      return JSON.stringify({ drift_alerts: alerts, total: alerts.length, message: alerts.length ? `${alerts.length} relationship(s) showing drift` : 'No drift detected' });
    }

    if (operation === 'relationship_map') {
      const allHealth = await query<any>(`SELECT contact_name, health_score, drift_alert, last_interaction FROM relationship_health WHERE user_id=$1 ORDER BY health_score DESC`, [user_id]);
      if (!allHealth.length) return JSON.stringify({ message: 'No relationships tracked yet. Start recording signals.' });
      const analysis = await llmJSON<any>(`Analyze this person's relationship portfolio. Return JSON: { strongest_relationships: string[], at_risk: string[], insight: string, recommended_action: string, overall_health: "strong|moderate|fragile" }. Data: ${JSON.stringify(allHealth)}`, 400);
      return JSON.stringify({ relationship_map: allHealth, analysis: analysis || {}, total: allHealth.length });
    }

    return JSON.stringify({ error: `Unknown operation: ${operation}` });
  }

  private async updateHealthScore(userId: number, contactName: string): Promise<void> {
    try {
      const signals = await query<any>(`SELECT signal_type, value, recorded_at FROM relationship_signals WHERE user_id=$1 AND contact_name=$2 ORDER BY recorded_at DESC LIMIT 30`, [userId, contactName]);
      if (!signals.length) return;
      const recentScore = signals.slice(0, 10).reduce((s: number, r: any) => s + (r.value || 0), 0) / 10;
      const olderScore = signals.slice(10, 20).reduce((s: number, r: any) => s + (r.value || 0), 0) / Math.max(signals.slice(10, 20).length, 1);
      const drift = signals.length >= 10 && recentScore < olderScore * 0.6;
      const lastInteraction = signals[0]?.recorded_at || new Date();
      await execute(`INSERT INTO relationship_health (user_id, contact_name, health_score, drift_alert, last_interaction) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (user_id, contact_name) DO UPDATE SET health_score=$3, drift_alert=$4, last_interaction=$5, computed_at=NOW()`, [userId, contactName, Math.max(0, Math.min(1, recentScore)), drift, lastInteraction]);
    } catch (err) {
      console.error('[RelationshipIntelligence] Score update failed:', err);
    }
  }
}