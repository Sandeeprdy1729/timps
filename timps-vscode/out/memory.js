"use strict";
// ============================================================
// TIMPS 3-Layer Memory System (ported from timps-code)
// Layer 1: Working  (active session state)
// Layer 2: Episodic (conversation history)  
// Layer 3: Semantic (long-term facts/patterns)
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIMPsMemory = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class TIMPsMemory {
    constructor(storagePath) {
        this.dir = path.join(storagePath, 'timps-memory');
        this.semanticFile = path.join(this.dir, 'semantic.json');
        this.episodicFile = path.join(this.dir, 'episodes.jsonl');
        this.workingFile = path.join(this.dir, 'working.json');
        this.working = { activeFiles: [], recentErrors: [], discoveredPatterns: [] };
    }
    async init() {
        fs.mkdirSync(this.dir, { recursive: true });
        this.working = this.loadWorking();
    }
    // ── Layer 1: Working Memory ──────────────────────────────
    get workingMemory() { return this.working; }
    setGoal(goal) {
        this.working.currentGoal = goal;
        this.saveWorking();
    }
    trackFile(filePath) {
        if (!this.working.activeFiles.includes(filePath)) {
            this.working.activeFiles.push(filePath);
            if (this.working.activeFiles.length > 20)
                this.working.activeFiles.shift();
            this.saveWorking();
        }
    }
    trackError(error) {
        this.working.recentErrors.push(error.slice(0, 200));
        if (this.working.recentErrors.length > 10)
            this.working.recentErrors.shift();
        this.saveWorking();
    }
    // ── Layer 2: Episodic Memory ─────────────────────────────
    storeEpisode(ep) {
        const entry = {
            id: genId(),
            timestamp: new Date().toISOString(),
            ...ep
        };
        try {
            fs.appendFileSync(this.episodicFile, JSON.stringify(entry) + '\n', 'utf-8');
            this.trimEpisodic(100);
        }
        catch { }
    }
    loadEpisodes(count = 10) {
        try {
            if (!fs.existsSync(this.episodicFile))
                return [];
            const lines = fs.readFileSync(this.episodicFile, 'utf-8').trim().split('\n');
            return lines.slice(-count).map(l => { try {
                return JSON.parse(l);
            }
            catch {
                return null;
            } }).filter(Boolean);
        }
        catch {
            return [];
        }
    }
    // ── Layer 3: Semantic Memory ─────────────────────────────
    async store(entry) {
        const entries = this.loadSemanticEntries();
        const now = new Date().toISOString();
        const mem = {
            id: genId(),
            content: entry.content.slice(0, 500),
            type: entry.type || 'explicit',
            importance: entry.importance || 2,
            tags: entry.tags || [],
            accessCount: 0,
            confidence: 0.8,
            createdAt: now,
            updatedAt: now
        };
        entries.push(mem);
        // Trim to 300 entries, lowest importance first
        if (entries.length > 300) {
            entries.sort((a, b) => b.importance - a.importance);
            entries.splice(300);
        }
        this.saveSemanticEntries(entries);
        return mem;
    }
    async search(query, limit = 5) {
        if (!query.trim())
            return [];
        const entries = this.loadSemanticEntries();
        const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const scored = entries.map(e => {
            const text = e.content.toLowerCase();
            let score = 0;
            for (const w of words) {
                if (text.includes(w))
                    score += w.length * (e.importance || 1);
            }
            return { entry: e, score };
        }).filter(x => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
        // Update access counts
        if (scored.length > 0) {
            for (const { entry } of scored) {
                entry.accessCount++;
                entry.updatedAt = new Date().toISOString();
            }
            this.saveSemanticEntries(entries);
        }
        return scored.map(x => x.entry);
    }
    async audit(limit = 20) {
        const entries = this.loadSemanticEntries();
        return [...entries]
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, limit);
    }
    async forget(keyword) {
        const entries = this.loadSemanticEntries();
        const kw = keyword.toLowerCase();
        const before = entries.length;
        const filtered = entries.filter(e => !e.content.toLowerCase().includes(kw) && !e.tags.some(t => t.toLowerCase().includes(kw)));
        if (filtered.length < before)
            this.saveSemanticEntries(filtered);
        return before - filtered.length;
    }
    async reflect(userMsg, response) {
        const patterns = [
            /(?:I (?:use|prefer|like|work with|am building|always))\s+(.{5,60})/i,
            /(?:my (?:project|stack|tech|framework|language|preference) is)\s+(.{5,60})/i,
            /(?:remember|important|note):\s+(.{5,100})/i,
        ];
        const combined = `${userMsg} ${response}`;
        for (const p of patterns) {
            const m = combined.match(p);
            if (m?.[0]) {
                await this.store({ content: m[0].slice(0, 300), type: 'reflection', importance: 3, tags: ['auto'] });
                break;
            }
        }
    }
    buildContext(memories, episodes) {
        const parts = [];
        if (memories.length > 0) {
            parts.push('## TIMPS Memory (long-term)');
            for (const m of memories) {
                parts.push(`- [${m.type}⭐${m.importance}] ${m.content}`);
            }
        }
        if (episodes.length > 0) {
            parts.push('\n## Recent Sessions');
            for (const ep of episodes.slice(-3)) {
                parts.push(`- ${new Date(ep.timestamp).toLocaleDateString()}: ${ep.summary}`);
            }
        }
        if (this.working.activeFiles.length > 0) {
            parts.push(`\n## Active Files\n${this.working.activeFiles.slice(-5).join(', ')}`);
        }
        if (this.working.discoveredPatterns.length > 0) {
            parts.push(`\n## Discovered Patterns\n${this.working.discoveredPatterns.slice(-5).join(', ')}`);
        }
        return parts.join('\n');
    }
    close() {
        this.saveWorking();
    }
    // ── Private ───────────────────────────────────────────────
    loadWorking() {
        try {
            if (fs.existsSync(this.workingFile))
                return JSON.parse(fs.readFileSync(this.workingFile, 'utf-8'));
        }
        catch { }
        return { activeFiles: [], recentErrors: [], discoveredPatterns: [] };
    }
    saveWorking() {
        try {
            fs.writeFileSync(this.workingFile, JSON.stringify(this.working, null, 2));
        }
        catch { }
    }
    loadSemanticEntries() {
        try {
            if (fs.existsSync(this.semanticFile))
                return JSON.parse(fs.readFileSync(this.semanticFile, 'utf-8'));
        }
        catch { }
        return [];
    }
    saveSemanticEntries(entries) {
        try {
            fs.writeFileSync(this.semanticFile, JSON.stringify(entries, null, 2));
        }
        catch { }
    }
    trimEpisodic(max) {
        try {
            const lines = fs.readFileSync(this.episodicFile, 'utf-8').trim().split('\n');
            if (lines.length > max)
                fs.writeFileSync(this.episodicFile, lines.slice(-max).join('\n') + '\n');
        }
        catch { }
    }
}
exports.TIMPsMemory = TIMPsMemory;
function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
