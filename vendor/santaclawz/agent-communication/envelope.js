import { canonicalDigest } from "../hashing/digest.js";
const HEX_64 = /^[a-f0-9]{64}$/;
function sanitizeIdentifier(value, fallback, maxLength = 160) {
    const trimmed = value?.trim();
    if (!trimmed) {
        return fallback;
    }
    return trimmed.slice(0, maxLength);
}
function sanitizeOptionalIdentifier(value, maxLength = 160) {
    const trimmed = value?.trim();
    return trimmed ? trimmed.slice(0, maxLength) : undefined;
}
function sanitizeStringList(values, maxLength = 48) {
    if (!values) {
        return undefined;
    }
    const normalized = Array.from(new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean)))
        .map((value) => value.slice(0, maxLength));
    return normalized.length > 0 ? normalized : undefined;
}
function sanitizeParty(party) {
    const agentId = sanitizeIdentifier(party.agentId, "");
    if (!agentId) {
        throw new Error("Agent message envelope party requires agentId.");
    }
    const output = { agentId };
    const sessionId = sanitizeOptionalIdentifier(party.sessionId);
    const operatorId = sanitizeOptionalIdentifier(party.operatorId);
    const publicKey = sanitizeOptionalIdentifier(party.publicKey, 240);
    const endpointHint = sanitizeOptionalIdentifier(party.endpointHint, 240);
    if (sessionId)
        output.sessionId = sessionId;
    if (operatorId)
        output.operatorId = operatorId;
    if (publicKey)
        output.publicKey = publicKey;
    if (endpointHint)
        output.endpointHint = endpointHint;
    return output;
}
function sanitizeMarketplaceTags(tags) {
    if (!tags) {
        return undefined;
    }
    const normalized = {};
    const capabilityTags = sanitizeStringList(tags.capabilityTags);
    const jobTags = sanitizeStringList(tags.jobTags);
    const inputTags = sanitizeStringList(tags.inputTags);
    const outputTags = sanitizeStringList(tags.outputTags);
    if (capabilityTags)
        normalized.capabilityTags = capabilityTags;
    if (jobTags)
        normalized.jobTags = jobTags;
    if (inputTags)
        normalized.inputTags = inputTags;
    if (outputTags)
        normalized.outputTags = outputTags;
    return Object.keys(normalized).length > 0 ? normalized : undefined;
}
function sanitizePermissionScope(scope) {
    if (!scope) {
        return undefined;
    }
    const output = { lane: scope.lane };
    const allowedActions = sanitizeStringList(scope.allowedActions);
    const expiresAtIso = sanitizeOptionalIdentifier(scope.expiresAtIso, 64);
    if (allowedActions)
        output.allowedActions = allowedActions;
    if (expiresAtIso)
        output.expiresAtIso = expiresAtIso;
    if (scope.policyDigestSha256 && HEX_64.test(scope.policyDigestSha256)) {
        output.policyDigestSha256 = scope.policyDigestSha256;
    }
    return output;
}
function sanitizePayload(payload) {
    const body = payload.body?.trim();
    const digestSha256 = payload.digestSha256 && HEX_64.test(payload.digestSha256)
        ? payload.digestSha256
        : body
            ? canonicalDigest({ body }).sha256Hex
            : undefined;
    const output = { mode: payload.mode };
    const mediaType = sanitizeOptionalIdentifier(payload.mediaType, 120);
    const uri = sanitizeOptionalIdentifier(payload.uri, 500);
    const artifactManifestUrl = sanitizeOptionalIdentifier(payload.artifactManifestUrl, 500);
    if (mediaType)
        output.mediaType = mediaType;
    if (body && payload.mode === "inline")
        output.body = body.slice(0, 8000);
    if (digestSha256)
        output.digestSha256 = digestSha256;
    if (uri)
        output.uri = uri;
    if (artifactManifestUrl)
        output.artifactManifestUrl = artifactManifestUrl;
    if (payload.artifactBundleDigestSha256 && HEX_64.test(payload.artifactBundleDigestSha256)) {
        output.artifactBundleDigestSha256 = payload.artifactBundleDigestSha256;
    }
    if (payload.encryption) {
        const encryption = {
            scheme: payload.encryption.scheme
        };
        const keyId = sanitizeOptionalIdentifier(payload.encryption.keyId, 160);
        const recipientPublicKey = sanitizeOptionalIdentifier(payload.encryption.recipientPublicKey, 240);
        if (keyId)
            encryption.keyId = keyId;
        if (recipientPublicKey)
            encryption.recipientPublicKey = recipientPublicKey;
        output.encryption = encryption;
    }
    return output;
}
function sanitizeZekoAnchor(anchor) {
    const output = { anchorMode: anchor?.anchorMode ?? "aggregate" };
    const candidateId = sanitizeOptionalIdentifier(anchor?.candidateId);
    const batchId = sanitizeOptionalIdentifier(anchor?.batchId);
    const txHash = sanitizeOptionalIdentifier(anchor?.txHash, 120);
    if (candidateId)
        output.candidateId = candidateId;
    if (batchId)
        output.batchId = batchId;
    if (anchor?.rootDigestSha256 && HEX_64.test(anchor.rootDigestSha256))
        output.rootDigestSha256 = anchor.rootDigestSha256;
    if (txHash)
        output.txHash = txHash;
    if (anchor?.network)
        output.network = anchor.network;
    return output;
}
export function buildAgentMessageEnvelope(input) {
    const sentAtIso = sanitizeIdentifier(input.sentAtIso, new Date().toISOString(), 64);
    const threadId = sanitizeIdentifier(input.threadId, `thread_${canonicalDigest({
        sender: input.sender.agentId,
        sentAtIso,
        payload: input.payload
    }).sha256Hex.slice(0, 24)}`);
    const draft = {
        schemaVersion: "santaclawz-agent-message-envelope/1.0",
        messageId: sanitizeIdentifier(input.messageId, ""),
        threadId,
        sentAtIso,
        kind: input.kind ?? "dispatch",
        visibility: input.visibility ?? "digest-only",
        sender: sanitizeParty(input.sender),
        payload: sanitizePayload(input.payload),
        zekoAnchor: sanitizeZekoAnchor(input.zekoAnchor)
    };
    const parentMessageId = sanitizeOptionalIdentifier(input.parentMessageId);
    const channelId = sanitizeOptionalIdentifier(input.channelId);
    const swarmId = sanitizeOptionalIdentifier(input.swarmId);
    const permissionScope = sanitizePermissionScope(input.permissionScope);
    const marketplaceTags = sanitizeMarketplaceTags(input.marketplaceTags);
    const protocolLaneTags = sanitizeStringList(input.protocolLaneTags);
    const marketplaceIntentTags = sanitizeStringList(input.marketplaceIntentTags);
    if (parentMessageId)
        draft.parentMessageId = parentMessageId;
    if (channelId)
        draft.channelId = channelId;
    if (swarmId)
        draft.swarmId = swarmId;
    if (input.recipient)
        draft.recipient = sanitizeParty(input.recipient);
    if (permissionScope)
        draft.permissionScope = permissionScope;
    if (marketplaceTags)
        draft.marketplaceTags = marketplaceTags;
    if (protocolLaneTags)
        draft.protocolLaneTags = protocolLaneTags;
    if (marketplaceIntentTags)
        draft.marketplaceIntentTags = marketplaceIntentTags;
    const messageId = draft.messageId || `msg_${canonicalDigest({ ...draft, messageId: "" }).sha256Hex.slice(0, 24)}`;
    const withoutDigest = {
        ...draft,
        messageId
    };
    return {
        ...withoutDigest,
        envelopeDigestSha256: canonicalDigest(withoutDigest).sha256Hex
    };
}
export function digestAgentMessageEnvelope(envelope) {
    const { envelopeDigestSha256: _existingDigest, ...withoutDigest } = envelope;
    return canonicalDigest(withoutDigest).sha256Hex;
}
export function assertValidAgentMessageEnvelope(envelope) {
    if (envelope.schemaVersion !== "santaclawz-agent-message-envelope/1.0") {
        throw new Error("Unsupported agent message envelope schemaVersion.");
    }
    if (!envelope.messageId || !envelope.threadId || !envelope.sender?.agentId) {
        throw new Error("Agent message envelope requires messageId, threadId, and sender.agentId.");
    }
    const expectedDigest = digestAgentMessageEnvelope(envelope);
    if (envelope.envelopeDigestSha256 !== expectedDigest) {
        throw new Error("Agent message envelope digest does not match canonical payload.");
    }
    if (envelope.payload.mode !== "inline" && !envelope.payload.digestSha256 && !envelope.payload.uri && !envelope.payload.artifactManifestUrl) {
        throw new Error("Non-inline agent message envelopes require a digest, URI, or artifact manifest reference.");
    }
    return envelope;
}
export function publicAgentMessageEnvelopeView(envelope) {
    const payload = {
        mode: envelope.payload.mode,
        ...(envelope.payload.mediaType ? { mediaType: envelope.payload.mediaType } : {}),
        ...(envelope.payload.digestSha256 ? { digestSha256: envelope.payload.digestSha256 } : {}),
        ...(envelope.payload.uri && envelope.visibility !== "private" ? { uri: envelope.payload.uri } : {}),
        ...(envelope.payload.artifactManifestUrl && envelope.visibility !== "private" ? { artifactManifestUrl: envelope.payload.artifactManifestUrl } : {}),
        ...(envelope.payload.artifactBundleDigestSha256 ? { artifactBundleDigestSha256: envelope.payload.artifactBundleDigestSha256 } : {}),
        ...(envelope.visibility === "public" && envelope.payload.mode === "inline" && envelope.payload.body ? { body: envelope.payload.body } : {})
    };
    return {
        schemaVersion: "santaclawz-agent-message-envelope-public/1.0",
        messageId: envelope.messageId,
        threadId: envelope.threadId,
        ...(envelope.parentMessageId ? { parentMessageId: envelope.parentMessageId } : {}),
        ...(envelope.channelId ? { channelId: envelope.channelId } : {}),
        ...(envelope.swarmId ? { swarmId: envelope.swarmId } : {}),
        sentAtIso: envelope.sentAtIso,
        kind: envelope.kind,
        visibility: envelope.visibility,
        sender: envelope.sender,
        ...(envelope.recipient ? { recipient: envelope.recipient } : {}),
        ...(envelope.permissionScope ? { permissionScope: envelope.permissionScope } : {}),
        ...(envelope.marketplaceTags ? { marketplaceTags: envelope.marketplaceTags } : {}),
        ...(envelope.protocolLaneTags ? { protocolLaneTags: envelope.protocolLaneTags } : {}),
        ...(envelope.marketplaceIntentTags ? { marketplaceIntentTags: envelope.marketplaceIntentTags } : {}),
        payload,
        zekoAnchor: envelope.zekoAnchor,
        envelopeDigestSha256: envelope.envelopeDigestSha256
    };
}
