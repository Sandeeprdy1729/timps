/**
 * timps-enterprise — Stripe billing stub.
 *
 * This is a placeholder for Stripe integration.
 * In production, replace with real Stripe API calls using `stripe` npm package.
 * Stripe secret key: process.env.STRIPE_SECRET_KEY
 */

export type PlanId = 'free' | 'team' | 'enterprise';

export interface Plan {
  id: PlanId;
  name: string;
  monthlyPrice: number;  // USD cents
  maxMembers: number;
  maxMemoryEntries: number;
  featureFlags: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    maxMembers: 1,
    maxMemoryEntries: 1000,
    featureFlags: ['basic_memory', 'solo_agents'],
  },
  team: {
    id: 'team',
    name: 'Team',
    monthlyPrice: 2900,  // $29/mo
    maxMembers: 10,
    maxMemoryEntries: 50_000,
    featureFlags: ['basic_memory', 'team_memory', 'shared_recipes', 'episodic_feed', 'solo_agents', 'acp_swarm'],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 0,  // contact sales
    maxMembers: Infinity,
    maxMemoryEntries: Infinity,
    featureFlags: ['basic_memory', 'team_memory', 'shared_recipes', 'episodic_feed', 'solo_agents', 'acp_swarm', 'sso', 'audit_log', 'custom_models'],
  },
};

/** In-memory team → plan mapping (replace with DB). */
const teamPlans = new Map<string, PlanId>();

export function getTeamPlan(teamId: string): Plan {
  const planId = teamPlans.get(teamId) ?? 'free';
  return PLANS[planId];
}

export function setTeamPlan(teamId: string, planId: PlanId): void {
  teamPlans.set(teamId, planId);
}

export function hasFeature(teamId: string, feature: string): boolean {
  return getTeamPlan(teamId).featureFlags.includes(feature);
}

/** Stub: create a Stripe Checkout session URL. Replace with real Stripe API call. */
export async function createCheckoutSession(teamId: string, planId: PlanId): Promise<{ url: string }> {
  const plan = PLANS[planId];
  // In production:
  // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  // const session = await stripe.checkout.sessions.create({ ... });
  // return { url: session.url! };
  console.warn('[Stripe stub] createCheckoutSession called for team', teamId, 'plan', planId, 'price', plan.monthlyPrice);
  return { url: `https://billing.timps.dev/checkout?team=${teamId}&plan=${planId}` };
}

/** Stub: handle Stripe webhook (billing.portal.session.created, invoice.payment_succeeded, etc.). */
export function handleWebhook(payload: unknown): void {
  console.warn('[Stripe stub] webhook received:', payload);
}
