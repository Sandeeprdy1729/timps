use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader};
// ── Unified Graph Types ──────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UnifiedNode {
    pub id: String,
    pub label: String,
    pub layer: String,
    pub kind: String,
    pub size: f64,
    pub timestamp: i64,
    pub attributes: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UnifiedEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    pub relation: String,
    pub layer: String,
    pub weight: f64,
    pub timestamp: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LayerStats {
    pub nodes: usize,
    pub edges: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UnifiedGraph {
    pub nodes: Vec<UnifiedNode>,
    pub edges: Vec<UnifiedEdge>,
    pub stats: HashMap<String, LayerStats>,
}

// ── Helpers ──────────────────────────────────────────────────────────────

fn memory_dir(project_path: &str) -> String {
    let hash = project_hash_inner(project_path);
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    format!("{}/.timps/memory/{}", home, hash)
}

fn to_base36(mut n: u32) -> String {
    const DIGITS: &[u8; 36] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    if n == 0 { return "0".to_string(); }
    let mut result = Vec::new();
    while n > 0 {
        result.push(DIGITS[(n % 36) as usize]);
        n /= 36;
    }
    result.reverse();
    String::from_utf8(result).unwrap()
}

fn project_hash_inner(project_path: &str) -> String {
    let mut h: i32 = 0;
    for b in project_path.bytes() {
        h = h.wrapping_mul(31).wrapping_add(b as i32);
    }
    to_base36(h.unsigned_abs())
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

fn trim_label(s: &str, max: usize) -> String {
    if s.len() > max {
        format!("{}…", &s[..max])
    } else {
        s.to_string()
    }
}

// ── Layer Readers ────────────────────────────────────────────────────────

struct LayerResult {
    nodes: Vec<UnifiedNode>,
    edges: Vec<UnifiedEdge>,
}

fn read_json(path: &str) -> Option<serde_json::Value> {
    fs::read_to_string(path).ok().and_then(|s| serde_json::from_str(&s).ok())
}

// L1 – Working Memory
fn read_working(dir: &str) -> LayerResult {
    let mut nodes = Vec::new();
    let p = format!("{}/working.json", dir);
    if let Some(v) = read_json(&p) {
        if let Some(goals) = v["goals"].as_array() {
            for g in goals {
                if let Some(text) = g.as_str() {
                    let id = format!("working_goal_{}", nodes.len());
                    nodes.push(UnifiedNode {
                        id: id.clone(),
                        label: trim_label(text, 60),
                        layer: "L1-working".into(),
                        kind: "goal".into(),
                        size: 0.7,
                        timestamp: now_ms(),
                        attributes: [("text".into(), serde_json::json!(text))].into(),
                    });
                }
            }
        }
    }
    LayerResult { nodes, edges: vec![] }
}

// L2 – Episodic Memory
fn read_episodes(dir: &str) -> LayerResult {
    let mut nodes = Vec::new();
    let p = format!("{}/episodes.jsonl", dir);
    let file = match fs::File::open(&p) {
        Ok(f) => f,
        Err(_) => return LayerResult { nodes, edges: vec![] },
    };
    for line in BufReader::new(file).lines().filter_map(|l| l.ok()) {
        if line.trim().is_empty() { continue; }
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&line) {
            let id = v["id"].as_str().unwrap_or("").to_string();
            let summary = v["summary"].as_str().unwrap_or("").to_string();
            let ts = v["timestamp"].as_i64().unwrap_or(0);
            let outcome = v["outcome"].as_str().unwrap_or("unknown").to_string();
            let size = match outcome.as_str() {
                "success" => 0.9,
                "failure" => 0.7,
                "partial" => 0.5,
                _ => 0.4,
            };
            nodes.push(UnifiedNode {
                id: id.clone(),
                label: trim_label(&summary, 80),
                layer: "L2-episodic".into(),
                kind: outcome,
                size,
                timestamp: ts,
                attributes: [
                    ("summary".into(), serde_json::json!(summary)),
                ].into(),
            });
        }
    }
    LayerResult { nodes, edges: vec![] }
}

// L3 – Semantic Memory
fn read_semantic(dir: &str) -> LayerResult {
    let mut nodes = Vec::new();
    let mut edges = Vec::new();
    let p = format!("{}/semantic.json", dir);
    if let Some(arr) = read_json(&p).and_then(|v| v.as_array().cloned()) {
        for entry in &arr {
            let id = entry["id"].as_str().unwrap_or("").to_string();
            let content = entry["content"].as_str().unwrap_or("").to_string();
            let kind = entry["type"].as_str().or(entry["kind"].as_str()).unwrap_or("fact").to_string();
            let ts = entry["timestamp"].as_i64().unwrap_or(0);
            let score = entry["score"].as_f64().unwrap_or(0.5);
            let tags: Vec<String> = entry["tags"]
                .as_array()
                .map(|a| a.iter().filter_map(|t| t.as_str().map(|s| s.to_string())).collect())
                .unwrap_or_default();

            // Create a node per entry
            nodes.push(UnifiedNode {
                id: id.clone(),
                label: trim_label(&content, 80),
                layer: "L3-semantic".into(),
                kind: kind.clone(),
                size: score,
                timestamp: ts,
                attributes: [
                    ("content".into(), serde_json::json!(content)),
                    ("tags".into(), serde_json::json!(tags)),
                ].into(),
            });

            // Link semantic nodes to their domain tags
            for tag in &tags {
                if tag.len() > 2 && tag != "passive" && tag != "synthesized" && tag != "background" {
                    let tag_id = format!("tag_{}", tag);
                    edges.push(UnifiedEdge {
                        id: format!("sem_tag_{}_{}", id, tag),
                        source: id.clone(),
                        target: tag_id,
                        relation: "tagged".into(),
                        layer: "L3-semantic".into(),
                        weight: 0.5,
                        timestamp: ts,
                    });
                }
            }
        }
    }
    LayerResult { nodes, edges }
}

// L5 – ChronosForge (chronos/nodes.json + chronos/edges.json)
fn read_chronos(dir: &str) -> LayerResult {
    let mut nodes = Vec::new();
    let mut edges = Vec::new();
    let np = format!("{}/chronos/nodes.json", dir);
    if let Some(v) = read_json(&np) {
        // Could be array or map
        if let Some(arr) = v.as_array() {
            for entry in arr {
                let id = entry["id"].as_str().unwrap_or("").to_string();
                let content = entry["content"].as_str().unwrap_or("").to_string();
                let ts = entry["validFrom"].as_i64().or(entry["createdAt"].as_i64()).unwrap_or(0);
                let importance = entry["baseImportance"].as_f64().unwrap_or(0.5);
                nodes.push(UnifiedNode {
                    id: id.clone(),
                    label: trim_label(&content, 60),
                    layer: "L5-chronos".into(),
                    kind: "temporal".into(),
                    size: importance,
                    timestamp: ts,
                    attributes: [("content".into(), serde_json::json!(content))].into(),
                });
            }
        } else if let Some(map) = v.as_object() {
            for (_, val) in map {
                let id = val["id"].as_str().unwrap_or("").to_string();
                let content = val["content"].as_str().unwrap_or("").to_string();
                let ts = val["validFrom"].as_i64().or(val["createdAt"].as_i64()).unwrap_or(0);
                let importance = val["baseImportance"].as_f64().unwrap_or(0.5);
                nodes.push(UnifiedNode {
                    id: id.clone(),
                    label: trim_label(&content, 60),
                    layer: "L5-chronos".into(),
                    kind: "temporal".into(),
                    size: importance,
                    timestamp: ts,
                    attributes: [("content".into(), serde_json::json!(content))].into(),
                });
            }
        }
    }
    let ep = format!("{}/chronos/edges.json", dir);
    if let Some(v) = read_json(&ep) {
        if let Some(arr) = v.as_array() {
            for entry in arr {
                let from = entry["fromId"].as_str().unwrap_or("").to_string();
                let to = entry["toId"].as_str().unwrap_or("").to_string();
                let rel = entry["edgeType"].as_str().unwrap_or("related").to_string();
                let w = entry["weight"].as_f64().unwrap_or(0.5);
                let ts = entry["createdAt"].as_i64().unwrap_or(0);
                if !from.is_empty() && !to.is_empty() {
                    edges.push(UnifiedEdge {
                        id: format!("chronos_e_{}", edges.len()),
                        source: from,
                        target: to,
                        relation: rel,
                        layer: "L5-chronos".into(),
                        weight: w,
                        timestamp: ts,
                    });
                }
            }
        }
    }
    LayerResult { nodes, edges }
}

// L6 – ResonanceForge (resonance/resonance.json)
fn read_resonance(dir: &str) -> LayerResult {
    let mut nodes = Vec::new();
    let mut edges = Vec::new();
    let np = format!("{}/resonance/resonance.json", dir);
    if let Some(v) = read_json(&np) {
        if let Some(map) = v.as_object() {
            if let Some(ns) = map.get("nodes").and_then(|n| n.as_object()) {
                for (_, val) in ns {
                    let id = val["id"].as_str().unwrap_or("").to_string();
                    let content = val["content"].as_str().unwrap_or("").to_string();
                    let ts = val["validFrom"].as_i64().or(val["createdAt"].as_i64()).unwrap_or(0);
                    let amp = val["amplitude"].as_f64().unwrap_or(0.5);
                    nodes.push(UnifiedNode {
                        id: id.clone(),
                        label: trim_label(&content, 60),
                        layer: "L6-resonance".into(),
                        kind: "resonant".into(),
                        size: amp,
                        timestamp: ts,
                        attributes: [
                            ("content".into(), serde_json::json!(content)),
                            ("amplitude".into(), serde_json::json!(amp)),
                            ("frequency".into(), val["frequency"].as_f64().unwrap_or(0.0).into()),
                            ("phase".into(), val["phase"].as_f64().unwrap_or(0.0).into()),
                        ].into(),
                    });
                }
            }
            if let Some(es) = map.get("edges").and_then(|e| e.as_array()) {
                for entry in es {
                    let from = entry["fromId"].as_str().unwrap_or("").to_string();
                    let to = entry["toId"].as_str().unwrap_or("").to_string();
                    let rel = entry["edgeType"].as_str().unwrap_or("resonates").to_string();
                    let w = entry["weight"].as_f64().unwrap_or(0.5);
                    let ts = entry["createdAt"].as_i64().unwrap_or(0);
                    if !from.is_empty() && !to.is_empty() {
                        edges.push(UnifiedEdge {
                            id: format!("resonance_e_{}", edges.len()),
                            source: from,
                            target: to,
                            relation: rel,
                            layer: "L6-resonance".into(),
                            weight: w,
                            timestamp: ts,
                        });
                    }
                }
            }
        }
    }
    LayerResult { nodes, edges }
}

// L7 – EchoForge (echo/echoforge.json)
fn read_echo(dir: &str) -> LayerResult {
    let mut nodes = Vec::new();
    let mut edges = Vec::new();
    let p = format!("{}/echo/echoforge.json", dir);
    if let Some(v) = read_json(&p) {
        if let Some(ns) = v["nodes"].as_object() {
            for (_, val) in ns {
                let id = val["id"].as_str().unwrap_or("").to_string();
                let content = val["content"].as_str().unwrap_or("").to_string();
                let ts = val["validFrom"].as_i64().or(val["createdAt"].as_i64()).unwrap_or(0);
                let amp = val["echoAmp"].as_f64().unwrap_or(0.3);
                let salience = val["salience"].as_f64().unwrap_or(0.3);
                let domain = val["domain"].as_str().unwrap_or("general").to_string();
                nodes.push(UnifiedNode {
                    id: id.clone(),
                    label: trim_label(&content, 60),
                    layer: "L7-echo".into(),
                    kind: domain.clone(),
                    size: (amp + salience) / 2.0,
                    timestamp: ts,
                    attributes: [
                        ("content".into(), serde_json::json!(content)),
                        ("echoAmp".into(), serde_json::json!(amp)),
                        ("salience".into(), serde_json::json!(salience)),
                        ("domain".into(), serde_json::json!(&domain)),
                    ].into(),
                });
            }
        }
        if let Some(es) = v["edges"].as_array() {
            for entry in es {
                let from = entry["fromId"].as_str().unwrap_or("").to_string();
                let to = entry["toId"].as_str().unwrap_or("").to_string();
                let rel = entry["edgeType"].as_str().unwrap_or("echoes").to_string();
                let w = entry["weight"].as_f64().unwrap_or(0.5);
                let ts = entry["createdAt"].as_i64().unwrap_or(0);
                if !from.is_empty() && !to.is_empty() {
                    edges.push(UnifiedEdge {
                        id: format!("echo_e_{}", edges.len()),
                        source: from,
                        target: to,
                        relation: rel,
                        layer: "L7-echo".into(),
                        weight: w,
                        timestamp: ts,
                    });
                }
            }
        }
    }
    LayerResult { nodes, edges }
}

// L8 – SynapseQuench (synapse-quench-nodes.json + synapse-quench-edges.json)
fn read_synapse_quench(dir: &str) -> LayerResult {
    let mut nodes = Vec::new();
    let mut edges = Vec::new();
    let np = format!("{}/synapse-quench-nodes.json", dir);
    if let Some(arr) = read_json(&np).and_then(|v| v.as_array().cloned()) {
        for entry in &arr {
            let id = entry["id"].as_str().unwrap_or("").to_string();
            let content = entry["content"].as_str().unwrap_or("").to_string();
            let ts = entry["createdAt"].as_i64().unwrap_or(0);
            let amp = entry["amplitude"].as_f64().unwrap_or(0.5);
            nodes.push(UnifiedNode {
                id: id.clone(),
                label: trim_label(&content, 60),
                layer: "L8-synapse".into(),
                kind: "oscillator".into(),
                size: amp,
                timestamp: ts,
                attributes: [("content".into(), serde_json::json!(content))].into(),
            });
        }
    }
    let ep = format!("{}/synapse-quench-edges.json", dir);
    if let Some(arr) = read_json(&ep).and_then(|v| v.as_array().cloned()) {
        for entry in &arr {
            let from = entry["fromId"].as_str().unwrap_or("").to_string();
            let to = entry["toId"].as_str().unwrap_or("").to_string();
            let rel = entry["edgeType"].as_str().unwrap_or("couples").to_string();
            let w = entry["weight"].as_f64().unwrap_or(0.5);
            let ts = entry["createdAt"].as_i64().unwrap_or(0);
            if !from.is_empty() && !to.is_empty() {
                edges.push(UnifiedEdge {
                    id: format!("synapse_e_{}", edges.len()),
                    source: from,
                    target: to,
                    relation: rel,
                    layer: "L8-synapse".into(),
                    weight: w,
                    timestamp: ts,
                });
            }
        }
    }
    LayerResult { nodes, edges }
}

// L9 – HarmonicSheafWeaver (sheaf-weaver.json)
fn read_sheaf_weaver(dir: &str) -> LayerResult {
    let mut nodes = Vec::new();
    let mut edges = Vec::new();
    let p = format!("{}/sheaf-weaver.json", dir);
    if let Some(v) = read_json(&p) {
        if let Some(ns) = v["nodes"].as_object() {
            for (_, val) in ns {
                let id = val["id"].as_str().unwrap_or("").to_string();
                let content = val["content"].as_str().unwrap_or("").to_string();
                let ts = val["validFrom"].as_i64().or(val["createdAt"].as_i64()).unwrap_or(0);
                let amp = val["amplitude"].as_f64().unwrap_or(0.5);
                let freq = val["frequency"].as_f64().unwrap_or(0.0);
                let phase = val["phase"].as_f64().unwrap_or(0.0);
                let stalk_dim = val["stalkDim"].as_u64().unwrap_or(1);
                nodes.push(UnifiedNode {
                    id: id.clone(),
                    label: trim_label(&content, 60),
                    layer: "L9-sheaf".into(),
                    kind: "sheaf".into(),
                    size: amp,
                    timestamp: ts,
                    attributes: [
                        ("content".into(), serde_json::json!(content)),
                        ("amplitude".into(), serde_json::json!(amp)),
                        ("frequency".into(), serde_json::json!(freq)),
                        ("phase".into(), serde_json::json!(phase)),
                        ("stalkDim".into(), serde_json::json!(stalk_dim)),
                    ].into(),
                });
            }
        }
        if let Some(es) = v["edges"].as_array() {
            for entry in es {
                let from = entry["fromId"].as_str().unwrap_or("").to_string();
                let to = entry["toId"].as_str().unwrap_or("").to_string();
                let rel = entry["edgeType"].as_str().unwrap_or("connects").to_string();
                let w = entry["weight"].as_f64().unwrap_or(0.5);
                let ts = entry["createdAt"].as_i64().unwrap_or(0);
                if !from.is_empty() && !to.is_empty() {
                    edges.push(UnifiedEdge {
                        id: format!("sheaf_e_{}", edges.len()),
                        source: from,
                        target: to,
                        relation: rel,
                        layer: "L9-sheaf".into(),
                        weight: w,
                        timestamp: ts,
                    });
                }
            }
        }
    }
    LayerResult { nodes, edges }
}

// L10 – EngramLog (engram.log.jsonl)
fn read_engram(dir: &str) -> LayerResult {
    let mut nodes = Vec::new();
    let p = format!("{}/engram.log.jsonl", dir);
    let file = match fs::File::open(&p) {
        Ok(f) => f,
        Err(_) => return LayerResult { nodes, edges: vec![] },
    };
    for line in BufReader::new(file).lines().filter_map(|l| l.ok()) {
        if line.trim().is_empty() { continue; }
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&line) {
            let id = v["id"].as_str().map(|s| s.to_string()).or_else(|| v["index"].as_i64().map(|i| i.to_string())).unwrap_or_default();
            let op = v["op"].as_str().unwrap_or("log").to_string();
            let layer_id = v["layerId"].as_str().unwrap_or("unknown").to_string();
            let justification = v["justification"].as_str().unwrap_or("").to_string();
            nodes.push(UnifiedNode {
                id: if id.is_empty() { format!("engram_{}", nodes.len()) } else { id },
                label: format!("{}: {}", op, trim_label(&justification, 40)),
                layer: "L10-engram".into(),
                kind: op.clone(),
                    size: 0.3,
                    timestamp: v["index"].as_i64().unwrap_or(0),
                    attributes: [
                        ("operation".into(), serde_json::json!(&op)),
                    ("layerId".into(), serde_json::json!(layer_id)),
                    ("justification".into(), serde_json::json!(justification)),
                ].into(),
            });
        }
    }
    LayerResult { nodes, edges: vec![] }
}

// Intelligence Tools — read common tool files
fn read_intelligence_tools(dir: &str) -> LayerResult {
    let mut nodes = Vec::new();
    let edges = Vec::new();

    let tool_files: Vec<(&str, &str, &str)> = vec![
        ("contradiction_positions.json", "L3-contradiction", "claim"),
        ("decisions.json", "L3-regret", "decision"),
        ("burnout_signals.json", "L3-burnout", "signal"),
        ("code_incidents.json", "L3-techdebt", "incident"),
        ("bug_patterns.json", "L3-bugprophet", "pattern"),
        ("api_knowledge.json", "L3-apiarch", "quirk"),
        ("workflow_patterns.json", "L3-velocity", "pattern"),
        ("codebase_culture.json", "L3-archdrift", "insight"),
        ("learned_patterns.json", "L3-pattern", "pattern"),
        ("commitments.json", "L3-meeting", "commitment"),
        ("past_decisions.json", "L3-deadreckon", "decision"),
        ("manifesto_signals.json", "L3-manifesto", "value"),
        ("relationships.json", "L3-relationship", "contact"),
        ("institutional_memory.json", "L3-institutional", "contribution"),
        ("culture_decisions.json", "L3-anthropologist", "norm"),
        ("curriculum_log.json", "L3-curriculum", "gap"),
        ("conflict-resolutions.json", "L3-conflict", "resolution"),
    ];

    for (filename, layer, default_kind) in tool_files {
        let p = format!("{}/{}", dir, filename);
        if let Some(v) = read_json(&p) {
            if let Some(arr) = v.as_array() {
                for entry in arr {
                    let id = entry["id"].as_str().unwrap_or("").to_string();
                    let content = entry["content"].as_str().or(entry["text"].as_str()).or(entry["description"].as_str()).unwrap_or("").to_string();
                    let ts = entry["timestamp"].as_i64().or(entry["createdAt"].as_i64()).or(entry["created_at"].as_i64()).or(entry["last_seen"].as_i64()).unwrap_or(0);
                    let score = entry["score"].as_f64().or(entry["confidence"].as_f64()).or(entry["regret_score"].as_f64()).or(entry["success_rate"].as_f64()).unwrap_or(0.5);
                    let name = entry["name"].as_str().or(entry["entity"].as_str()).or(entry["api"].as_str()).or(entry["contact"].as_str()).unwrap_or("").to_string();

                    let label = if !name.is_empty() {
                        format!("{}: {}", name, trim_label(&content, 40))
                    } else {
                        trim_label(&content, 60)
                    };

                    if !id.is_empty() || !content.is_empty() {
                        let node_id = if id.is_empty() {
                            format!("tool_{}_{}", filename.trim_end_matches(".json"), nodes.len())
                        } else {
                            id.clone()
                        };
                        nodes.push(UnifiedNode {
                            id: node_id.clone(),
                            label,
                            layer: layer.into(),
                            kind: default_kind.into(),
                            size: score,
                            timestamp: ts,
                            attributes: [
                                ("content".into(), serde_json::json!(content)),
                                ("source".into(), serde_json::json!(filename)),
                            ].into(),
                        });
                    }
                }
            }
        }
    }

    LayerResult { nodes, edges }
}

// Existing Knowledge Graph (knowledge-graph.json)
fn read_knowledge_graph(dir: &str) -> LayerResult {
    let mut nodes = Vec::new();
    let mut edges = Vec::new();
    let p = format!("{}/knowledge-graph.json", dir);
    if let Some(v) = read_json(&p) {
        if let Some(ns) = v["nodes"].as_array() {
            for entry in ns {
                let id = entry["id"].as_str().unwrap_or("").to_string();
                let entity = entry["entity"].as_str().unwrap_or("").to_string();
                let etype = entry["entityType"].as_str().unwrap_or("concept").to_string();
                let ts = entry["createdAt"].as_i64().unwrap_or(0);
                let attrs = entry["attributes"].as_object().cloned().unwrap_or_default();
                nodes.push(UnifiedNode {
                    id: id.clone(),
                    label: entity,
                    layer: "kg-core".into(),
                    kind: etype,
                    size: 0.6,
                    timestamp: ts,
                    attributes: attrs.into_iter().map(|(k, v)| (k, v)).collect(),
                });
            }
        }
        if let Some(es) = v["edges"].as_array() {
            for entry in es {
                let id = entry["id"].as_str().unwrap_or("").to_string();
                let sub = entry["subject"].as_str().unwrap_or("").to_string();
                let obj = entry["object"].as_str().unwrap_or("").to_string();
                let rel = entry["relation"].as_str().unwrap_or("related").to_string();
                let w = entry["weight"].as_f64().unwrap_or(0.5);
                let ts = entry["timestamp"].as_i64().unwrap_or(0);
                if !sub.is_empty() && !obj.is_empty() {
                    edges.push(UnifiedEdge {
                        id: if id.is_empty() { format!("kg_e_{}", edges.len()) } else { id },
                        source: sub,
                        target: obj,
                        relation: rel,
                        layer: "kg-core".into(),
                        weight: w,
                        timestamp: ts,
                    });
                }
            }
        }
    }
    LayerResult { nodes, edges }
}

// AetherForgeERL (aether/aether.json)
fn read_aether(dir: &str) -> LayerResult {
    let mut nodes = Vec::new();
    let mut edges = Vec::new();
    let p = format!("{}/aether/aether.json", dir);
    if let Some(v) = read_json(&p) {
        if let Some(ns) = v["nodes"].as_object() {
            for (_, val) in ns {
                let id = val["id"].as_str().unwrap_or("").to_string();
                let content = val["content"].as_str().unwrap_or("").to_string();
                let ts = val["validFrom"].as_i64().or(val["createdAt"].as_i64()).unwrap_or(0);
                let amp = val["amplitude"].as_f64().unwrap_or(0.5);
                let status = val["status"].as_str().unwrap_or("active").to_string();
                nodes.push(UnifiedNode {
                    id: id.clone(),
                    label: trim_label(&content, 60),
                    layer: "sheaf-aether".into(),
                    kind: status.clone(),
                    size: amp,
                    timestamp: ts,
                    attributes: [
                        ("content".into(), serde_json::json!(content)),
                        ("amplitude".into(), serde_json::json!(amp)),
                        ("frequency".into(), val["frequency"].as_f64().unwrap_or(0.0).into()),
                        ("phase".into(), val["phase"].as_f64().unwrap_or(0.0).into()),
                        ("status".into(), serde_json::json!(&status)),
                        ("latticeLevel".into(), val["latticeLevel"].as_u64().unwrap_or(0).into()),
                    ].into(),
                });
            }
        }
        if let Some(es) = v["edges"].as_array() {
            for entry in es {
                let from = entry["fromId"].as_str().unwrap_or("").to_string();
                let to = entry["toId"].as_str().unwrap_or("").to_string();
                let rel = entry["edgeType"].as_str().unwrap_or("connects").to_string();
                let w = entry["weight"].as_f64().unwrap_or(0.5);
                let ts = entry["createdAt"].as_i64().unwrap_or(0);
                if !from.is_empty() && !to.is_empty() {
                    edges.push(UnifiedEdge {
                        id: format!("aether_e_{}", edges.len()),
                        source: from,
                        target: to,
                        relation: rel,
                        layer: "sheaf-aether".into(),
                        weight: w,
                        timestamp: ts,
                    });
                }
            }
        }
    }
    LayerResult { nodes, edges }
}

// ── Aggregator ───────────────────────────────────────────────────────────

/// Load all memory layer files and produce a unified knowledge graph
#[tauri::command]
pub fn load_unified_graph(project_path: String) -> UnifiedGraph {
    let dir = memory_dir(&project_path);
    let base = std::path::Path::new(&dir);
    if !base.exists() {
        return UnifiedGraph {
            nodes: vec![],
            edges: vec![],
            stats: HashMap::new(),
        };
    }

    let readers: Vec<(&str, fn(&str) -> LayerResult)> = vec![
        ("L1-working", read_working),
        ("L2-episodic", read_episodes),
        ("L3-semantic", read_semantic),
        ("L5-chronos", read_chronos),
        ("L6-resonance", read_resonance),
        ("L7-echo", read_echo),
        ("L8-synapse", read_synapse_quench),
        ("L9-sheaf", read_sheaf_weaver),
        ("L10-engram", read_engram),
        ("kg-core", read_knowledge_graph),
        ("sheaf-aether", read_aether),
        ("intelligence", read_intelligence_tools),
    ];

    let mut all_nodes = Vec::new();
    let mut all_edges = Vec::new();
    let mut stats = HashMap::new();

    for (name, reader) in readers {
        let result = reader(&dir);
        let n = result.nodes.len();
        let e = result.edges.len();
        if n > 0 || e > 0 {
            stats.insert(name.to_string(), LayerStats { nodes: n, edges: e });
        }
        all_nodes.extend(result.nodes);
        all_edges.extend(result.edges);
    }

    UnifiedGraph {
        nodes: all_nodes,
        edges: all_edges,
        stats,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_project_hash() {
        let p = "/Users/sandeepreddy/Desktop/testbot";
        let h = project_hash_inner(p);
        eprintln!("Hash for {:?} = {:?}", p, h);
        assert_eq!(h, "ywtobh", "hash should match CLIs polynomial+base36");
    }

    #[test]
    fn test_load_unified_graph() {
        let result = load_unified_graph("/Users/sandeepreddy/Desktop/testbot".to_string());
        eprintln!("Result: {} nodes, {} edges, {} layers", result.nodes.len(), result.edges.len(), result.stats.len());
        for (layer, s) in &result.stats {
            eprintln!("  layer {}: {} nodes, {} edges", layer, s.nodes, s.edges);
        }
        assert!(result.nodes.len() > 0, "should have at least 1 node");
    }
}
