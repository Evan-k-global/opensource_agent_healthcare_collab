import { randomUUID } from 'node:crypto';

// A model can request a review; only a company administrator can release it.
export class Controls {
  constructor(caseId, { timeoutMs = 15 * 60 * 1000, changed = () => {} } = {}) {
    this.caseId = caseId; this.timeoutMs = timeoutMs; this.changed = changed;
    this.requests = []; this.pending = new Map(); this.routes = [];
  }
  review({ org, name, planHash = null }) {
    if (!org) {
      const start=this.requests.length;
      const reviews=['a','b'].map(org=>this.review({org,name,planHash}));
      const ids=this.requests.slice(start).map(r=>r.id);
      return new Promise((resolve,reject)=>{
        let finished=false, approvals=0;
        const finish=(approved,error)=>{
          if(finished)return;finished=true;
          for(const id of ids){const pending=this.pending.get(id);if(pending){clearTimeout(pending.timer);this.pending.delete(id);this.requests.find(r=>r.id===id).state='cancelled';pending.resolve(false);}}
          this.changed();if(error)reject(error);else resolve(approved);
        };
        for(const review of reviews)review.then(approved=>{if(!approved)finish(false);else if(++approvals===2)finish(true);},error=>finish(false,error));
      });
    }
    if (!['a', 'b'].includes(org)) throw new Error('invalid_review_company');
    const request = { id: randomUUID(), caseId: this.caseId, org, name, planHash, state: 'pending', createdAt: new Date().toISOString() };
    this.requests.push(request);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(request.id); request.state = 'expired'; this.changed(); reject(new Error('review_deadline_exceeded'));
      }, this.timeoutMs);
      this.pending.set(request.id, { resolve, reject, timer }); this.changed();
    });
  }
  decide(scope, { caseId, id, decision }) {
    if (caseId !== this.caseId) throw new Error('stale_case');
    const request = this.requests.find(r => r.id === id);
    if (!request || request.org !== scope) throw new Error('review_scope_denied');
    const pending = this.pending.get(id);
    if (!pending) throw new Error('review_already_resolved');
    if (!['approve', 'hold', 'reject'].includes(decision)) throw new Error('invalid_review_decision');
    request.state = decision === 'hold' ? 'held' : decision === 'approve' ? 'approved' : 'rejected';
    request.decidedAt = new Date().toISOString();
    if (decision !== 'hold') { clearTimeout(pending.timer); this.pending.delete(id); pending.resolve(decision === 'approve'); }
    this.changed(); return { id, state: request.state };
  }
  async route({ org, stage, role, advice }) {
    if (!['gemma', 'mock'].includes(advice?.mode) || advice.role !== role || !['proceed', 'hold'].includes(advice.decision)) throw new Error('model_route_unavailable_or_out_of_scope');
    this.routes.push({ org, stage, role, decision: advice.decision, modelMode: advice.mode, at: new Date().toISOString() }); this.changed();
    if (advice.decision === 'hold' && !(await this.review({ org, name: 'model_route_hold' }))) throw new Error('model_route_rejected');
    return role;
  }
  view(scope) {
    return { requests: this.requests.filter(r => scope === 'operator' || r.org === scope), routes: this.routes.filter(r => scope === 'operator' || r.org === scope) };
  }
  close() {
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error('session_closed')); }
    this.pending.clear();
  }
}
