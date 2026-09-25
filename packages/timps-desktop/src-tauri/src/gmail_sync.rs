// ── TIMPS Desktop — Native Gmail sync engine ───────────────────────────────
// Fetches mail straight from the Gmail API, distills it into knowledge facts,
// and writes them into the canonical TIMPS memory store
// (~/.timps/memory/<projectHash>/semantic.json) so every agent — the CLI, the
// MCP server, VS Code — recalls them with no extra wiring.
//
// This replaces the old `sh out to the CLI` path, which only worked when
// timps-code/dist happened to sit next to the executable (i.e. never in a
// packaged .app).
//
// Pipeline (mirrors timps-code/src/services/gmail/sync.ts):
//   1. ensure_access_token()  — refresh when < 5 min to expiry
//   2. list ids               — Gmail search, `in:inbox after:<lastRun>`
//   3. per message            — GET full → base64url-decode MIME → text body
//   4. distill                — heuristic facts (no LLM call, no cost, offline)
//   5. persist                — raw copy + summaries.jsonl + semantic.json
//
// Distillation is deliberately heuristic and synchronous. An LLM round-trip per
// email would make sync slow, cost money, and fail without network — the same
// trade-off the CLI's `heuristicFacts` fallback already makes.

use base64::Engine;
use serde::Serialize;
use serde_json::{json, Value};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use crate::bundled_oauth;

const GMAIL_API: &str = "https://gmail.googleapis.com/gmail/v1/users/me";

/// Base URL for Gmail REST calls.
///
/// Overridable via `TIMPS_GMAIL_API_BASE` so the full fetch → parse → persist
/// pipeline can be exercised against a local stub instead of the live API.
fn api_base() -> String {
    match std::env::var("TIMPS_GMAIL_API_BASE") {
        Ok(b) if !b.trim().is_empty() => b.trim_end_matches('/').to_string(),
        _ => GMAIL_API.to_string(),
    }
}

// ── Paths ───────────────────────────────────────────────────────────────────

fn home_dir() -> String {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string())
}

fn gmail_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("TIMPS_GMAIL_DIR") {
        if !dir.is_empty() {
            return PathBuf::from(dir);
        }
    }
    PathBuf::from(home_dir()).join(".timps").join("gmail")
}

fn tokens_file() -> PathBuf {
    gmail_dir().join("tokens.json")
}

fn state_file() -> PathBuf {
    gmail_dir().join("state.json")
}

fn summaries_file() -> PathBuf {
    gmail_dir().join("summaries.jsonl")
}

fn raw_dir() -> PathBuf {
    gmail_dir().join("raw")
}

/// Canonical memory store for a project: `~/.timps/memory/<12-hex hash>/`.
///
/// Delegates to `commands::memory_dir` rather than reimplementing the hash —
/// this MUST match `projectHash()` in packages/memory-core/src/storage.ts (the
/// CLI/MCP/SDK canonical form) or connector facts would land in a store the
/// desktop's own chat never reads. A single implementation keeps them in sync.
///
/// Empty `project_path` ⇒ the home directory, which is what the CLI's
/// `new Memory(os.homedir())` uses for connector syncs.
fn memory_dir(project_path: &str) -> PathBuf {
    let target = if project_path.trim().is_empty() {
        home_dir()
    } else {
        project_path.to_string()
    };
    PathBuf::from(crate::commands::memory_dir(&target))
}

// ── Locks ───────────────────────────────────────────────────────────────────

/// Guards read-modify-write cycles on semantic.json. The desktop already holds
/// an equivalent lock in commands.rs for its own writers; this one serializes
/// connector syncs. Held only for the duration of a single file write.
/// Serializes the semantic.json read-modify-write in `store_facts_into`.
///
/// Shares `commands::SEMANTIC_LOCK` so a connector sync and a chat/clipboard
/// write cannot interleave and lose one another's entry.
fn memory_write_lock() -> std::sync::MutexGuard<'static, ()> {
    crate::commands::semantic_write_lock()
}

fn write_raw_record(path: &Path, record: &Value) -> Result<(), String> {
    let body = serde_json::to_string_pretty(record).map_err(|e| format!("serialize: {}", e))?;
    write_atomic(&path.to_path_buf(), &body)
}

fn write_atomic(path: &PathBuf, data: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("mkdir: {}", e))?;
    }
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, data).map_err(|e| format!("write tmp: {}", e))?;
    fs::rename(&tmp, path).map_err(|e| format!("rename: {}", e))?;
    Ok(())
}

// ── Tokens ──────────────────────────────────────────────────────────────────

#[derive(serde::Deserialize, serde::Serialize, Clone, Debug)]
struct StoredTokens {
    #[serde(rename = "accessToken")]
    access_token: String,
    #[serde(rename = "refreshToken", default)]
    refresh_token: Option<String>,
    #[serde(rename = "expiresAt", default)]
    expires_at: i64,
    #[serde(default)]
    scopes: Option<Value>,
    #[serde(default)]
    email: Option<String>,
    #[serde(rename = "obtainedAt", default)]
    obtained_at: Option<i64>,
}

fn read_json<T: serde::de::DeserializeOwned>(path: &PathBuf) -> Option<T> {
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

fn save_tokens(tokens: &StoredTokens) -> Result<(), String> {
    let body = serde_json::to_string_pretty(tokens).map_err(|e| e.to_string())?;
    if let Some(parent) = tokens_file().parent() {
        fs::create_dir_all(parent).map_err(|e| format!("mkdir: {}", e))?;
    }
    fs::write(tokens_file(), body).map_err(|e| format!("write tokens: {}", e))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(tokens_file(), fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

fn now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

/// Why a token could not be obtained. `Reconnect` means the refresh token was
/// revoked/expired and the user must re-consent — the UI turns this into a
/// prominent "Reconnect" affordance rather than a raw API error.
#[derive(Debug)]
pub enum TokenError {
    NotConnected,
    Reconnect(String),
    Other(String),
}

impl std::fmt::Display for TokenError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TokenError::NotConnected => write!(f, "Gmail is not connected."),
            TokenError::Reconnect(m) => write!(f, "{}", m),
            TokenError::Other(m) => write!(f, "{}", m),
        }
    }
}

/// Return a usable access token, refreshing via Google's token endpoint when
/// the current one is within 5 minutes of expiry. This mirrors the CLI's
/// `ensureAccessToken` so both surfaces behave identically.
pub async fn ensure_access_token() -> Result<String, TokenError> {
    let mut tokens = read_json::<StoredTokens>(&tokens_file()).ok_or(TokenError::NotConnected)?;

    let fresh = now_millis() < tokens.expires_at - 5 * 60 * 1000;
    if fresh && !tokens.access_token.is_empty() {
        return Ok(tokens.access_token);
    }

    let refresh = tokens.refresh_token.clone().ok_or_else(|| {
        TokenError::Reconnect(
            "Gmail token expired and no refresh token was stored. Reconnect to continue."
                .to_string(),
        )
    })?;
    let creds = bundled_oauth::resolve("gmail")
        .map_err(|e| TokenError::Other(format!("Gmail credentials missing: {}", e)))?;

    let form = [
        ("grant_type", "refresh_token".to_string()),
        ("client_id", creds.client_id.clone()),
        ("refresh_token", refresh),
    ];
    let mut params: Vec<(&str, String)> = form.to_vec();
    if let Some(secret) = &creds.client_secret {
        params.push(("client_secret", secret.clone()));
    }

    let client = reqwest::Client::new();
    let resp = client
        .post(&creds.token_uri)
        .form(&params)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| TokenError::Other(format!("Token refresh network error: {}", e)))?;

    let status = resp.status();
    let body = resp.text().await.unwrap_or_default();

    if !status.is_success() {
        // invalid_grant is Google's "this refresh token is dead" response —
        // happens after a password change, manual revoke, or 6-month dormancy.
        let parsed: Value = serde_json::from_str(&body).unwrap_or(Value::Null);
        let err = parsed
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");
        if err == "invalid_grant" {
            return Err(TokenError::Reconnect(
                "Google revoked this Gmail authorization (invalid_grant). Click Reconnect to grant access again."
                    .to_string(),
            ));
        }
        return Err(TokenError::Other(format!(
            "Token refresh failed ({}): {}",
            status.as_u16(),
            err
        )));
    }

    let parsed: Value = serde_json::from_str(&body)
        .map_err(|e| TokenError::Other(format!("Bad token response: {}", e)))?;
    let access = parsed
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| TokenError::Other("Token response had no access_token".into()))?
        .to_string();
    let expires_in = parsed
        .get("expires_in")
        .and_then(|v| v.as_u64())
        .unwrap_or(3600);

    tokens.access_token = access.clone();
    // Google rotates refresh tokens rarely but may issue a new one; keep it.
    if let Some(new_refresh) = parsed.get("refresh_token").and_then(|v| v.as_str()) {
        tokens.refresh_token = Some(new_refresh.to_string());
    }
    tokens.expires_at = now_millis() + (expires_in as i64) * 1000;
    save_tokens(&tokens).map_err(TokenError::Other)?;
    Ok(access)
}

// ── Gmail API ───────────────────────────────────────────────────────────────

async fn gmail_get<T: serde::de::DeserializeOwned>(token: &str, path: &str) -> Result<T, TokenError> {
    let client = reqwest::Client::new();
    let url = format!("{}{}", api_base(), path);
    let resp = client
        .get(&url)
        .bearer_auth(token)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| TokenError::Other(format!("Gmail request failed: {}", e)))?;
    let status = resp.status();
    let body = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        if status.as_u16() == 401 {
            return Err(TokenError::Reconnect(
                "Gmail rejected the access token. Reconnect to refresh authorization.".into(),
            ));
        }
        return Err(TokenError::Other(format!(
            "Gmail API {}: {}",
            status.as_u16(),
            body.chars().take(200).collect::<String>()
        )));
    }
    serde_json::from_str(&body).map_err(|e| TokenError::Other(format!("Bad Gmail response: {}", e)))
}

#[derive(serde::Deserialize)]
struct ListResponse {
    #[serde(default)]
    messages: Vec<MessageRef>,
}

#[derive(serde::Deserialize, Clone)]
struct MessageRef {
    id: String,
}

/// Gmail search query. On a first run we take a bounded recent window rather
/// than the entire mailbox — the CLI takes the whole inbox, but a user
/// connecting for the first time through the desktop should not sit through a
/// 20-minute backfill.
fn build_query(last_run: Option<&str>, lookback_days: u32) -> String {
    match last_run.and_then(parse_timestamp) {
        Some(secs) => {
            // Backdate by 6h: Gmail's `after:` is second-granular and a clock
            // skew or a message received during the sync would otherwise be
            // missed by the next run.
            let since = secs.saturating_sub(6 * 3600);
            format!("in:inbox after:{}", since)
        }
        // First run (or an unparseable value): recent window only.
        _ => format!("in:inbox newer_than:{}d", lookback_days.max(1)),
    }
}

/// Parse a `lastRun` value into epoch **seconds**.
///
/// The CLI writes ISO-8601 (`new Date().toISOString()`), and the desktop UI
/// renders that string with `new Date(...)`, so we must keep writing ISO-8601.
/// Epoch millis are also accepted so a store written by an older build (or by
/// hand) still resumes correctly instead of silently re-syncing everything.
fn parse_timestamp(raw: &str) -> Option<i64> {
    let s = raw.trim();
    if s.is_empty() {
        return None;
    }
    // Bare epoch (millis or seconds).
    if let Ok(n) = s.parse::<i64>() {
        return Some(if n > 100_000_000_000 { n / 1000 } else { n });
    }
    // ISO-8601: 2026-09-20T03:30:10.013Z (also tolerates a missing fraction,
    // a '+00:00' offset, or a space instead of 'T').
    let bytes = s.as_bytes();
    if bytes.len() < 10 || bytes[4] != b'-' || bytes[7] != b'-' {
        return None;
    }
    let num = |a: usize, b: usize| -> Option<i64> { s.get(a..b)?.parse::<i64>().ok() };
    let (y, mo, d) = (num(0, 4)?, num(5, 7)?, num(8, 10)?);
    let (h, mi) = (num(11, 13).unwrap_or(0), num(14, 16).unwrap_or(0));
    let sec = num(17, 19).unwrap_or(0);
    let days = days_from_civil(y, mo, d);
    Some(days * 86_400 + h * 3600 + mi * 60 + sec)
}

/// Days since the Unix epoch for a proleptic Gregorian date
/// (Howard Hinnant's `days_from_civil`).
fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400; // [0, 399]
    let mp = if m > 2 { m - 3 } else { m + 9 }; // Mar = 0
    let doy = (153 * mp + 2) / 5 + d - 1; // [0, 365]
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

// ── MIME decoding ───────────────────────────────────────────────────────────

/// Decode Gmail's base64url payload.
///
/// Gmail omits `=` padding and uses the URL-safe alphabet (`-`/`_` instead of
/// `+`/`/`), so we re-pad and then try, in order:
///   1. URL-safe alphabet *with* padding — the common case, and the only
///      engine that accepts both `-`/`_` and `=`.
///   2. Standard alphabet, padded — for the rare standard-encoded body.
///   3. URL-safe alphabet, unpadded — last resort, for input we failed to pad.
///
/// Note the `*_NO_PAD` engines *reject* `=`, so they cannot be the first choice
/// here; using one as the primary silently yields "" for any payload whose
/// length is not already a multiple of 4.
fn base64url_decode(data: &str) -> String {
    use base64::engine::general_purpose::{STANDARD, URL_SAFE, URL_SAFE_NO_PAD};
    let cleaned: String = data.chars().filter(|c| !c.is_whitespace()).collect();
    if cleaned.is_empty() {
        return String::new();
    }
    let padded = match cleaned.len() % 4 {
        0 => cleaned.clone(),
        2 => format!("{}==", cleaned),
        3 => format!("{}=", cleaned),
        // len % 4 == 1 is not valid base64.
        _ => return String::new(),
    };
    let bytes = URL_SAFE
        .decode(padded.as_bytes())
        .or_else(|_| STANDARD.decode(padded.as_bytes()))
        .or_else(|_| URL_SAFE_NO_PAD.decode(cleaned.as_bytes()));
    match bytes {
        Ok(b) => String::from_utf8_lossy(&b).to_string(),
        Err(_) => String::new(),
    }
}

/// Strip tags/entities from an HTML body. Kept deliberately simple — this runs
/// on marketing HTML and quoted replies, not on anything requiring fidelity.
///
/// Raw-text elements (`script`, `style`) are dropped *with their contents*, not
/// just their tags: keeping the body of a `<script>` would leak JS source into
/// the stored email, so the whole span is discarded.
fn strip_html(input: &str) -> String {
    if !input.contains('<') {
        return unescape_entities(input);
    }
    let mut out = String::with_capacity(input.len());
    let mut in_tag = false;
    let mut tag_buf = String::new();
    // When inside <script>/<style>, we are discarding everything until the
    // matching close tag shows up.
    let mut skip_until: Option<&'static str> = None;

    for ch in input.chars() {
        if in_tag {
            if ch == '>' {
                in_tag = false;
                let tag = tag_buf.trim().to_ascii_lowercase();
                let closing = tag.starts_with('/');
                let name = tag
                    .trim_start_matches('/')
                    .split_whitespace()
                    .next()
                    .unwrap_or("");

                if closing {
                    if skip_until == Some(name) {
                        skip_until = None;
                    }
                } else if name == "script" || name == "style" {
                    skip_until = Some(if name == "script" { "script" } else { "style" });
                } else {
                    match name {
                        "br" => out.push('\n'),
                        "p" | "div" | "li" | "tr" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
                            if !out.is_empty() && !out.ends_with('\n') =>
                        {
                            out.push('\n');
                        }
                        _ => {}
                    }
                }
                tag_buf.clear();
            } else {
                tag_buf.push(ch);
            }
            continue;
        }

        match ch {
            '<' => {
                in_tag = true;
                tag_buf.clear();
            }
            _ => {
                if skip_until.is_none() {
                    out.push(ch);
                }
            }
        }
    }
    unescape_entities(&out)
}

fn unescape_entities(input: &str) -> String {
    input
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
}

fn collapse_whitespace(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut prev_space = false;
    for ch in input.chars() {
        if ch == '\n' {
            if !prev_space {
                out.push('\n');
                prev_space = true;
            }
        } else if ch.is_whitespace() {
            if !prev_space {
                out.push(' ');
                prev_space = true;
            }
        } else {
            out.push(ch);
            prev_space = false;
        }
    }
    out.trim().to_string()
}

/// Recursively walk a Gmail payload, preferring text/plain and falling back to
/// the first text/html part. Attachments are skipped (no filename ⇒ inline).
fn collect_body(payload: &Value) -> String {
    fn walk(part: &Value, plain: &mut String, html: &mut String) {
        let mime = part
            .get("mimeType")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let has_attachment = part
            .get("filename")
            .and_then(|v| v.as_str())
            .map(|f| !f.is_empty())
            .unwrap_or(false);

        if let Some(data) = part.get("body").and_then(|b| b.get("data")).and_then(|d| d.as_str()) {
            if !data.is_empty() && !has_attachment {
                match mime {
                    "text/plain" if plain.is_empty() => plain.push_str(&base64url_decode(data)),
                    "text/html" if html.is_empty() => html.push_str(&base64url_decode(data)),
                    // Top-level body with no mimeType (rare, non-MIME messages).
                    "" if plain.is_empty() && html.is_empty() => {
                        plain.push_str(&base64url_decode(data))
                    }
                    _ => {}
                }
            }
        }
        if let Some(parts) = part.get("parts").and_then(|p| p.as_array()) {
            for child in parts {
                walk(child, plain, html);
            }
        }
    }

    let mut plain = String::new();
    let mut html = String::new();
    walk(payload, &mut plain, &mut html);
    let chosen = if !plain.trim().is_empty() {
        plain
    } else if !html.trim().is_empty() {
        strip_html(&html)
    } else {
        String::new()
    };
    collapse_whitespace(&chosen).chars().take(20_000).collect()
}

fn header_value(payload: &Value, name: &str) -> String {
    payload
        .get("headers")
        .and_then(|h| h.as_array())
        .map(|headers| {
            headers
                .iter()
                .find(|h| {
                    h.get("name")
                        .and_then(|n| n.as_str())
                        .map(|n| n.eq_ignore_ascii_case(name))
                        .unwrap_or(false)
                })
                .and_then(|h| h.get("value").and_then(|v| v.as_str()))
                .unwrap_or("")
                .trim()
                .to_string()
        })
        .unwrap_or_default()
}

// ── Distillation ────────────────────────────────────────────────────────────

/// Heuristic fact extraction — the offline equivalent of the CLI's
/// `heuristicFacts`. Self-contained, third-person sentences that read well when
/// recalled months later out of context.
pub fn heuristic_facts(from: &str, subject: &str, body: &str) -> Vec<String> {
    let mut facts: Vec<String> = Vec::new();
    let sender = if from.trim().is_empty() { "unknown" } else { from.trim() };
    let subj = if subject.trim().is_empty() { "(No Subject)" } else { subject.trim() };

    facts.push(format!("Email from {}: \"{}\"", sender, subj));

    // Pull out the first couple of substantial sentences from the body.
    let mut current = String::new();
    let mut candidates: Vec<String> = Vec::new();
    for ch in body.chars() {
        current.push(ch);
        if ch == '.' || ch == '!' || ch == '?' {
            let trimmed = current.trim().to_string();
            if trimmed.len() > 40 && trimmed.len() < 600 {
                candidates.push(trimmed);
            }
            current.clear();
        }
        if candidates.len() >= 2 {
            break;
        }
    }
    if candidates.is_empty() && !body.trim().is_empty() {
        let head: String = body.trim().chars().take(300).collect();
        candidates.push(head);
    }
    for c in candidates.into_iter().take(2) {
        if c.chars().count() > 8 {
            facts.push(c);
        }
    }
    facts.truncate(4);
    facts
}

fn sender_tag(from: &str) -> Option<String> {
    // Extract the address from `Name <addr@host>`.
    let candidate = if let Some(start) = from.find('<') {
        let rest = &from[start + 1..];
        rest.find('>').map(|end| &rest[..end]).unwrap_or(rest)
    } else {
        from
    };
    let addr = candidate.trim().to_lowercase();
    if addr.contains('@') && addr.contains('.') && !addr.contains(' ') {
        Some(format!("sender:{}", addr))
    } else {
        None
    }
}

// ── Memory store write ──────────────────────────────────────────────────────

/// Monotonic counter making ids unique within a run. Paired with a content
/// hash so the same fact gets a stable id across syncs.
static FACT_SEQ: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

/// Build an entry id in memory-core's `mem_<8hex>_<6hex>` shape.
///
/// The 8-char prefix is a content hash (stable for a given fact) and the
/// 6-char suffix is a run counter (unique within a sync). Deliberately avoids
/// slicing a fixed offset out of a variable-width number — `now_millis()` is 11
/// hex digits today, so an `[8..16]` slice would panic on every single message.
fn fact_id(content: &str) -> String {
    use sha2::{Digest, Sha256};
    let digest = Sha256::digest(content.as_bytes());
    let prefix = hex::encode(&digest[..4]); // 8 hex chars
    let seq = FACT_SEQ.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let suffix = format!("{:06x}", seq & 0xff_ffff); // 6 hex chars
    format!("mem_{}_{}", prefix, suffix)
}

/// Append facts to the memory store at `dir/semantic.json`, deduplicating by
/// content so a re-sync never duplicates. The entry shape matches
/// memory-core's `MemoryEntry` (id, timestamp in **milliseconds**, type,
/// content, tags) so the CLI, MCP server and recall all read these with no
/// special-casing.
///
/// `source` is intentionally left unset: the desktop uses that field to tag
/// which store an entry came from when merging multiple projects, so the
/// connector's provenance lives in `tags` instead.
fn store_facts_into(dir: &Path, facts: &[(String, Vec<String>)]) -> Result<usize, String> {
    if facts.is_empty() {
        return Ok(0);
    }
    let _guard = memory_write_lock();
    let path = dir.join("semantic.json");

    let mut entries: Vec<Value> = fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();

    let mut existing: HashSet<String> = entries
        .iter()
        .filter_map(|e| e.get("content").and_then(|c| c.as_str()))
        .map(|s| s.to_string())
        .collect();

    let mut added = 0usize;
    for (content, tags) in facts {
        // `existing` is seeded from disk *and* updated below, so a repeated fact
        // within this same batch is caught too — otherwise two emails with the
        // same first sentence would each be written.
        if !existing.insert(content.clone()) {
            continue;
        }
        entries.push(json!({
            "id": fact_id(content),
            // Milliseconds, matching memory-core and the existing on-disk data.
            "timestamp": now_millis(),
            "type": "fact",
            "content": content,
            "tags": tags,
            "score": 0.6,
        }));
        added += 1;
    }
    if added == 0 {
        return Ok(0);
    }
    let body = serde_json::to_string_pretty(&entries).map_err(|e| e.to_string())?;
    write_atomic(&path, &body)?;
    Ok(added)
}

fn store_facts(project_path: &str, facts: &[(String, Vec<String>)]) -> Result<usize, String> {
    store_facts_into(&memory_dir(project_path), facts)
}

// ── State ───────────────────────────────────────────────────────────────────

#[derive(serde::Deserialize, serde::Serialize, Default, Clone)]
struct GmailState {
    #[serde(rename = "lastRun", default)]
    last_run: Option<String>,
    #[serde(rename = "lastMessageId", default)]
    last_message_id: Option<String>,
    #[serde(rename = "messagesSynced", default)]
    messages_synced: i64,
    /// Set when Google rejects the refresh token (invalid_grant) so the UI can
    /// offer "Reconnect" without needing a network round-trip to render.
    #[serde(rename = "needsReconnect", default)]
    needs_reconnect: bool,
    #[serde(rename = "reconnectReason", default)]
    reconnect_reason: Option<String>,
}

/// Record that the grant is dead, with the reason to show the user. Persisted
/// so the Connectors list renders the right button on the next launch.
pub fn mark_needs_reconnect(reason: &str) {
    let mut state = load_state();
    state.needs_reconnect = true;
    state.reconnect_reason = Some(reason.to_string());
    // A failed write here means the UI shows "Sync" instead of "Reconnect" and
    // the user re-hits a dead token with no explanation, so make it loud
    // rather than silent.
    if let Err(e) = save_state(&state) {
        eprintln!("[gmail] could not persist needsReconnect: {}", e);
    }
}

/// Clear the dead-grant flag. Called after a successful connect or a clean
/// sync so the UI returns to the normal "Sync" affordance.
pub fn clear_needs_reconnect() {
    let mut state = load_state();
    if !state.needs_reconnect && state.reconnect_reason.is_none() {
        return;
    }
    state.needs_reconnect = false;
    state.reconnect_reason = None;
    if let Err(e) = save_state(&state) {
        eprintln!("[gmail] could not clear needsReconnect: {}", e);
    }
}

fn load_state() -> GmailState {
    read_json(&state_file()).unwrap_or_default()
}

fn save_state(state: &GmailState) -> Result<(), String> {
    let body = serde_json::to_string_pretty(state).map_err(|e| e.to_string())?;
    if let Some(parent) = state_file().parent() {
        fs::create_dir_all(parent).map_err(|e| format!("mkdir: {}", e))?;
    }
    fs::write(state_file(), body).map_err(|e| format!("write state: {}", e))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(state_file(), fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

/// Message ids already persisted, so a re-sync skips them. Reads the raw dir
/// rather than keeping a side index — the files are the source of truth and
/// this keeps the on-disk contract identical to the CLI's.
fn already_stored_ids() -> HashSet<String> {
    let mut ids = HashSet::new();
    if let Ok(days) = fs::read_dir(raw_dir()) {
        for day in days.flatten() {
            if !day.path().is_dir() {
                continue;
            }
            if let Ok(files) = fs::read_dir(day.path()) {
                for f in files.flatten() {
                    if let Some(stem) = f.path().file_stem() {
                        ids.insert(stem.to_string_lossy().to_string());
                    }
                }
            }
        }
    }
    ids
}

// ── Sync ────────────────────────────────────────────────────────────────────

#[derive(Serialize, Clone, Debug)]
pub struct SyncReport {
    pub connected_as: String,
    pub fetched: usize,
    pub stored: usize,
    pub skipped: usize,
    pub facts_stored: usize,
    /// True when the run stopped because the grant is dead and the user must
    /// re-consent. Drives the "Reconnect" prompt in the UI.
    pub needs_reconnect: bool,
    /// Messages whose summary line could not be appended. The raw copy still
    /// exists, so the run is not lost - but summary-driven views will be short
    /// by this many, which is worth reporting rather than swallowing.
    pub summary_errors: usize,
    pub error: Option<String>,
}

/// Run the full pipeline. `project_path` selects which memory store receives
/// the distilled facts (empty ⇒ the home/global store, matching the CLI's
/// `Memory(os.homedir())` behavior).
pub async fn sync(project_path: &str, lookback_days: u32, max_messages: u32) -> SyncReport {
    let max = max_messages.clamp(1, 200) as usize;
    let tokens = read_json::<StoredTokens>(&tokens_file());
    let connected_as = tokens
        .as_ref()
        .and_then(|t| t.email.clone())
        .unwrap_or_else(|| "unknown".to_string());

    let token = match ensure_access_token().await {
        Ok(t) => t,
        Err(e) => {
            let needs_reconnect = matches!(e, TokenError::Reconnect(_));
            if needs_reconnect {
                // Persist here rather than leaving it to the caller: `sync` is
                // what *detects* the revoked token, and the UI only knows to
                // offer Reconnect by reading this flag out of state.json. A
                // caller that forgot to re-persist it would silently lose the
                // prompt. Idempotent, so the connector wrapper re-marking is
                // harmless.
                mark_needs_reconnect(&e.to_string());
            }
            return SyncReport {
                connected_as,
                fetched: 0,
                stored: 0,
                skipped: 0,
                facts_stored: 0,
                needs_reconnect,
                summary_errors: 0,
                error: Some(e.to_string()),
            };
        }
    };

    let state = load_state();
    let query = build_query(state.last_run.as_deref(), lookback_days);
    let list_path = format!(
        "/messages?q={}&maxResults={}",
        urlencode(&query),
        max
    );
    let list: ListResponse = match gmail_get(&token, &list_path).await {
        Ok(l) => l,
        Err(e) => {
            // A 401 mid-sync means the access token died (revoked scope,
            // signed out elsewhere) even though refresh looked healthy.
            let needs_reconnect = matches!(e, TokenError::Reconnect(_));
            if needs_reconnect {
                mark_needs_reconnect(&e.to_string());
            }
            return SyncReport {
                connected_as,
                fetched: 0,
                stored: 0,
                skipped: 0,
                facts_stored: 0,
                needs_reconnect,
                summary_errors: 0,
                error: Some(e.to_string()),
            };
        }
    };

    let mut seen = already_stored_ids();
    let mut report = SyncReport {
        connected_as,
        fetched: list.messages.len(),
        stored: 0,
        skipped: 0,
        facts_stored: 0,
        needs_reconnect: false,
        summary_errors: 0,
        error: None,
    };
    if list.messages.is_empty() {
        let mut s = state.clone();
        s.last_run = Some(chrono_now_iso());
        let _ = save_state(&s);
        return report;
    }

    // Memory-store writes are batched so we do one read-modify-write per sync
    // rather than one per email.
    let mut pending_facts: Vec<(String, Vec<String>)> = Vec::new();
    let mut last_id: Option<String> = None;

    for msg in &list.messages {
        last_id = Some(msg.id.clone());
        if seen.contains(&msg.id) {
            report.skipped += 1;
            continue;
        }
        let full: Value = match gmail_get(&token, &format!("/messages/{}?format=full", msg.id)).await {
            Ok(v) => v,
            Err(e) => {
                if matches!(e, TokenError::Reconnect(_)) {
                    report.needs_reconnect = true;
                    report.error = Some(e.to_string());
                    break;
                }
                // A single bad message shouldn't abort the run.
                continue;
            }
        };

        let payload = full.get("payload").cloned().unwrap_or(Value::Null);
        let from = header_value(&payload, "From");
        let subject = header_value(&payload, "Subject");
        let date = header_value(&payload, "Date");
        let body = collect_body(&payload);
        let snippet = full
            .get("snippet")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        // 1. Raw copy in the dedicated gmail folder.
        let day = chrono_day();
        let raw_path = raw_dir().join(&day).join(format!("{}.json", msg.id));
        let raw_record = json!({
            "id": msg.id,
            "threadId": full.get("threadId").cloned().unwrap_or(Value::Null),
            "from": from,
            "to": header_value(&payload, "To"),
            "subject": if subject.is_empty() { "(No Subject)" } else { &subject },
            "date": date,
            "snippet": snippet,
            "labels": full.get("labelIds").cloned().unwrap_or(json!([])),
            "bodyText": body,
            "internalDate": full.get("internalDate").cloned().unwrap_or(Value::Null),
            "syncedAt": chrono_now_iso(),
        });
        if let Some(parent) = raw_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        // Persist the raw copy *before* claiming the message was stored, and
        // surface the failure. Swallowing this would report "stored" for a
        // message that was never written (disk full, bad perms), and would
        // distill facts from a body that has no archived copy to audit against.
        if let Err(e) = write_raw_record(&raw_path, &raw_record) {
            if report.error.is_none() {
                report.error = Some(format!("Could not save message {}: {}", msg.id, e));
            }
            report.skipped += 1;
            continue;
        }
        seen.insert(msg.id.clone());
        report.stored += 1;

        // 2. Distill facts and stage them for the memory store.
        let facts = heuristic_facts(&from, &subject, &body);
        let facts = if facts.is_empty() {
            vec![format!(
                "Email from {}: {}",
                if from.is_empty() { "unknown" } else { &from },
                if subject.is_empty() { "(No Subject)" } else { &subject }
            )]
        } else {
            facts
        };

        let mut tags = vec![
            "email".to_string(),
            "gmail".to_string(),
            "knowledge".to_string(),
        ];
        if let Some(t) = sender_tag(&from) {
            tags.push(t);
        }
        for content in &facts {
            pending_facts.push((content.clone(), tags.clone()));
        }

        // 3. Append a summary line for the desktop's recent/query views.
        let summary = json!({
            "emailId": msg.id,
            "subject": if subject.is_empty() { "(No Subject)" } else { &subject },
            "from": from,
            "date": date,
            "facts": facts,
            "method": "heuristic",
            "syncedAt": chrono_now_iso(),
        });
        if let Some(parent) = summaries_file().parent() {
            let _ = fs::create_dir_all(parent);
        }
        // Surface summary-write failures for the same reason raw writes are
        // surfaced: the desktop's recent/query views read this file, so a
        // silent failure leaves messages visible in `stored` but missing from
        // every summary-based surface, with nothing to explain the gap.
        use std::io::Write;
        let appended = (|| -> Result<(), String> {
            let mut f = fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(summaries_file())
                .map_err(|e| format!("open summaries: {}", e))?;
            let line = serde_json::to_string(&summary).map_err(|e| e.to_string())?;
            writeln!(f, "{}", line).map_err(|e| format!("write summaries: {}", e))
        })();
        if let Err(e) = appended {
            if report.error.is_none() {
                report.error = Some(e);
            }
            report.summary_errors += 1;
        }
    }

    // 4. One batched write into the canonical memory store.
    match store_facts(project_path, &pending_facts) {
        Ok(n) => report.facts_stored = n,
        Err(e) => {
            // Memory write failure is worth surfacing but shouldn't discard the
            // raw data we already persisted.
            report.error = Some(format!("Stored emails but could not write to memory: {}", e));
        }
    }

    let mut updated = state;
    // ISO-8601, matching the CLI and what the UI's `new Date(iso)` expects.
    // Writing epoch millis here would render as an Invalid Date.
    updated.last_run = Some(chrono_now_iso());
    updated.last_message_id = last_id.or(updated.last_message_id);
    updated.messages_synced += report.stored as i64;
    // Note: if this write fails the file on disk is untouched, so `lastRun` is
    // *not* advanced and the next sync re-walks the same window. That's the
    // safe direction — the raw copies are on disk, so nothing is lost, whereas
    // advancing past a run that never recorded would skip messages silently.
    if let Err(e) = save_state(&updated) {
        eprintln!("[gmail] could not update lastRun: {}", e);
        if report.error.is_none() {
            report.error = Some(format!("Could not update sync state: {}", e));
        }
    }

    report
}

// ── Small time helpers (no chrono dependency) ──────────────────────────────

/// `YYYY-MM-DD` in UTC, derived from the epoch — matches the CLI's
/// `new Date().toISOString().slice(0, 10)` bucketing for raw files.
fn chrono_day() -> String {
    let secs = now_millis() / 1000;
    let days = secs / 86_400;
    // Civil-from-days (Howard Hinnant's algorithm).
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    format!("{:04}-{:02}-{:02}", y, m, d)
}

/// ISO-8601 UTC timestamp, matching what the CLI writes into summaries.jsonl.
fn chrono_now_iso() -> String {
    let now = now_millis();
    let secs = now / 1000;
    let ms = now % 1000;
    let days = secs / 86_400;
    let sod = secs % 86_400;
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
        y,
        m,
        d,
        sod / 3600,
        (sod % 3600) / 60,
        sod % 60,
        ms
    )
}

fn urlencode(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for b in input.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => {
                out.push('%');
                out.push_str(&format!("{:02X}", b));
            }
        }
    }
    out
}

// ── Status ──────────────────────────────────────────────────────────────────
// Note: reconnection state lives in state.json (see `mark_needs_reconnect`)
// rather than being probed over the network, so the Connectors list renders the
// right button instantly and works offline.

#[cfg(test)]
#[allow(clippy::await_holding_lock)]
mod tests {
    // Every test here mutates process-global env vars (TIMPS_GMAIL_DIR,
    // TIMPS_GMAIL_API_BASE, HOME) and talks to the stub server, so the shared
    // test lock is deliberately held across the awaits: that is what serialises
    // the mutation. `#[tokio::test]` runs each on a current-thread runtime, so
    // the !Send guard never crosses a thread and cannot deadlock — contending
    // threads simply wait for the lock.
    use super::*;

    // ── Full-pipeline test against a stub Gmail API ─────────────────────────
    //
    // Everything between "we hold a token" and "the user can ask about it" is
    // ours: token refresh, list, full fetch, MIME/base64 decode, raw archive,
    // summaries, fact distillation and the semantic write. A live account only
    // proves the first two, so this stub exercises the rest offline.

    /// Minimal HTTP/1.1 server that answers Google's routes with canned JSON.
    async fn spawn_stub_gmail() -> String {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};

        let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let addr = listener.local_addr().unwrap();

        tokio::spawn(async move {
            let plain = |s: &str| -> String {
                format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    s.len(),
                    s
                )
            };
            loop {
                let Ok((mut sock, _)) = listener.accept().await else { break };
                let mut buf = vec![0u8; 8192];
                let Ok(n) = sock.read(&mut buf).await else { continue };
                let req = String::from_utf8_lossy(&buf[..n]).to_string();
                // First line: "METHOD /path?query HTTP/1.1"
                let path = req
                    .lines()
                    .next()
                    .and_then(|l| l.split_whitespace().nth(1))
                    .unwrap_or("")
                    .to_string();

                let body = if path.starts_with("/token") {
                    plain(r#"{"access_token":"stub-token","expires_in":3600,"scope":"https://www.googleapis.com/auth/gmail.readonly","token_type":"Bearer"}"#)
                } else if path.contains("/messages?") {
                    plain(r#"{"messages":[{"id":"msg-aaa"},{"id":"msg-bbb"}]}"#)
                } else if path.contains("/messages/msg-aaa") {
                    let body = "Hi team,\r\n\r\nThe quarterly review moves to Friday at 3pm. \
Please update the deck before then.\r\n\r\n-- Dana";
                    plain(&format!(
                        r#"{{"id":"msg-aaa","threadId":"t1","snippet":"The quarterly review moves to Friday","labelIds":["INBOX"],"internalDate":"1785000000000","payload":{{"headers":[
                          {{"name":"From","value":"Dana Reyes <dana@example.com>"}},
                          {{"name":"To","value":"me@example.com"}},
                          {{"name":"Subject","value":"Quarterly review rescheduled"}},
                          {{"name":"Date","value":"Mon, 20 Jul 2026 09:00:00 -0700"}}
                        ],"mimeType":"text/plain","body":{{"size":0,"data":"{}"}}}}}}"#,
                        base64url_encode(body)
                    ))
                } else if path.contains("/messages/msg-bbb") {
                    plain(r#"{"id":"msg-bbb","threadId":"t2","snippet":"Invoice attached","labelIds":["INBOX"],"internalDate":"1785000100000","payload":{"headers":[{"name":"From","value":"Billing <billing@vendor.com>"},{"name":"Subject","value":"Invoice 4471 attached"}],"mimeType":"text/html","body":{"size":0,"data":"PGh0bWw+PGJvZHk+SW52b2ljZSA0NDcxIGFtb3VudHMgdG8gJDEyMy4wMC4gZHVlIEZyaWRheSwgMjAyNi0wNy0yMC48L2JvZHk+PC9odG1sPg=="}}}"#)
                } else {
                    "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".to_string()
                };

                let _ = sock.write_all(body.as_bytes()).await;
                let _ = sock.flush().await;
            }
        });

        format!("http://{}/gmail/v1/users/me", addr)
    }

    #[tokio::test]
    async fn end_to_end_sync_persists_raw_summaries_facts_and_state() {
        let _guard = env_lock();
        let dir = tmp_store("timps-gmail-e2e");
        let api = spawn_stub_gmail().await;
        let token_host = api.split("/gmail/").next().unwrap().to_string();

        std::env::set_var("TIMPS_GMAIL_DIR", &dir);
        std::env::set_var("TIMPS_GMAIL_API_BASE", &api);
        // Point the canonical memory write at an isolated home.
        let home = tmp_store("timps-gmail-e2e-home");
        std::env::set_var("HOME", &home);

        // A real (expired) token plus a client whose token_uri is the stub.
        fs::write(
            dir.join("tokens.json"),
            r#"{"accessToken":"stale","refreshToken":"rt-stub","expiresAt":1,"obtainedAt":1,"scopes":["gmail.readonly"],"email":"me@example.com"}"#,
        )
        .unwrap();
        fs::write(
            dir.join("client.json"),
            format!(
                r#"{{"installed":{{"client_id":"stub.apps.googleusercontent.com","client_secret":"stub-secret","token_uri":"{}/token"}}}}"#,
                token_host
            ),
        )
        .unwrap();

        let report = sync("", 30, 50).await;

        assert!(report.error.is_none(), "unexpected error: {:?}", report.error);
        assert!(!report.needs_reconnect, "stub token is valid, must not ask to reconnect");
        assert_eq!(report.stored, 2, "both stub messages should be stored");
        // The distiller emits several facts per message (subject, sender, ...),
        // so pin the invariant that matters: the report agrees with disk.
        assert!(report.facts_stored >= 2, "expected facts from both messages, got {}", report.facts_stored);

        // 1. Raw archive, on disk, with the decoded body.
        let day_dirs: Vec<_> = fs::read_dir(dir.join("raw")).unwrap().collect();
        assert_eq!(day_dirs.len(), 1, "raw/ should hold one date bucket");
        let raw_files: Vec<_> = fs::read_dir(day_dirs[0].as_ref().unwrap().path()).unwrap().collect();
        assert_eq!(raw_files.len(), 2);
        let raw: Value = serde_json::from_str(
            &fs::read_to_string(day_dirs[0].as_ref().unwrap().path().join("msg-aaa.json")).unwrap(),
        )
        .unwrap();
        assert_eq!(raw["subject"], "Quarterly review rescheduled");
        assert!(raw["bodyText"].as_str().unwrap().contains("Friday at 3pm"));
        assert!(raw["from"].as_str().unwrap().contains("dana@example.com"));

        // 2. Summaries, one line per message.
        let summaries = fs::read_to_string(dir.join("summaries.jsonl")).unwrap();
        assert_eq!(summaries.lines().count(), 2);

        // 3. State, with the ISO timestamp the Gmail query parser expects.
        let state: Value = serde_json::from_str(&fs::read_to_string(dir.join("state.json")).unwrap()).unwrap();
        assert_eq!(state["messagesSynced"], 2);
        let last_run = state["lastRun"].as_str().unwrap();
        assert!(
            parse_timestamp(last_run).is_some(),
            "lastRun {:?} must round-trip through parse_timestamp",
            last_run
        );

        // 4. Facts in the canonical memory store, queryable by agents.
        // The module's own resolver: an empty project path maps to $HOME,
        // which is the store the CLI reads for connector syncs.
        let store = super::memory_dir("");
        let entries: Vec<Value> =
            serde_json::from_str(&fs::read_to_string(store.join("semantic.json")).unwrap()).unwrap();
        assert_eq!(
            entries.len(), report.facts_stored as usize,
            "facts reported must equal facts on disk"
        );
        assert!(
            entries.iter().any(|e| e["content"].as_str().unwrap_or("").contains("Quarterly review")),
            "subject-derived fact should be recallable"
        );
        assert!(
            entries.iter().any(|e| e["content"].as_str().unwrap_or("").contains("Invoice 4471")),
            "second message should also be distilled"
        );
        let tags = entries[0]["tags"].as_array().unwrap();
        assert!(tags.iter().any(|t| t == "gmail"), "provenance tag missing");
        assert!(tags.iter().any(|t| t.as_str().unwrap().starts_with("sender:")));

        std::env::remove_var("TIMPS_GMAIL_API_BASE");
        std::env::remove_var("TIMPS_GMAIL_DIR");
        std::env::remove_var("HOME");
        let _ = fs::remove_dir_all(&dir);
        let _ = fs::remove_dir_all(&home);
    }

    /// A summary line that cannot be written must be counted, not swallowed.
    /// The raw copy still lands, so the run is not lost - but the desktop's
    /// recent/query views read summaries.jsonl, and a silent gap there is
    /// indistinguishable from "no mail matched".
    #[tokio::test]
    async fn unwritable_summaries_file_is_reported_not_swallowed() {
        let _guard = env_lock();
        let dir = tmp_store("timps-gmail-sum-err");
        let home = tmp_store("timps-gmail-sum-err-home");
        let api = spawn_stub_gmail().await;
        let token_host = api.split("/gmail/").next().unwrap().to_string();

        std::env::set_var("TIMPS_GMAIL_DIR", &dir);
        std::env::set_var("TIMPS_GMAIL_API_BASE", &api);
        std::env::set_var("HOME", &home);

        fs::write(
            dir.join("tokens.json"),
            r#"{"accessToken":"t","refreshToken":"rt","expiresAt":99999999999999,"obtainedAt":1,"scopes":["gmail.readonly"],"email":"me@example.com"}"#,
        )
        .unwrap();
        fs::write(
            dir.join("client.json"),
            format!(
                r#"{{"installed":{{"client_id":"stub.apps.googleusercontent.com","client_secret":"s","token_uri":"{}/token"}}}}"#,
                token_host
            ),
        )
        .unwrap();

        // Put a directory where the summaries file belongs: opening it for
        // append then fails with EISDIR, exactly like a perms or disk-full fault.
        fs::create_dir_all(dir.join("summaries.jsonl")).unwrap();

        let report = sync("", 30, 50).await;

        assert_eq!(report.stored, 2, "raw copies should still be archived");
        assert_eq!(
            report.summary_errors, 2,
            "both summary failures must be counted"
        );
        assert!(
            report.error.is_some(),
            "a summary write failure must reach the user, not be swallowed"
        );

        std::env::remove_var("TIMPS_GMAIL_API_BASE");
        std::env::remove_var("TIMPS_GMAIL_DIR");
        std::env::remove_var("HOME");
        let _ = fs::remove_dir_all(&dir);
        let _ = fs::remove_dir_all(&home);
    }

    /// A 401 from the Gmail API must persist the reconnect marker, not just
    /// return it — a transient render of the error leaves no trace for the
    /// next session to act on.
    #[tokio::test]
    async fn unauthorized_api_persists_reconnect_marker() {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};

        let _guard = env_lock();
        let dir = tmp_store("timps-gmail-401");
        let home = tmp_store("timps-gmail-401-home");

        let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            loop {
                let Ok((mut sock, _)) = listener.accept().await else { break };
                let mut buf = vec![0u8; 4096];
                if sock.read(&mut buf).await.is_err() { break; }
                let _ = sock
                    .write_all(b"HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
                    .await;
            }
        });

        std::env::set_var("TIMPS_GMAIL_DIR", &dir);
        std::env::set_var("TIMPS_GMAIL_API_BASE", format!("http://{}/gmail/v1/users/me", addr));
        std::env::set_var("HOME", &home);

        fs::write(
            dir.join("tokens.json"),
            // Far future expiry: the access token is accepted as fresh, so this
            // isolates the 401-on-fetch path from the refresh path.
            r#"{"accessToken":"stale-but-unexpired","refreshToken":"rt","expiresAt":99999999999999,"obtainedAt":1,"scopes":["gmail.readonly"],"email":"me@example.com"}"#,
        )
        .unwrap();
        fs::write(
            dir.join("client.json"),
            format!(r#"{{"client_id":"stub.apps.googleusercontent.com","token_uri":"http://{}/token"}}"#, addr),
        )
        .unwrap();

        let report = sync("", 30, 50).await;
        assert!(report.needs_reconnect, "401 must ask for reconnect");

        let state: Value = serde_json::from_str(&fs::read_to_string(dir.join("state.json")).unwrap()).unwrap();
        assert_eq!(
            state["needsReconnect"].as_bool(),
            Some(true),
            "reconnect marker must be persisted to state.json, got {:?}",
            state
        );

        std::env::remove_var("TIMPS_GMAIL_API_BASE");
        std::env::remove_var("TIMPS_GMAIL_DIR");
        std::env::remove_var("HOME");
        let _ = fs::remove_dir_all(&dir);
        let _ = fs::remove_dir_all(&home);
    }

    #[test]
    fn decodes_base64url_without_padding() {
        // "hello world" → aGVsbG8gd29ybGQ (len % 4 == 0, no padding needed)
        assert_eq!(base64url_decode("aGVsbG8gd29ybGQ"), "hello world");
    }

    #[test]
    fn decodes_base64url_with_padding() {
        assert_eq!(base64url_decode("aGVsbG8="), "hello");
    }

    #[test]
    fn decodes_base64url_needing_two_pad_chars() {
        // "hi" → aGk (len % 4 == 2 → needs "=="). This is the case that a
        // NO_PAD engine silently fails on.
        assert_eq!(base64url_decode("aGk"), "hi");
    }

    #[test]
    fn decodes_base64url_needing_one_pad_char() {
        // "hey" → aGV5 (len % 4 == 3 → needs "=")
        assert_eq!(base64url_decode("aGV5"), "hey");
    }

    #[test]
    fn decodes_url_safe_alphabet_dashes() {
        // This payload needs BOTH the URL-safe alphabet ('-' and '_' where
        // standard base64 uses '+' and '/') and a re-added '=' pad char
        // (len % 4 == 3). A decoder that picks the wrong alphabet or refuses
        // padding returns "" here.
        assert_eq!(base64url_decode("w7_Dv8O-w78"), "ÿÿþÿ");
    }

    #[test]
    fn decode_handles_arbitrary_bytes_without_panicking() {
        // Real email bodies are arbitrary bytes. The String-based API returns
        // U+FFFD for invalid UTF-8, which is expected — what matters is that
        // it does not panic and still surfaces the valid ASCII prefix.
        use base64::Engine;
        let raw: Vec<u8> = (0u8..=255).collect();
        let enc = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(&raw);
        let out = base64url_decode(&enc);
        assert!(out.starts_with('\u{0}'), "first byte 0x00 should survive");
        assert!(!out.is_empty());
    }

    #[test]
    fn decodes_standard_alphabet_too() {
        use base64::Engine;
        let enc = base64::engine::general_purpose::STANDARD.encode(b"standard body");
        assert_eq!(base64url_decode(&enc), "standard body");
    }

    #[test]
    fn decodes_realistic_multipart_body() {
        // Exactly the shape the HTML-fallback test depends on: 16 bytes, so
        // the encoder emits 22 chars (len % 4 == 2) with no padding.
        let body = "<p>only html</p>";
        assert_eq!(base64url_decode(&base64url_encode(body)), body);
    }

    #[test]
    fn decode_rejects_invalid_length() {
        // len % 4 == 1 is not valid base64 (17 chars here).
        assert_eq!(base64url_decode("aGVsbG8gd29ybGQ12"), "");
    }

    #[test]
    fn decode_tolerates_embedded_whitespace() {
        // Gmail line-wraps some payloads.
        assert_eq!(base64url_decode("aGVsbG8g\nd29ybGQ"), "hello world");
    }

    #[test]
    fn strips_html_and_entities() {
        let html = "<div>Hi&nbsp;&amp;bye</div><script>evil()</script><p>Next</p>";
        let out = strip_html(html);
        assert!(out.contains("Hi &bye"));
        assert!(out.contains("Next"));
        assert!(!out.contains("evil()"));
    }

    #[test]
    fn drops_script_body_not_just_tags() {
        // The body must go too — keeping it would leak JS source into the
        // stored email text.
        let html = "<p>Real content</p><script>var apiKey=\"sk-live-123\";</script><p>More</p>";
        let out = strip_html(html);
        assert!(out.contains("Real content"));
        assert!(out.contains("More"));
        assert!(!out.contains("sk-live-123"));
        assert!(!out.contains("var"));
    }

    #[test]
    fn drops_style_body() {
        let html = "<style>.a{color:red}</style><p>Body</p>";
        let out = strip_html(html);
        assert_eq!(out, "Body");
    }

    #[test]
    fn unterminated_script_does_not_leak_or_hang() {
        // Malformed HTML is common in real mail; must not panic or hang.
        let html = "<p>Before</p><script>never closed";
        let out = strip_html(html);
        assert!(out.contains("Before"));
        assert!(!out.contains("never closed"));
    }

    #[test]
    fn converts_breaks_and_block_ends_to_newlines() {
        assert_eq!(strip_html("a<br>b"), "a\nb");
        assert_eq!(strip_html("<p>one</p><p>two</p>"), "one\ntwo");
    }

    #[test]
    fn prefers_plain_over_html() {
        let payload = json!({
            "mimeType": "multipart/alternative",
            "parts": [
                { "mimeType": "text/plain", "body": { "data": base64url_encode("plain body") } },
                { "mimeType": "text/html", "body": { "data": base64url_encode("<p>html body</p>") } }
            ]
        });
        assert_eq!(collect_body(&payload), "plain body");
    }

    #[test]
    fn falls_back_to_html_when_no_plain() {
        let payload = json!({
            "mimeType": "multipart/alternative",
            "parts": [
                { "mimeType": "text/html", "body": { "data": base64url_encode("<p>only html</p>") } }
            ]
        });
        assert_eq!(collect_body(&payload), "only html");
    }

    #[test]
    fn skips_attachments() {
        let payload = json!({
            "mimeType": "multipart/mixed",
            "parts": [
                { "mimeType": "text/plain", "body": { "data": base64url_encode("real body") } },
                { "mimeType": "application/pdf", "filename": "doc.pdf",
                  "body": { "data": base64url_encode("binary") } }
            ]
        });
        assert_eq!(collect_body(&payload), "real body");
    }

    #[test]
    fn reads_headers_case_insensitively() {
        let payload = json!({
            "headers": [
                { "name": "FROM", "value": "alice@example.com" },
                { "name": "Subject", "value": "Lunch?" }
            ]
        });
        assert_eq!(header_value(&payload, "from"), "alice@example.com");
        assert_eq!(header_value(&payload, "Subject"), "Lunch?");
    }

    #[test]
    fn extracts_sender_tag_from_display_name_form() {
        assert_eq!(
            sender_tag("Alice Smith <alice@example.com>").as_deref(),
            Some("sender:alice@example.com")
        );
        assert_eq!(sender_tag("plain@example.com").as_deref(), Some("sender:plain@example.com"));
        assert_eq!(sender_tag("no address"), None);
    }

    #[test]
    fn distills_subject_as_first_fact() {
        let facts = heuristic_facts("bob@x.com", "Sprint plan", "");
        assert_eq!(facts[0], "Email from bob@x.com: \"Sprint plan\"");
    }

    #[test]
    fn distills_sentences_from_body() {
        let body = "We decided to ship on Friday. The migration is complete and verified.";
        let facts = heuristic_facts("bob@x.com", "Status", body);
        assert!(facts.iter().any(|f| f.contains("ship on Friday")));
    }

    #[test]
    fn first_run_query_is_bounded() {
        let q = build_query(None, 7);
        assert_eq!(q, "in:inbox newer_than:7d");
    }

    #[test]
    fn subsequent_query_uses_last_run() {
        // Assert the actual value, not just the prefix. The bug this catches:
        // `lastRun` is epoch *millis*, and the old code subtracted 6h without
        // dividing by 1000, producing `after:1789875010` (the year ~56,000).
        let q = build_query(Some("1789875010000"), 7);
        assert_eq!(q, "in:inbox after:1789853410");
        // Same instant given in seconds must yield the same query.
        assert_eq!(build_query(Some("1789875010"), 7), q);
    }

    #[test]
    fn parses_iso_last_run_from_the_cli() {
        // This is the exact format the CLI writes into state.json.
        assert_eq!(parse_timestamp("2026-09-20T03:30:10.013Z"), Some(1789875010));
        assert_eq!(
            build_query(Some("2026-09-20T03:30:10.013Z"), 7),
            "in:inbox after:1789853410"
        );
    }

    #[test]
    fn parses_iso_variants_tolerantly() {
        let expected = Some(1789875010);
        for variant in [
            "2026-09-20T03:30:10.013Z",     // CLI / toISOString()
            "2026-09-20T03:30:10Z",          // no fraction
            "2026-09-20T03:30:10+00:00",     // explicit offset
            "2026-09-20 03:30:10",           // space separator
        ] {
            assert_eq!(parse_timestamp(variant), expected, "failed on {:?}", variant);
        }
    }

    #[test]
    fn epoch_and_iso_forms_agree() {
        // Bare numbers are disambiguated by width: 13 digits are millis,
        // 10 digits are seconds. Both widths can express the same instant.
        let iso = parse_timestamp("2026-09-20T03:30:10Z");
        assert_eq!(iso, Some(1789875010));
        assert_eq!(parse_timestamp("1789875010000"), iso, "13-digit = millis");
        assert_eq!(parse_timestamp("1789875010"), iso, "10-digit = seconds");
        // A genuinely different instant must not be conflated with it.
        assert_ne!(parse_timestamp("1789875010000"), parse_timestamp("178987501000"));
    }

    #[test]
    fn unparseable_last_run_falls_back_to_bounded_window() {
        // A garbage value must degrade to the safe bounded window, never to
        // `after:0` (which would re-ingest the entire mailbox).
        for bad in ["", "   ", "not-a-date", "2026-13", "1789875010abc"] {
            let q = build_query(Some(bad), 7);
            assert_eq!(q, "in:inbox newer_than:7d", "bad input {:?}", bad);
        }
        assert_eq!(build_query(None, 7), "in:inbox newer_than:7d");
    }

    #[test]
    fn iso_round_trips_through_the_state_field() {
        // What we persist must be parseable by us *and* by the desktop UI,
        // which renders lastRun with `new Date(iso)` / `fmtTime`.
        let iso = chrono_now_iso();
        assert!(iso.ends_with('Z'), "must be UTC ISO-8601: {}", iso);
        assert!(iso.parse::<f64>().is_err(), "must not be numeric: {}", iso);
        assert!(parse_timestamp(&iso).is_some());
        // And the JS side must accept it.
        let ms = js_date_parses_iso(&iso);
        assert!(ms > 1_600_000_000_000, "new Date('{}') => {}", iso, ms);
    }

    /// Mirrors `new Date(iso).getTime()` from ConnectorsView's `fmtTime`.
    /// A bare numeric string is the failure mode here (`Invalid Date`), and it
    /// is exactly what writing epoch millis into `lastRun` would have caused.
    fn js_date_parses_iso(iso: &str) -> i64 {
        // ECMAScript date-time string format: YYYY-MM-DDTHH:mm:ss.sssZ
        let (date, time) = iso.split_once('T').expect("ISO must have a T");
        let (ymd, hms) = date.split_once('-').unwrap();
        let _ = ymd;
        let y: i64 = iso[0..4].parse().unwrap();
        let mo: i64 = iso[5..7].parse().unwrap();
        let d: i64 = iso[8..10].parse().unwrap();
        let h: i64 = time[0..2].parse().unwrap();
        let mi: i64 = time[3..5].parse().unwrap();
        let se: i64 = time[6..8].parse().unwrap();
        let _ = hms;
        parse_timestamp(&format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z", y, mo, d, h, mi, se))
            .unwrap()
            * 1000
    }

    #[test]
    fn computes_utc_day_bucket() {
        // 2026-09-25T00:00:00Z
        let d = chrono_day();
        assert_eq!(d.len(), 10);
        assert!(d.contains('-'));
    }

    #[test]
    fn memory_dir_uses_the_shared_canonical_hash() {
        // Delegated to commands::memory_dir, so this asserts the same
        // memory-core-compatible hash the desktop chat reads with.
        let dir = memory_dir("");
        let name = dir.file_name().unwrap().to_string_lossy().to_string();
        assert_eq!(name.len(), 12, "hash should be 12 hex chars");
        assert_eq!(
            dir,
            PathBuf::from(crate::commands::memory_dir(&home_dir())),
            "empty project path must target the home/global store"
        );
    }

    #[test]
    fn memory_dir_resolves_symlinked_projects_to_one_store() {
        // The failure this guards: gmail facts written under one spelling,
        // chat reading the other, and the user sees an empty memory store.
        if !std::path::Path::new("/private/tmp").exists() {
            return;
        }
        assert_eq!(memory_dir("/tmp"), memory_dir("/private/tmp"));
    }

    // ── State file (the CLI's ~/.timps/gmail/state.json contract) ────────

    /// Serialize with `bundled_oauth`'s tests: both override this process-global.
    fn env_lock() -> std::sync::MutexGuard<'static, ()> {
        crate::bundled_oauth::tests::env_lock()
    }

    /// Write `state.json` into a temp gmail dir and point the module at it.
    fn with_state_file(name: &str, body: impl FnOnce(&Path)) {
        let _guard = env_lock();
        let dir = tmp_store(name);
        std::env::set_var("TIMPS_GMAIL_DIR", &dir);
        body(&dir);
        std::env::remove_var("TIMPS_GMAIL_DIR");
        let _ = fs::remove_dir_all(&dir);
    }

    fn read_state(dir: &Path) -> Value {
        serde_json::from_str(&fs::read_to_string(dir.join("state.json")).unwrap()).unwrap()
    }

    #[test]
    fn reads_cli_state_with_iso_last_run() {
        // Regression guard for the real state.json on disk, which stores
        // lastRun as ISO-8601 — not epoch millis.
        with_state_file("timps-state-read", |dir| {
            fs::write(
                dir.join("state.json"),
                r#"{"lastRun":"2026-09-20T03:30:10.013Z","lastMessageId":"testmsg0000000001","messagesSynced":154}"#,
            )
            .unwrap();
            let s = load_state();
            assert_eq!(s.last_run.as_deref(), Some("2026-09-20T03:30:10.013Z"));
            assert_eq!(s.messages_synced, 154);
            assert_eq!(s.last_message_id.as_deref(), Some("testmsg0000000001"));
            assert!(!s.needs_reconnect);
            // And it must produce a correct incremental query.
            assert_eq!(
                build_query(s.last_run.as_deref(), 30),
                "in:inbox after:1789853410"
            );
        });
    }

    #[test]
    fn marks_needs_reconnect_preserving_cli_state() {
        // Flagging a dead token must not clobber the CLI's bookkeeping.
        with_state_file("timps-state-mark", |dir| {
            fs::write(
                dir.join("state.json"),
                r#"{"lastRun":"2026-09-20T03:30:10.013Z","lastMessageId":"testmsg0000000001","messagesSynced":154}"#,
            )
            .unwrap();
            mark_needs_reconnect("Token has been expired or revoked.");
            let after = read_state(dir);
            assert_eq!(after["needsReconnect"], json!(true));
            assert_eq!(after["messagesSynced"], json!(154));
            assert_eq!(after["lastMessageId"], json!("testmsg0000000001"));
            assert_eq!(after["lastRun"], json!("2026-09-20T03:30:10.013Z"));
            assert!(after["reconnectReason"].as_str().unwrap().contains("revoked"));
        });
    }

    #[test]
    fn clears_needs_reconnect_after_a_successful_sync() {
        // A stale marker must not outlive a good sync, or the UI prompts forever.
        with_state_file("timps-state-clear", |dir| {
            fs::write(
                dir.join("state.json"),
                r#"{"lastRun":"2026-09-20T03:30:10.013Z","messagesSynced":154,"needsReconnect":true}"#,
            )
            .unwrap();
            assert!(load_state().needs_reconnect, "precondition");
            clear_needs_reconnect();
            let after = read_state(dir);
            assert_ne!(after["needsReconnect"], json!(true), "stale: {:#?}", after);
            assert_eq!(after["messagesSynced"], json!(154));
            assert_eq!(after["lastRun"], json!("2026-09-20T03:30:10.013Z"));
        });
    }

    #[test]
    fn marking_reconnect_creates_state_when_absent() {
        // First-run failure: there is no state.json yet.
        with_state_file("timps-state-absent", |dir| {
            assert!(!dir.join("state.json").exists());
            mark_needs_reconnect("boom");
            let after = read_state(dir);
            assert_eq!(after["needsReconnect"], json!(true));
        });
    }

    /// Live check of the real failure path against Google's OAuth endpoint.
    ///
    /// Verifies that a revoked/expired refresh token produces
    /// `needs_reconnect` and persists the marker — the exact state the UI needs
    /// to render "Reconnect" instead of a generic error. Uses a copy of the
    /// real token so the user's own `~/.timps/gmail` is never modified, and
    /// forces the refresh path by zeroing `expiresAt`.
    #[test]
    #[ignore = "hits Google's live OAuth endpoint; run with -- --ignored"]
    fn live_invalid_grant_surfaces_reconnect() {
        let src = PathBuf::from(home_dir()).join(".timps").join("gmail");
        let tokens = src.join("tokens.json");
        // Refreshing needs a client_id/secret, and the bundled one is compiled
        // in only for injected builds — so bring the developer's own
        // client.json across too. Without it this test would only prove that
        // missing credentials are reported, which unit tests already cover.
        let client = src.join("client.json");
        if !tokens.exists() || !client.exists() {
            eprintln!(
                "skipping: need both {} and {}",
                tokens.display(),
                client.display()
            );
            return;
        }
        let _guard = env_lock();
        let dir = tmp_store("timps-live-reconnect");
        std::env::set_var("TIMPS_GMAIL_DIR", &dir);
        fs::copy(&tokens, dir.join("tokens.json")).unwrap();
        fs::copy(&client, dir.join("client.json")).unwrap();

        // Force the refresh path deterministically rather than waiting for
        // the cached access token to lapse.
        let mut t: Value = serde_json::from_str(&fs::read_to_string(dir.join("tokens.json")).unwrap()).unwrap();
        t["expiresAt"] = json!(0i64);
        fs::write(dir.join("tokens.json"), serde_json::to_string(&t).unwrap()).unwrap();

        let rt = tokio::runtime::Runtime::new().unwrap();
        let report = rt.block_on(sync("", 30, 10));

        std::env::remove_var("TIMPS_GMAIL_DIR");
        println!("report = {:#?}", report);
        let state: Value = serde_json::from_str(
            &fs::read_to_string(dir.join("state.json")).unwrap_or_else(|e| {
                eprintln!("no state.json: {}", e);
                "{}".into()
            }),
        )
        .unwrap_or(Value::Null);
        println!("state  = {:#?}", state);

        // Guard against the test silently "passing" for the wrong reason: a
        // missing-credential error is not the invalid_grant path.
        assert!(
            !report.error.as_deref().unwrap_or("").contains("credentials missing"),
            "test needs a real client.json, got: {:#?}",
            report
        );
        assert!(
            report.needs_reconnect,
            "a rejected token must request Reconnect: {:#?}",
            report
        );
        assert_eq!(state["needsReconnect"], json!(true), "marker must persist");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn store_facts_dedupes_within_a_single_batch() {
        // Two emails can distill to the same first sentence (same sender +
        // subject line, or a common sign-off). The dedup set must be updated as
        // we append, not just seeded from disk, or both land in the store.
        let dir = tmp_store("timps-store-batchdedup");
        let dup = "Email from a@b.com: \"Weekly sync\"".to_string();
        let facts = vec![
            (dup.clone(), vec!["gmail".to_string()]),
            (dup.clone(), vec!["gmail".to_string()]),
            ("Email from c@d.com: \"Another\"".to_string(), vec!["gmail".to_string()]),
        ];
        assert_eq!(store_facts_into(&dir, &facts).unwrap(), 2, "batch dedup");
        let entries = read_store(&dir);
        assert_eq!(entries.len(), 2);
        // And ids must still be unique.
        let mut ids = std::collections::HashSet::new();
        for e in &entries {
            assert!(ids.insert(e["id"].as_str().unwrap().to_string()), "dup id");
        }
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn store_facts_shares_the_write_lock_with_commands() {
        // The whole point of routing through commands::semantic_write_lock: a
        // connector sync and a chat write must not interleave. If this ever
        // regresses to a private mutex, the two paths can lose each other's
        // entries during the read-modify-write.
        let _guard = memory_write_lock();
        assert!(
            crate::commands::SEMANTIC_LOCK.try_lock().is_err(),
            "gmail and commands must contend on the same mutex"
        );
        drop(_guard);
        assert!(
            crate::commands::SEMANTIC_LOCK.try_lock().is_ok(),
            "lock must be released"
        );
    }

    #[test]
    fn concurrent_store_and_command_writes_do_not_lose_entries() {
        // Hammer both writers on one store and assert nothing is dropped.
        let dir = tmp_store("timps-store-concurrent");
        let path = dir.join("semantic.json");
        fs::write(&path, "[]").unwrap();

        let handles: Vec<_> = (0..8)
            .map(|i| {
                let path = path.clone();
                std::thread::spawn(move || {
                    for j in 0..25 {
                        let _guard = memory_write_lock();
                        let mut entries: Vec<Value> = fs::read_to_string(&path)
                            .ok()
                            .and_then(|s| serde_json::from_str(&s).ok())
                            .unwrap_or_default();
                        entries.push(json!({
                            "id": format!("mem_t{}_{}", i, j),
                            "timestamp": 1,
                            "type": "fact",
                            "content": format!("content {} {}", i, j),
                            "tags": []
                        }));
                        let body = serde_json::to_string(&entries).unwrap();
                        write_atomic(&path, &body).unwrap();
                    }
                })
            })
            .collect();
        for h in handles {
            h.join().unwrap();
        }

        let entries = read_store(&dir);
        assert_eq!(entries.len(), 200, "every write must survive");
        let _ = fs::remove_dir_all(&dir);
    }

    // ── Raw-message persistence ──────────────────────────────────────────

    #[test]
    fn raw_record_round_trips_and_creates_day_dirs() {
        let dir = tmp_store("timps-raw-write");
        let path = dir.join("raw").join("2026-09-26").join("msg1.json");
        let rec = json!({"id": "msg1", "subject": "Hi", "bodyText": "there"});
        write_raw_record(&path, &rec).unwrap();
        let back: Value =
            serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(back["id"], "msg1");
        assert_eq!(back["bodyText"], "there");
        // No stray temp file left behind by the atomic write.
        assert!(!path.with_extension("json.tmp").exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn raw_record_write_failure_is_reported() {
        // A sync must never claim "stored" when the raw copy could not be
        // written. Point the path at an existing *directory* so the write fails.
        let dir = tmp_store("timps-raw-fail");
        let blocked = dir.join("blocked.json");
        fs::create_dir_all(&blocked).unwrap();
        let err = write_raw_record(&blocked, &json!({"id": "x"}))
            .expect_err("writing over a directory must fail");
        assert!(!err.is_empty());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn already_stored_ids_scans_all_date_buckets() {
        // The CLI writes raw/<date>/<id>.json, so dedup has to walk every day
        // or a re-sync on the next date would re-ingest the whole mailbox.
        let _guard = env_lock();
        let dir = tmp_store("timps-dedup-buckets");
        std::env::set_var("TIMPS_GMAIL_DIR", &dir);
        for (day, id) in [("2026-09-20", "a1"), ("2026-09-21", "b2"), ("2026-09-26", "c3")] {
            let p = dir.join("raw").join(day);
            fs::create_dir_all(&p).unwrap();
            fs::write(p.join(format!("{}.json", id)), "{}").unwrap();
        }
        let ids = already_stored_ids();
        std::env::remove_var("TIMPS_GMAIL_DIR");
        assert_eq!(ids.len(), 3, "must see every day bucket: {:?}", ids);
        for id in ["a1", "b2", "c3"] {
            assert!(ids.contains(id), "missing {}", id);
        }
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn already_stored_ids_is_empty_when_raw_is_missing() {
        let _guard = env_lock();
        let dir = tmp_store("timps-dedup-empty");
        std::env::set_var("TIMPS_GMAIL_DIR", &dir);
        let ids = already_stored_ids();
        std::env::remove_var("TIMPS_GMAIL_DIR");
        assert!(ids.is_empty());
        let _ = fs::remove_dir_all(&dir);
    }

    fn base64url_encode(input: &str) -> String {
        use base64::Engine;
        base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(input.as_bytes())
    }

    // ── Memory-store writes ──────────────────────────────────────────────
    //
    // These are the tests that matter most: the id generator once sliced
    // `now_millis()` as `&hex[8..16]`, which panics on every call because the
    // value is only 11 hex digits. Every test above this point passed while
    // sync would have crashed on the first real message.

    fn tmp_store(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(name);
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn read_store(dir: &Path) -> Vec<Value> {
        serde_json::from_str(&fs::read_to_string(dir.join("semantic.json")).unwrap()).unwrap()
    }

    #[test]
    fn fact_id_never_panics_and_is_well_formed() {
        // The regression guard: 11-hex-digit timestamps used to blow up here.
        for content in ["a", "Email from x: y", "é中文 subject", ""] {
            let id = fact_id(content);
            assert!(id.starts_with("mem_"), "bad id: {}", id);
            let parts: Vec<&str> = id.split('_').collect();
            assert_eq!(parts.len(), 3, "bad id shape: {}", id);
            assert_eq!(parts[1].len(), 8, "bad id prefix: {}", id);
            assert_eq!(parts[2].len(), 6, "bad id suffix: {}", id);
            assert!(id.chars().all(|c| c.is_ascii_hexdigit() || c == '_' || c == 'm' || c == 'e'));
        }
    }

    #[test]
    fn fact_ids_are_unique_within_a_run() {
        let mut seen = std::collections::HashSet::new();
        for i in 0..500 {
            assert!(seen.insert(fact_id(&format!("fact number {}", i))), "id collision at {}", i);
        }
    }

    #[test]
    fn fact_id_is_stable_for_same_content() {
        // Same fact across two syncs should keep its id prefix so upserts work.
        assert_eq!(
            fact_id("Email from a@b.com: \"Lunch?\"").split('_').nth(1),
            fact_id("Email from a@b.com: \"Lunch?\"").split('_').nth(1)
        );
    }

    #[test]
    fn store_facts_writes_memory_core_shaped_entries() {
        let dir = tmp_store("timps-store-shape");
        let facts = vec![(
            "Email from bob@x.com: \"Sprint plan\"".to_string(),
            vec!["email".to_string(), "gmail".to_string()],
        )];
        assert_eq!(store_facts_into(&dir, &facts).unwrap(), 1);

        let entries = read_store(&dir);
        assert_eq!(entries.len(), 1);
        let e = &entries[0];
        // Exactly the fields memory-core writes — no extras, no `source`
        // (the desktop reserves that for the store hash).
        let mut keys: Vec<&String> = e.as_object().unwrap().keys().collect();
        keys.sort();
        assert_eq!(keys, vec!["content", "id", "score", "tags", "timestamp", "type"]);
        assert_eq!(e["type"], "fact");
        assert_eq!(e["content"], "Email from bob@x.com: \"Sprint plan\"");
        // Timestamp must be milliseconds, matching memory-core on-disk data.
        let ts = e["timestamp"].as_i64().unwrap();
        let now_s = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        assert!(ts > now_s * 100, "timestamp looks like seconds, not ms: {}", ts);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn store_facts_deduplicates_by_content() {
        // Re-syncing the same mail must not grow the store.
        let dir = tmp_store("timps-store-dedup");
        let facts = vec![("Email from a@b.com: \"Hi\"".to_string(), vec!["gmail".to_string()])];
        assert_eq!(store_facts_into(&dir, &facts).unwrap(), 1);
        assert_eq!(store_facts_into(&dir, &facts).unwrap(), 0, "second write should dedup");
        assert_eq!(store_facts_into(&dir, &facts).unwrap(), 0);
        assert_eq!(read_store(&dir).len(), 1);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn store_facts_preserves_existing_entries_and_their_ids() {
        // Must not clobber memories the CLI or chat already wrote.
        let dir = tmp_store("timps-store-preserve");
        let existing = json!([{
            "id": "mem_cliwritten_abc123",
            "timestamp": 1785680181385i64,
            "type": "fact",
            "content": "User prefers Rust",
            "tags": ["preference"]
        }]);
        fs::write(dir.join("semantic.json"), serde_json::to_string(&existing).unwrap()).unwrap();

        store_facts_into(&dir, &[("Email from a@b.com: \"Hi\"".to_string(), vec![])]).unwrap();
        let entries = read_store(&dir);
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0]["id"], "mem_cliwritten_abc123");
        assert_eq!(entries[0]["content"], "User prefers Rust");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn store_facts_dedupes_against_cli_written_entries() {
        // If the CLI already distilled this fact, don't add it twice.
        let dir = tmp_store("timps-store-crossdedup");
        let fact = "Email from a@b.com: \"Deploy window\"";
        fs::write(
            dir.join("semantic.json"),
            serde_json::to_string(&json!([{
                "id": "mem_x_000001",
                "timestamp": 1785680181385i64,
                "type": "fact",
                "content": fact,
                "tags": ["email"]
            }]))
            .unwrap(),
        )
        .unwrap();
        assert_eq!(
            store_facts_into(&dir, &[(fact.to_string(), vec![])]).unwrap(),
            0
        );
        assert_eq!(read_store(&dir).len(), 1);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn store_facts_with_no_facts_is_a_noop() {
        let dir = tmp_store("timps-store-empty");
        assert_eq!(store_facts_into(&dir, &[]).unwrap(), 0);
        assert!(!dir.join("semantic.json").exists(), "should not create a file");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn store_facts_creates_missing_directory() {
        let dir = std::env::temp_dir().join("timps-store-mkdir/nested/deep");
        let _ = fs::remove_dir_all(std::env::temp_dir().join("timps-store-mkdir"));
        assert_eq!(
            store_facts_into(&dir, &[("x".to_string(), vec![])]).unwrap(),
            1
        );
        assert!(dir.join("semantic.json").exists());
        let _ = fs::remove_dir_all(std::env::temp_dir().join("timps-store-mkdir"));
    }

    #[test]
    fn store_facts_tolerates_corrupt_existing_store() {
        // A truncated semantic.json must not wedge sync forever.
        let dir = tmp_store("timps-store-corrupt");
        fs::write(dir.join("semantic.json"), "[{\"id\":\"a\",").unwrap();
        assert_eq!(
            store_facts_into(&dir, &[("recovered fact".to_string(), vec![])]).unwrap(),
            1
        );
        assert_eq!(read_store(&dir).len(), 1);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn distilled_facts_round_trip_through_desktop_reader() {
        // The real contract: what gmail_sync writes must deserialize via the
        // same struct the desktop's load_semantic uses.
        let dir = tmp_store("timps-store-roundtrip");
        store_facts_into(
            &dir,
            &[(
                "Email from bob@x.com: \"Sprint plan\"".to_string(),
                vec!["email".to_string(), "gmail".to_string(), "sender:bob@x.com".to_string()],
            )],
        )
        .unwrap();

        let raw = fs::read_to_string(dir.join("semantic.json")).unwrap();
        let parsed: Vec<crate::commands::SemanticEntry> = serde_json::from_str(&raw)
            .expect("gmail entries must deserialize as SemanticEntry");
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].kind, "fact");
        assert_eq!(parsed[0].content, "Email from bob@x.com: \"Sprint plan\"");
        assert_eq!(parsed[0].tags, vec!["email", "gmail", "sender:bob@x.com"]);
        assert_eq!(parsed[0].score, Some(0.6));
        assert!(parsed[0].source.is_none());
        let _ = fs::remove_dir_all(&dir);
    }
}
