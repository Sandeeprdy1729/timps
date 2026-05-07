//! ACP — Agent Communication Protocol for TIMPS.
//!
//! ACP lets multiple TIMPS agent instances communicate by sending structured
//! messages over an in-process channel bus or a TCP socket.
//!
//! Message types:
//!   - Task         — delegate a task to another agent
//!   - Result       — return a result from a delegated task  
//!   - MemoryShare  — share a semantic memory entry with another agent
//!   - Broadcast    — announce information to all connected agents
//!   - Heartbeat    — liveness check

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, mpsc, RwLock};
use uuid::Uuid;
use chrono::Utc;

// ── ACP Message types ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AcpMessage {
    Task {
        id: String,
        from: String,
        to: String,
        prompt: String,
        context: Option<String>,
    },
    Result {
        task_id: String,
        from: String,
        to: String,
        output: String,
        success: bool,
    },
    MemoryShare {
        from: String,
        key: String,
        value: String,
        importance: f32,
        tags: Vec<String>,
    },
    Broadcast {
        from: String,
        content: String,
    },
    Heartbeat {
        agent_id: String,
        timestamp: String,
    },
}

impl AcpMessage {
    pub fn task(from: &str, to: &str, prompt: &str, context: Option<String>) -> Self {
        AcpMessage::Task {
            id: Uuid::new_v4().to_string(),
            from: from.to_string(),
            to: to.to_string(),
            prompt: prompt.to_string(),
            context,
        }
    }

    pub fn result(task_id: &str, from: &str, to: &str, output: &str, success: bool) -> Self {
        AcpMessage::Result {
            task_id: task_id.to_string(),
            from: from.to_string(),
            to: to.to_string(),
            output: output.to_string(),
            success,
        }
    }

    pub fn heartbeat(agent_id: &str) -> Self {
        AcpMessage::Heartbeat {
            agent_id: agent_id.to_string(),
            timestamp: Utc::now().to_rfc3339(),
        }
    }
}

// ── ACP Bus — in-process message broker ────────────────────────────────────

/// In-process multi-agent message bus.
/// Each agent registers a named inbox. Messages are routed by agent ID.
pub struct AcpBus {
    /// agent_id → mpsc sender for their inbox
    inboxes: Arc<RwLock<HashMap<String, mpsc::Sender<AcpMessage>>>>,
    /// broadcast channel for group messages
    broadcast_tx: broadcast::Sender<AcpMessage>,
}

impl AcpBus {
    pub fn new() -> Self {
        let (broadcast_tx, _) = broadcast::channel(256);
        Self {
            inboxes: Arc::new(RwLock::new(HashMap::new())),
            broadcast_tx,
        }
    }

    /// Register an agent on the bus. Returns their inbox receiver.
    pub async fn register(&self, agent_id: &str) -> mpsc::Receiver<AcpMessage> {
        let (tx, rx) = mpsc::channel(64);
        self.inboxes.write().await.insert(agent_id.to_string(), tx);
        rx
    }

    /// Unregister an agent from the bus.
    pub async fn unregister(&self, agent_id: &str) {
        self.inboxes.write().await.remove(agent_id);
    }

    /// Send a direct message to a specific agent. Returns Err if agent not found.
    pub async fn send(&self, message: AcpMessage) -> Result<()> {
        let to = match &message {
            AcpMessage::Task { to, .. } => to.clone(),
            AcpMessage::Result { to, .. } => to.clone(),
            _ => anyhow::bail!("send() is only for direct messages (Task/Result). Use broadcast() for others."),
        };
        let inboxes = self.inboxes.read().await;
        let tx = inboxes.get(&to)
            .ok_or_else(|| anyhow::anyhow!("Agent not found on bus: {to}"))?;
        tx.send(message).await.map_err(|e| anyhow::anyhow!("Send failed: {e}"))?;
        Ok(())
    }

    /// Broadcast a message to all connected agents.
    pub fn broadcast(&self, message: AcpMessage) {
        let _ = self.broadcast_tx.send(message);
    }

    /// Subscribe to the broadcast channel.
    pub fn subscribe_broadcast(&self) -> broadcast::Receiver<AcpMessage> {
        self.broadcast_tx.subscribe()
    }

    /// List all registered agent IDs.
    pub async fn agents(&self) -> Vec<String> {
        self.inboxes.read().await.keys().cloned().collect()
    }
}

impl Default for AcpBus {
    fn default() -> Self { Self::new() }
}

// ── ACP Swarm — orchestrates multiple agents ────────────────────────────────

/// Orchestrates a group of named agent roles over ACP.
pub struct AcpSwarm {
    pub bus: Arc<AcpBus>,
    /// role_name → agent_id mapping
    roles: Arc<RwLock<HashMap<String, String>>>,
}

impl AcpSwarm {
    pub fn new() -> Self {
        Self {
            bus: Arc::new(AcpBus::new()),
            roles: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Assign a role to an agent ID.
    pub async fn assign_role(&self, role: &str, agent_id: &str) {
        self.roles.write().await.insert(role.to_string(), agent_id.to_string());
    }

    /// Send a task to a role (e.g. "planner", "coder", "reviewer").
    pub async fn delegate_to_role(&self, from_role: &str, to_role: &str, prompt: &str) -> Result<()> {
        let roles = self.roles.read().await;
        let from_id = roles.get(from_role).cloned().unwrap_or_else(|| from_role.to_string());
        let to_id = roles.get(to_role)
            .ok_or_else(|| anyhow::anyhow!("Role not found: {to_role}"))?
            .clone();
        drop(roles);
        let msg = AcpMessage::task(&from_id, &to_id, prompt, None);
        self.bus.send(msg).await
    }

    pub async fn roles(&self) -> Vec<(String, String)> {
        self.roles.read().await.iter().map(|(k, v)| (k.clone(), v.clone())).collect()
    }
}

impl Default for AcpSwarm {
    fn default() -> Self { Self::new() }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_bus_register_and_send() {
        let bus = AcpBus::new();
        let mut rx = bus.register("agent-b").await;

        let msg = AcpMessage::task("agent-a", "agent-b", "do something", None);
        bus.send(msg).await.unwrap();

        let received = rx.recv().await.unwrap();
        if let AcpMessage::Task { from, prompt, .. } = received {
            assert_eq!(from, "agent-a");
            assert_eq!(prompt, "do something");
        } else {
            panic!("Wrong message type");
        }
    }

    #[tokio::test]
    async fn test_bus_broadcast() {
        let bus = AcpBus::new();
        let mut sub = bus.subscribe_broadcast();
        bus.broadcast(AcpMessage::heartbeat("agent-a"));
        let msg = sub.recv().await.unwrap();
        assert!(matches!(msg, AcpMessage::Heartbeat { .. }));
    }

    #[tokio::test]
    async fn test_swarm_role_delegation() {
        let swarm = AcpSwarm::new();
        let _rx = swarm.bus.register("coder-1").await;
        swarm.assign_role("coder", "coder-1").await;
        swarm.assign_role("planner", "planner-1").await;

        // delegation to a registered role should succeed
        let _rx_planner = swarm.bus.register("planner-1").await;
        swarm.delegate_to_role("planner", "coder", "implement feature X").await.unwrap();
    }
}
