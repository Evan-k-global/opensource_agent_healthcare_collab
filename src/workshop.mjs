import {
  generateKeyPairSync, diffieHellman, hkdfSync, randomBytes, createPublicKey,
  createCipheriv, createDecipheriv, randomUUID,
} from 'node:crypto';
import { buildAgentMessageEnvelope, assertValidAgentMessageEnvelope } from '../vendor/santaclawz/agent-communication/envelope.js';
import { canonicalDigest } from '../vendor/santaclawz/hashing/digest.js';
import { stableJsonStringify } from '../vendor/santaclawz/serialization/stable-json.js';
import { buildMissionCapability, verifyCapability } from '../vendor/amba/packages/protocol/capabilities.js';
import { buildBoundaryEvent, verifyBoundaryEvent, ED25519_HOLDER_PROOF_SCHEME } from '../vendor/amba/packages/protocol/boundary-events.js';
import { jwks } from '../vendor/amba/packages/protocol/authority-keys.js';
import { sha256Hex } from '../vendor/amba/packages/protocol/digest.js';

export const ROLES = ['liaison', 'researcher', 'reviewer'];
export const secureEnv = { MISSION_AUTH_PROFILE: 'portable', MISSION_SETTLEMENT_PROFILE: 'none', DEMO_MODE: 'false' };
export const digest = value => canonicalDigest(value).sha256Hex;
export const channelMembers = {
  'a-internal': ROLES.map(r => `a-${r}`),
  'b-internal': ROLES.map(r => `b-${r}`),
  'bilateral-planning': ['a-liaison', 'b-liaison'],
};
export const channelScope = channel => channel === 'bilateral-planning' ? 'research-ab' : `research-${channel[0]}`;
export function makeCompanyIdentity(org, caseId) {
  Object.assign(process.env, secureEnv, {
    MISSION_AUTHORITY_PRIVATE_JWK: JSON.stringify(generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ format: 'jwk' })),
  });
  const agents = {};
  for (const role of ROLES) {
    const id = `${org}-${role}`;
    const signing = generateKeyPairSync('ed25519');
    const encryption = generateKeyPairSync('x25519');
    const holder = sha256Hex(signing.publicKey.export({ format: 'jwk' }));
    const scopes = [`${org}-internal`, ...(role === 'liaison' ? ['bilateral-planning'] : [])];
    const capability = buildMissionCapability({
      agentId: id, missionId: caseId, principalHash: sha256Hex(`synthetic-company-${org}`),
      authCommitment: sha256Hex({ org, synthetic: true }),
      identityAttestationHash: sha256Hex({ org, caseId, issuer: 'synthetic-demo' }),
      approvalHash: sha256Hex({ caseId, mode: 'synthetic-preauthorized' }),
      policyHash: sha256Hex({ scopes, action: 'external_app.side_effect' }),
      holderKeyCommitment: holder, allowedDomains: ['research.local'],
      allowedActions: ['external_app.side_effect'], dataScopes: scopes,
      nullifierCommitment: randomBytes(32).toString('hex'), maxSpendUsd: '0.00', paymentRails: [],
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    agents[id] = { id, role, signing, encryption, capability };
  }
  return { org, agents, authority: jwks() };
}
export function publicIdentity(identity) {
  return Object.fromEntries(Object.values(identity.agents).map(a => [a.id, {
    id: a.id, org: identity.org, role: a.role, authority: identity.authority,
    encryption: a.encryption.publicKey.export({ format: 'jwk' }), capability: a.capability,
  }]));
}
function key(privateKey, publicJwk, salt) {
  const secret = diffieHellman({ privateKey, publicKey: createPublicKey({ key: publicJwk, format: 'jwk' }) });
  return Buffer.from(hkdfSync('sha256', secret, salt, Buffer.from('research-workshop-v1'), 32));
}
export function sealMessage(agent, recipient, { caseId, channel, body, kind = 'status' }) {
  if (!channelMembers[channel]?.includes(agent.id) || !channelMembers[channel].includes(recipient.id)) throw new Error('channel_access_denied');
  const route = { messageId: randomUUID(), threadId: caseId, swarmId: channelScope(channel), channelId: channel, sender: agent.id, recipient: recipient.id };
  const ephemeral = generateKeyPairSync('x25519');
  const salt = randomBytes(32), iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(ephemeral.privateKey, recipient.encryption, salt), iv);
  cipher.setAAD(Buffer.from(stableJsonStringify(route)));
  const plaintext = Buffer.from(JSON.stringify(body));
  if (plaintext.length > 2500) throw new Error('message_too_large');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const encrypted = JSON.stringify({
    scheme: 'x25519-hkdf-sha256-aes256gcm-v1', ephemeral: ephemeral.publicKey.export({ format: 'jwk' }),
    salt: salt.toString('base64url'), iv: iv.toString('base64url'), tag: cipher.getAuthTag().toString('base64url'), ciphertext: ciphertext.toString('base64url'),
  });
  const envelope = buildAgentMessageEnvelope({
    ...route, kind, sender: { agentId: agent.id }, recipient: { agentId: recipient.id },
    visibility: 'recipient-encrypted', permissionScope: { lane: 'private-swarm', allowedActions: ['message.read'] },
    payload: { mode: 'inline', mediaType: 'text/plain+ciphertext', body: encrypted, encryption: { scheme: 'custom', keyId: recipient.id } },
    zekoAnchor: { anchorMode: 'none', network: 'custom' },
  });
  const capability = agent.capability;
  const boundary = buildBoundaryEvent({
    missionIdHash: capability.missionIdHash, capabilityHash: capability.capabilityHash, policyHash: capability.policyHash,
    action: 'external_app.side_effect', actionHash: envelope.envelopeDigestSha256,
    targetDomain: 'research.local', resource: channel, idempotencyKey: envelope.messageId,
    expiresAt: capability.expiresAt,
    holder: { scheme: ED25519_HOLDER_PROOF_SCHEME, privateKey: agent.signing.privateKey },
  });
  return { envelope, capability, boundary };
}
export function openMessage(agent, packet) {
  const e = assertValidAgentMessageEnvelope(packet.envelope);
  if (e.recipient?.agentId !== agent.id) throw new Error('recipient_mismatch');
  const route = { messageId: e.messageId, threadId: e.threadId, swarmId: e.swarmId, channelId: e.channelId, sender: e.sender.agentId, recipient: e.recipient.agentId };
  const enc = JSON.parse(e.payload.body);
  const decipher = createDecipheriv('aes-256-gcm', key(agent.encryption.privateKey, enc.ephemeral, Buffer.from(enc.salt, 'base64url')), Buffer.from(enc.iv, 'base64url'));
  decipher.setAAD(Buffer.from(stableJsonStringify(route)));
  decipher.setAuthTag(Buffer.from(enc.tag, 'base64url'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(enc.ciphertext, 'base64url')), decipher.final()]).toString());
}
export class WorkshopRelay {
  constructor({ caseId, identities, maxMessages = 12 }) {
    this.caseId = caseId; this.identities = identities; this.maxMessages = maxMessages;
    this.messages = []; this.seen = new Set(); this.counts = new Map();
  }
  validate(packet) {
    const { envelope: e, capability: c, boundary: b } = packet;
    assertValidAgentMessageEnvelope(e);
    const registered = this.identities[e.sender.agentId];
    if (!registered || e.threadId !== this.caseId || e.swarmId !== channelScope(e.channelId)) throw new Error('workshop_context_mismatch');
    if (!channelMembers[e.channelId]?.includes(e.sender.agentId) || !channelMembers[e.channelId].includes(e.recipient?.agentId)) throw new Error('channel_access_denied');
    if (e.visibility !== 'recipient-encrypted' || e.payload.mediaType !== 'text/plain+ciphertext') throw new Error('ciphertext_required');
    if (c.agentId !== registered.id || c.capabilityHash !== registered.capability.capabilityHash || !c.dataScopes.includes(e.channelId)) throw new Error('mission_scope_denied');
    if (!verifyCapability(c, { jwks: registered.authority, env: secureEnv }).valid) throw new Error('invalid_capability');
    const result = verifyBoundaryEvent(b, {
      env: secureEnv, verifierMode: 'production_strict', requireStrongHolderProof: true,
      missionIdHash: c.missionIdHash, capabilityHash: c.capabilityHash, policyHash: c.policyHash,
      allowedActions: c.allowedActions, allowedDomainHashes: [sha256Hex('research.local')],
    });
    if (!result.valid || b.holderKeyCommitment !== c.holderKeyCommitment || b.actionHash !== e.envelopeDigestSha256 || b.idempotencyKey !== e.messageId || b.resourceHash !== sha256Hex(e.channelId)) throw new Error('invalid_holder_or_message_binding');
    return e;
  }
  post(packet) {
    const e = this.validate(packet);
    if (this.seen.has(e.messageId)) throw new Error('message_replay');
    const used = this.counts.get(e.sender.agentId) ?? 0;
    if (used >= this.maxMessages) throw new Error('message_budget_exhausted');
    this.seen.add(e.messageId); this.counts.set(e.sender.agentId, used + 1);
    this.messages.push(structuredClone(packet));
    return { accepted: true, receiptCommitment: digest({ salt: randomBytes(32).toString('hex'), envelope: e.envelopeDigestSha256 }) };
  }
  // In-process caller identity is authenticated by the company IPC session.
  read(agentId, channel) {
    if (!channelMembers[channel]?.includes(agentId)) throw new Error('channel_access_denied');
    return structuredClone(this.messages.filter(p => p.envelope.channelId === channel && p.envelope.recipient.agentId === agentId));
  }
}
