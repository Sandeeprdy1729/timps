// ── TIMPS Desktop — Gmail connector (read-only) ────────────────────────────
// Mirrors the CLI's gmail service: same data layout under ~/.timps/gmail so the
// desktop app and `timps` CLI share credentials, tokens and the email store.
//
// OAuth uses the loopback flow: we bind a local TCP listener on an ephemeral
// port, open the consent URL in the browser, receive the code on the callback,
// exchange it via reqwest (renderer never does network I/O — CSP stays locked),
// save tokens to ~/.timps/gmail/tokens.json, then fetch the account email.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const DEFAULT_TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const PROFILE_URL: &str = "https://gmail.googleapis.com/gmail/v1/users/me/profile";
const GMAIL_SCOPE: &str = "https://www.googleapis.com/auth/gmail.readonly";
const OAUTH_TIMEOUT_SECS: u64 = 300;

// ── Paths ────────────────────────────────────────────────────────────────────

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

fn client_file() -> PathBuf {
    gmail_dir().join("client.json")
}

fn state_file() -> PathBuf {
    gmail_dir().join("state.json")
}

fn summaries_file() -> PathBuf {
    gmail_dir().join("summaries.jsonl")
}

fn autosync_plist() -> PathBuf {
    PathBuf::from(home_dir())
        .join("Library")
        .join("LaunchAgents")
        .join("ai.timps.gmail.sync.plist")
}

fn read_json<T>(path: &Path) -> Result<T, String>
where
    T: serde::de::DeserializeOwned,
{
    if !path.exists() {
        return Err("file does not exist".to_string());
    }
    let raw = fs::read_to_string(path).map_err(|e| format!("read {}: {}", path.display(), e))?;
    serde_json::from_str(&raw).map_err(|e| format!("parse {}: {}", path.display(), e))
}

fn write_mode(path: &Path, raw: &str, mode: u32) -> Result<(), String> {
    fs::write(path, raw).map_err(|e| format!("write {}: {}", path.display(), e))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(path, fs::Permissions::from_mode(mode));
    }
    Ok(())
}

fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

/// Opaque random hex used for the OAuth `state` parameter (CSRF protection on
/// the loopback callback). crypto-random is not required — entropy from the
/// clock + client scoping is sufficient for a local, single-use flow.
fn random_state(seed: &str) -> String {
    let start = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let mut hasher = Sha256::new();
    hasher.update(seed.as_bytes());
    hasher.update(start.as_nanos().to_le_bytes());
    hasher.update(std::process::id().to_le_bytes());
    hex::encode(&hasher.finalize()[..16])
}

fn urlencode(input: &str) -> String {
    let mut out = String::with_capacity(input.len() * 2);
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

fn url_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            b'%' if i + 2 < bytes.len() => {
                let hi = (bytes[i + 1] as char).to_digit(16);
                let lo = (bytes[i + 2] as char).to_digit(16);
                if let (Some(hi), Some(lo)) = (hi, lo) {
                    out.push((hi * 16 + lo) as u8);
                    i += 3;
                } else {
                    out.push(b'%');
                    i += 1;
                }
            }
            b => {
                out.push(b);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).to_string()
}

// ── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct GmailTokens {
    #[serde(rename = "accessToken")]
    access_token: String,
    #[serde(rename = "refreshToken")]
    refresh_token: String,
    #[serde(default)]
    email: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ClientCreds {
    client_id: String,
    client_secret: String,
    #[serde(default)]
    token_uri: Option<String>,
    #[serde(default)]
    auth_uri: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct GmailState {
    #[serde(rename = "lastRun")]
    last_run: Option<String>,
    #[serde(rename = "messagesSynced")]
    messages_synced: Option<i64>,
}

#[derive(Serialize)]
pub struct GmailSummaryEntry {
    #[serde(rename = "emailId")]
    email_id: String,
    subject: String,
    from: String,
    date: String,
    facts: Vec<String>,
    method: String,
    #[serde(rename = "syncedAt")]
    synced_at: String,
}

impl GmailSummaryEntry {
    fn matches(&self, needle_lc: &str) -> bool {
        let haystack = format!(
            "{} {} {} {}",
            self.subject,
            self.from,
            self.date,
            self.facts.join(" ")
        )
        .to_lowercase();
        haystack.contains(needle_lc)
    }
}

#[derive(Serialize)]
pub struct GmailSyncResult {
    pub ok: bool,
    #[serde(rename = "exitCode")]
    pub exit_code: i32,
    pub output: String,
}

#[derive(Default)]
pub struct GmailOAuthState {
    pub outcome: Mutex<Option<Arc<Mutex<Option<GmailOAuthOutcome>>>>>,
}

#[derive(Clone)]
pub struct GmailOAuthOutcome {
    pub email: String,
}

// ── Helpers ──────────────────────────────────────────────────────────────────

fn load_client() -> Result<ClientCreds, GmailConnectorError> {
    let file = client_file();
    let raw = fs::read_to_string(&file).map_err(|_| GmailConnectorError {
        message: "No Gmail OAuth credentials found. Import a Google Desktop-app client JSON (Connectors tab → Import credentials, or `timps gmail:credential <file>`).".to_string(),
    })?;
    let parsed: Value = serde_json::from_str(&raw).map_err(|_| GmailConnectorError {
        message: "~/.timps/gmail/client.json is not valid JSON.".to_string(),
    })?;
    // Google's downloads can be flat, { installed: ... }, or { web: ... }.
    let section = parsed
        .get("installed")
        .or_else(|| parsed.get("web"))
        .unwrap_or(&parsed);
    let client_id = section
        .get("client_id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| GmailConnectorError {
            message: "client.json is missing client_id.".to_string(),
        })?;
    let client_secret = section
        .get("client_secret")
        .and_then(|v| v.as_str())
        .ok_or_else(|| GmailConnectorError {
            message: "client.json is missing client_secret.".to_string(),
        })?;
    Ok(ClientCreds {
        client_id: client_id.to_string(),
        client_secret: client_secret.to_string(),
        token_uri: section
            .get("token_uri")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        auth_uri: section
            .get("auth_uri")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
    })
}

fn has_tokens() -> bool {
    read_json::<GmailTokens>(&tokens_file()).is_ok()
}

fn save_tokens(access: &str, refresh: &str, expires_in: u64, email: &str) -> Result<(), String> {
    let tokens = json!({
        "accessToken": access,
        "refreshToken": refresh,
        "expiresAt": now_millis() + expires_in as i64 * 1000,
        "scopes": [GMAIL_SCOPE],
        "email": email,
        "obtainedAt": now_millis(),
    });
    write_mode(
        &tokens_file(),
        &serde_json::to_string_pretty(&tokens).unwrap(),
        0o600,
    )
}

/// Locate the TIMPS CLI entry (`timps-code/dist/bin/timps.js`) by walking up
/// from the current executable — works under `npm run tauri:dev` and when the
/// CLI repo sits beside an installed bundle. Override with TIMPS_CLI_JS.
fn find_cli_js() -> Option<String> {
    if let Ok(custom) = std::env::var("TIMPS_CLI_JS") {
        if Path::new(&custom).exists() {
            return Some(custom);
        }
    }
    let exe = std::env::current_exe().ok()?;
    let mut dir = exe.parent()?.to_path_buf();
    for _ in 0..10 {
        for cand in [
            dir.join("timps-code").join("dist").join("bin").join("timps.js"),
            dir.join("dist").join("bin").join("timps.js"),
        ] {
            if cand.exists() {
                return Some(cand.to_string_lossy().to_string());
            }
        }
        if !dir.pop() {
            break;
        }
    }
    None
}

fn open_browser(url: &str) {
    #[cfg(target_os = "macos")]
    let _ = Command::new("open").arg(url).spawn();
    #[cfg(target_os = "linux")]
    let _ = Command::new("xdg-open").arg(url).spawn();
    #[cfg(target_os = "windows")]
    let _ = Command::new("cmd").args(["/c", "start", "", url]).spawn();
}

fn read_summaries() -> Vec<GmailSummaryEntry> {
    let file = summaries_file();
    if !file.exists() {
        return Vec::new();
    }
    let Ok(raw) = fs::read_to_string(&file) else {
        return Vec::new();
    };
    raw.lines()
        .filter_map(|line| serde_json::from_str::<Value>(line).ok())
        .filter_map(|v| {
            Some(GmailSummaryEntry {
                email_id: v.get("emailId")?.as_str()?.to_string(),
                subject: v
                    .get("subject")
                    .and_then(|s| s.as_str())
                    .unwrap_or("(No Subject)")
                    .to_string(),
                from: v
                    .get("from")
                    .and_then(|s| s.as_str())
                    .unwrap_or("unknown")
                    .to_string(),
                date: v
                    .get("date")
                    .and_then(|s| s.as_str())
                    .unwrap_or_default()
                    .to_string(),
                facts: v
                    .get("facts")
                    .and_then(|a| a.as_array())
                    .map(|a| {
                        a.iter()
                            .filter_map(|f| f.as_str().map(|s| s.to_string()))
                            .collect()
                    })
                    .unwrap_or_default(),
                method: v
                    .get("method")
                    .and_then(|s| s.as_str())
                    .unwrap_or("heuristic")
                    .to_string(),
                synced_at: v
                    .get("syncedAt")
                    .and_then(|s| s.as_str())
                    .unwrap_or_default()
                    .to_string(),
            })
        })
        .collect()
}

async fn fetch_profile(client: &reqwest::Client, access: &str) -> String {
    match client.get(PROFILE_URL).bearer_auth(access).send().await {
        Ok(resp) => {
            let j: Value = resp.json().await.unwrap_or(Value::Null);
            j.get("emailAddress")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string()
        }
        Err(_) => "unknown".to_string(),
    }
}

/// A structured error the renderer can show directly.
pub struct GmailConnectorError {
    pub message: String,
}

// ── Commands ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn gmail_status() -> Result<Value, String> {
    let tokens: Option<GmailTokens> = read_json(&tokens_file()).ok();
    let state: GmailState = read_json(&state_file()).unwrap_or_default();
    let summary_count = read_summaries().len();
    Ok(json!({
        "connected": has_tokens(),
        "email": tokens.and_then(|t| t.email).unwrap_or_else(|| "unknown".to_string()),
        "hasRefreshToken": true,
        "lastRun": state.last_run,
        "messagesSynced": state.messages_synced.unwrap_or(0),
        "summaryCount": summary_count,
        "autoSync": autosync_plist().exists(),
        "cliPath": find_cli_js(),
    }))
}

#[tauri::command]
pub fn gmail_import_credentials(file_path: String) -> Result<Value, String> {
    let src = PathBuf::from(&file_path);
    let raw = fs::read_to_string(&src)
        .map_err(|e| format!("cannot read {}: {}", file_path, e))?;
    let parsed: Value = serde_json::from_str(&raw)
        .map_err(|e| format!("{} is not a JSON credential file: {}", file_path, e))?;
    let section = parsed
        .get("installed")
        .or_else(|| parsed.get("web"))
        .unwrap_or(&parsed);
    let client_id = section
        .get("client_id")
        .and_then(|v| v.as_str())
        .ok_or("credential file is missing client_id")?;
    if section.get("client_secret").is_none() {
        return Err("credential file is missing client_secret".to_string());
    }
    let body = serde_json::to_string_pretty(section).unwrap();
    write_mode(&client_file(), &body, 0o600)?;
    Ok(json!({
        "clientId": client_id,
        "saved": client_file().to_string_lossy(),
    }))
}

/// Begin the loopback OAuth flow: bind a listener, build the consent URL, and
/// spawn the accept+exchange task. The renderer shows the URL; finish() polls.
#[tauri::command]
pub async fn gmail_oauth_start(
    state: tauri::State<'_, GmailOAuthState>,
) -> Result<Value, String> {
    let creds = load_client().map_err(|e| e.message)?;

    let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
        .await
        .map_err(|e| format!("could not bind loopback listener: {}", e))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("could not read listener port: {}", e))?
        .port();
    let redirect_uri = format!("http://localhost:{}/oauth2callback", port);
    let state_token = random_state(&creds.client_id);

    let auth_uri = creds.auth_uri.clone().unwrap_or_else(|| AUTH_URL.to_string());
    let auth_url = format!(
        "{}?client_id={}&redirect_uri={}&response_type=code&scope={}&access_type=offline&prompt=consent&state={}",
        auth_uri,
        urlencode(&creds.client_id),
        urlencode(&redirect_uri),
        urlencode(GMAIL_SCOPE),
        state_token,
    );

    let outcome = Arc::new(Mutex::new(None::<GmailOAuthOutcome>));
    *state.outcome.lock().map_err(|_| "oauth state poisoned")? = Some(outcome.clone());

    let client = reqwest::Client::new();
    let token_uri = creds
        .token_uri
        .clone()
        .unwrap_or_else(|| DEFAULT_TOKEN_URL.to_string());
    let client_id = creds.client_id.clone();
    let client_secret = creds.client_secret.clone();
    let redirect = redirect_uri.clone();
    let state_owned = state_token;

    tauri::async_runtime::spawn(async move {
        let accept_fut = listener.accept();
        let (mut stream, _) = match tokio::time::timeout(Duration::from_secs(OAUTH_TIMEOUT_SECS), accept_fut).await {
            Ok(Ok(pair)) => pair,
            _ => return,
        };

        use tokio::io::{AsyncReadExt as _, AsyncWriteExt as _};
        let mut buf = vec![0u8; 8192];
        let _ = stream.read(&mut buf).await;
        let head = String::from_utf8_lossy(&buf).to_string();
        let (code, returned_state) = parse_callback(&head);

        if code.is_empty() || returned_state != state_owned {
            let _ = stream
                .write_all(
                    b"HTTP/1.1 400 Bad Request\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: 82\r\nConnection: close\r\n\r\n<h3>Authorization failed.</h3><p>Close this tab and try again.</p>",
                )
                .await;
            return;
        }
        let _ = stream
            .write_all(
                b"HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n<h3>&#10003; TIMPS connected to Gmail.</h3><p>You can close this tab and return to TIMPS.</p>",
            )
            .await;

        let params = [
            ("grant_type", "authorization_code"),
            ("client_id", client_id.as_str()),
            ("client_secret", client_secret.as_str()),
            ("code", code.as_str()),
            ("redirect_uri", redirect.as_str()),
        ];
        let token_resp = match client.post(&token_uri).form(&params).send().await {
            Ok(r) => match r.error_for_status() {
                Ok(r) => r,
                Err(e) => {
                    eprintln!("[gmail] token exchange error: {}", e);
                    return;
                }
            },
            Err(e) => {
                eprintln!("[gmail] token exchange network error: {}", e);
                return;
            }
        };
        let j: Value = token_resp.json().await.unwrap_or(Value::Null);
        let access = j.get("access_token").and_then(|v| v.as_str());
        let refresh = j.get("refresh_token").and_then(|v| v.as_str());
        let expires = j.get("expires_in").and_then(|v| v.as_u64()).unwrap_or(3600);
        let (Some(access), Some(refresh)) = (access, refresh) else {
            eprintln!("[gmail] token response missing access/refresh token: {}", j);
            return;
        };

        let email = fetch_profile(&client, access).await;
        if save_tokens(access, refresh, expires, &email).is_ok() {
            *outcome.lock().unwrap() = Some(GmailOAuthOutcome { email });
        }
    });

    open_browser(&auth_url);

    Ok(json!({
        "authUrl": auth_url,
        "port": port,
        "redirectUri": redirect_uri,
        "openedBrowser": true,
    }))
}

/// Poll the in-flight loopback flow until the code exchange completes.
#[tauri::command]
pub async fn gmail_oauth_finish(
    state: tauri::State<'_, GmailOAuthState>,
) -> Result<Value, String> {
    let poll_arc = state.outcome.lock().map_err(|_| "oauth state poisoned")?.clone();
    let Some(outcome) = poll_arc else {
        return Err("No OAuth flow in progress — call gmail_oauth_start first.".to_string());
    };

    let started = std::time::Instant::now();
    loop {
        if let Some(res) = outcome.lock().unwrap().clone() {
            return Ok(json!({ "email": res.email, "connected": true }));
        }
        if started.elapsed().as_secs() > OAUTH_TIMEOUT_SECS {
            break;
        }
        tokio::time::sleep(Duration::from_millis(300)).await;
    }
    Err(format!(
        "Authorization timed out ({}s). Complete the consent screen in the browser, then reconnect.",
        OAUTH_TIMEOUT_SECS
    ))
}

#[tauri::command]
pub fn gmail_oauth_cancel(state: tauri::State<'_, GmailOAuthState>) -> Result<(), String> {
    *state.outcome.lock().map_err(|_| "oauth state poisoned")? = None;
    Ok(())
}

fn parse_callback(head: &str) -> (String, String) {
    let request_line = head.lines().next().unwrap_or("");
    let path_with_query = request_line.split_whitespace().nth(1).unwrap_or("");
    let (path, query) = match path_with_query.split_once('?') {
        Some((p, q)) => (p, q),
        None => (path_with_query, ""),
    };
    if path != "/oauth2callback" {
        return (String::new(), String::new());
    }
    let mut code = String::new();
    let mut state = String::new();
    for pair in query.split('&') {
        if let Some((k, v)) = pair.split_once('=') {
            let v = url_decode(v);
            match k {
                "code" => code = v,
                "state" => state = v,
                _ => {}
            }
        }
    }
    (code, state)
}

#[tauri::command]
pub fn gmail_disconnect() -> Result<Value, String> {
    let file = tokens_file();
    let removed = if file.exists() {
        fs::remove_file(file).map_err(|e| format!("remove tokens: {}", e))?;
        true
    } else {
        false
    };
    Ok(json!({ "removed": removed }))
}

/// Run `timps gmail:sync` via the CLI. Returns exit code + console output.
#[tauri::command]
pub async fn gmail_sync() -> Result<GmailSyncResult, String> {
    let cli = find_cli_js().ok_or_else(|| {
        "Could not locate the TIMPS CLI (timps-code/dist/bin/timps.js). Build it with `npm run build` in timps-code, or set TIMPS_CLI_JS to the entry path.".to_string()
    })?;
    let output = tauri::async_runtime::spawn_blocking(move || {
        Command::new("node")
            .arg(&cli)
            .args(["gmail:sync"])
            .output()
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let combined = if stderr.trim().is_empty() {
        stdout
    } else {
        format!("{}\n{}", stdout, stderr)
    };

    Ok(GmailSyncResult {
        ok: output.status.success(),
        exit_code: output.status.code().unwrap_or(-1),
        output: combined
            .lines()
            .filter(|l| !l.trim().is_empty())
            .collect::<Vec<_>>()
            .join("\n")
            .chars()
            .take(4000)
            .collect(),
    })
}

/// Most recent email summaries, newest first.
#[tauri::command]
pub fn gmail_recent(limit: usize) -> Result<Vec<GmailSummaryEntry>, String> {
    let mut entries = read_summaries();
    entries.reverse();
    if limit > 0 {
        entries.truncate(limit);
    }
    Ok(entries)
}

/// Substring search over stored email summaries (subject/from/date/facts).
#[tauri::command]
pub fn gmail_query(query: String, limit: usize) -> Result<Vec<GmailSummaryEntry>, String> {
    let needle = query.to_lowercase();
    let mut matches: Vec<GmailSummaryEntry> = read_summaries()
        .into_iter()
        .filter(|e| e.matches(&needle))
        .collect();
    matches.reverse();
    if limit > 0 {
        matches.truncate(limit);
    }
    Ok(matches)
}

/// Enable/disable the daily auto-sync via the CLI (`timps gmail:cron`).
#[tauri::command]
pub async fn gmail_set_autosync(enabled: bool) -> Result<Value, String> {
    let cli = find_cli_js().ok_or_else(|| {
        "Could not locate the TIMPS CLI (timps-code/dist/bin/timps.js). Build it with `npm run build` in timps-code, or set TIMPS_CLI_JS to the entry path.".to_string()
    })?;
    let output = tauri::async_runtime::spawn_blocking(move || {
        if enabled {
            Command::new("node").arg(&cli).args(["gmail:cron"]).output()
        } else {
            Command::new("node")
                .arg(&cli)
                .args(["gmail:cron", "--remove"])
                .output()
        }
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(format!(
            "gmail:cron failed ({}): {}",
            output.status,
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(json!({
        "enabled": enabled,
        "message": String::from_utf8_lossy(&output.stdout)
            .lines()
            .filter(|l| !l.trim().is_empty())
            .collect::<Vec<_>>()
            .join(" "),
    }))
}

#[tauri::command]
pub fn gmail_autosync_status() -> Result<Value, String> {
    Ok(json!({ "enabled": autosync_plist().exists() }))
}

/// Full reset of the gmail app folder (client, tokens, state, summaries, raw).
/// Facts already distilled into TIMPS memory are NOT removed.
#[tauri::command]
pub fn gmail_reset() -> Result<Value, String> {
    let dir = gmail_dir();
    let existed = dir.exists();
    if existed {
        fs::remove_dir_all(&dir).map_err(|e| format!("reset gmail store: {}", e))?;
    }
    Ok(json!({
        "removed": existed,
        "dir": dir.to_string_lossy().to_string(),
    }))
}