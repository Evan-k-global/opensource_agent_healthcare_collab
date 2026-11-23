import { digest } from './workshop.mjs';
export class Workflow {
  constructor(config, handlers = {}) {
    if (!config.syntheticDataOnly) throw new Error('demo_requires_synthetic_data');
    if (config.algorithm !== 'synthetic-support-v1' || config.threshold !== 500 || config.maxComputeRunsPerCompany !== 1) throw new Error('unsupported_fixed_demo_computation');
    for (const name of ['magicCity', 'zkTLS', 'payments']) if (config[name]?.enabled) throw new Error(`${name}_adapter_not_configured`);
    this.config = config; this.handlers = handlers; this.events = []; this.state = 'planning'; this.plan = null;
    this.agreed = new Set(); this.computed = new Set();
  }
  async checkpoint(name, context = {}) {
    let outcome = 'disabled';
    if (this.config.humanReview.enabled && this.config.humanReview.checkpoints.includes(name)) {
      if (!this.handlers.review) throw new Error(`human_review_required:${name}`);
      const decision = await this.handlers.review({ name, planHash: this.plan && digest(this.plan), ...context });
      if (decision !== true) throw new Error(`human_review_denied:${name}`);
      outcome = 'approved';
    }
    this.events.push({ checkpoint: name, humanReview: outcome });
  }
  async route(defaultRole, context = {}) {
    if (!this.config.modelRouting.enabled) return { role: defaultRole, source: 'deterministic' };
    if (!this.handlers.route) throw new Error('model_router_not_configured');
    const role = await this.handlers.route(context);
    if (!this.config.modelRouting.allowedRoles.includes(role)) throw new Error('invalid_model_route');
    return { role, source: 'model-suggestion-policy-checked' };
  }
  async agree(org, plan) {
    if (!['a', 'b'].includes(org) || this.state !== 'planning') throw new Error('invalid_plan_transition');
    if (this.plan && digest(this.plan) !== digest(plan)) throw new Error('plan_mismatch');
    await this.checkpoint('plan_agreement', { org, planHash: digest(plan), plan: structuredClone(plan) });
    this.plan = structuredClone(plan); this.agreed.add(org);
    if (this.agreed.size === 2) this.state = 'agreed';
  }
  async beforeCompute(org) {
    if (!['a', 'b'].includes(org) || !['agreed', 'computing'].includes(this.state) || this.agreed.size !== 2 || this.computed.has(org)) throw new Error('compute_not_authorized_or_replayed');
    await this.checkpoint('before_compute', { org });
    this.computed.add(org); this.state = 'computing';
  }
  async beforeDisclose(org) {
    if (!this.computed.has(org)) throw new Error('disclosure_before_compute');
    await this.checkpoint('before_disclosure', { org });
  }
  async beforeSettle() {
    if (this.computed.size !== 2 || this.state !== 'computing') throw new Error('settlement_not_ready');
    await this.checkpoint('before_settlement'); this.state = 'ready_to_settle';
  }
  settled() {
    if (this.state !== 'ready_to_settle') throw new Error('invalid_settlement_transition');
    this.state = 'settled';
  }
}
