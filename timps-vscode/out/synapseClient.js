"use strict";
// ── TIMPS VSCode → SynapseMetabolon Server Integration ───
// Enables VSCode extension to trigger spreading activation metabolic graph queries
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendToSynapseMetabolon = sendToSynapseMetabolon;
exports.querySynapseMetabolon = querySynapseMetabolon;
exports.getSynapseStats = getSynapseStats;
exports.getSynapseGraph = getSynapseGraph;
exports.runConsolidationCycle = runConsolidationCycle;
exports.createMetabolicSignal = createMetabolicSignal;
const SERVER_URL = process.env.TIMPS_SERVER_URL || 'http://localhost:3000';
async function sendToSynapseMetabolon(signal) {
    try {
        const res = await fetch(`${SERVER_URL}/api/synapse/ingest`, {
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
async function querySynapseMetabolon(query, userId, projectId) {
    try {
        const res = await fetch(`${SERVER_URL}/api/synapse/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, userId, projectId: projectId || 'default' }),
            signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
            return { summary: '', activatedNodes: [], confidence: 0, refusal: true, auditLog: [] };
        }
        return res.json();
    }
    catch {
        return { summary: '', activatedNodes: [], confidence: 0, refusal: true, auditLog: [] };
    }
}
async function getSynapseStats(userId, projectId) {
    try {
        const res = await fetch(`${SERVER_URL}/api/synapse/stats/${userId}?projectId=${projectId || 'default'}`, {
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
async function getSynapseGraph(userId, limit = 50) {
    try {
        const res = await fetch(`${SERVER_URL}/api/synapse/graph/${userId}?limit=${limit}`, {
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
async function runConsolidationCycle(userId, projectId) {
    try {
        const res = await fetch(`${SERVER_URL}/api/synapse/consolidate/${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: projectId || 'default' }),
            signal: AbortSignal.timeout(10000),
        });
        if (!res.ok)
            return null;
        return res.json();
    }
    catch {
        return null;
    }
}
function createMetabolicSignal(content, sourceModule, userId = 1, tags = []) {
    return {
        userId,
        content,
        tags,
        metadata: { source: 'timps-vscode' },
        sourceModule,
    };
}
