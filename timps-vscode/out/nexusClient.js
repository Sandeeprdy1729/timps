"use strict";
// ── TIMPS VSCode → NexusForge Server Integration ───
// Enables VSCode extension to trigger server-side episodic memory evolution
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendToNexusForge = sendToNexusForge;
exports.queryNexusForge = queryNexusForge;
exports.getNexusForgeStats = getNexusForgeStats;
exports.getNexusForgeGraph = getNexusForgeGraph;
exports.createNexusSignal = createNexusSignal;
exports.detectCodingEntities = detectCodingEntities;
const SERVER_URL = process.env.TIMPS_SERVER_URL || 'http://localhost:3000';
async function sendToNexusForge(signal) {
    try {
        const res = await fetch(`${SERVER_URL}/api/nexus/ingest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(signal),
            signal: AbortSignal.timeout(5000),
        });
        return res.ok;
    }
    catch {
        return false;
    }
}
async function queryNexusForge(query, userId) {
    try {
        const res = await fetch(`${SERVER_URL}/api/nexus/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, userId }),
            signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
            return { results: [], refusal: true, confidence: 0 };
        }
        return res.json();
    }
    catch {
        return { results: [], refusal: true, confidence: 0 };
    }
}
async function getNexusForgeStats(userId) {
    try {
        const res = await fetch(`${SERVER_URL}/api/nexus/stats/${userId}`, {
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok)
            return null;
        return res.json();
    }
    catch {
        return null;
    }
}
async function getNexusForgeGraph(userId, limit = 50) {
    try {
        const res = await fetch(`${SERVER_URL}/api/nexus/graph/${userId}?limit=${limit}`, {
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok)
            return null;
        return res.json();
    }
    catch {
        return null;
    }
}
function createNexusSignal(content, sourceModule, userId = 1, tags = []) {
    return {
        userId,
        content,
        tags,
        metadata: { source: 'timps-vscode' },
        sourceModule,
    };
}
function detectCodingEntities(content) {
    const tags = ['code'];
    const lower = content.toLowerCase();
    if (/bug|error|crash|exception|failed/.test(lower))
        tags.push('bug');
    if (/debt|legacy|refactor|complex/.test(lower))
        tags.push('tech-debt');
    if (/api|endpoint|webhook|route/.test(lower))
        tags.push('api');
    if (/test|fail|pass|assert/.test(lower))
        tags.push('testing');
    if (/security|vuln|xss|injection/.test(lower))
        tags.push('security');
    if (/burnout|stress|tired|overwhelmed/.test(lower))
        tags.push('burnout');
    if (/team|colleague|review|handoff/.test(lower))
        tags.push('relationship');
    return tags;
}
