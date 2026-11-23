// Advisory model output never grants authority or crosses company boundaries.
export async function advise({ org, role, action, humanReview = false }) {
  const mode = process.env.AGENT_INTELLIGENCE ?? 'off';
  if (mode === 'off') return { mode, role, decision: 'proceed', rationale: 'Fixed synthetic workflow; intelligence disabled.' };
  if (!['mock', 'gemma'].includes(mode)) throw new Error('invalid_intelligence_mode');
  const url = new URL(process.env[`GEMMA_${org.toUpperCase()}_BASE_URL`] ?? process.env.GEMMA_BASE_URL ?? 'http://127.0.0.1:11434/v1');
  if (!['localhost','127.0.0.1'].includes(url.hostname) || url.protocol !== 'http:') throw new Error('company_local_model_required');
  const model = mode === 'mock' ? 'transport-fixture' : (process.env[`GEMMA_${org.toUpperCase()}_MODEL`] ?? process.env.GEMMA_MODEL);
  if (!model) throw new Error('gemma_model_required');
  const response = await fetch(url.href.replace(/\/$/,'') + '/chat/completions', {
    method: 'POST', redirect: 'error', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(120000),
    body: JSON.stringify({ model, temperature: 0, max_tokens: 400, reasoning_effort: 'none', response_format: { type: 'json_object' }, messages: [
      { role: 'system', content: 'SYNTHETIC research workflow adviser. No clinical inference. Return JSON only: {"decision":"proceed" or "hold","role":"researcher" or "reviewer" or "liaison","rationale":"brief explanation"}. Consider whether this action obeys aggregate-only disclosure, fixed arithmetic and one-run authorization. Suggest the current role only. You cannot approve disclosures or authorize tools.' },
      { role: 'user', content: JSON.stringify({ org, role, action, algorithm: 'synthetic-support-v1', disclosure: 'approved A aggregate only; raw data local', humanReview: humanReview ? 'enabled' : 'off', advisoryOnly: true }) },
    ] }),
  });
  if (!response.ok) throw new Error('local_model_request_failed');
  const content = (await response.json()).choices?.[0]?.message?.content;
  const decision = JSON.parse(content?.replace(/^```(?:json)?\s*|\s*```$/g, '') ?? 'null');
  if (!decision || !['proceed','hold'].includes(decision.decision) || decision.role !== role || typeof decision.rationale !== 'string' || decision.rationale.length > 1500) throw new Error('model_advice_exceeds_policy');
  return { ...decision, mode, model, advisoryOnly: true };
}
