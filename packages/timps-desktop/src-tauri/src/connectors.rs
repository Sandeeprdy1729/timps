// ── TIMPS Desktop — Multi-provider connectors ──────────────────────────────
// Grok-style connector engine: link external services (Gmail, Google Calendar,
// Google Drive, GitHub, Notion, Slack, Linear, Microsoft 365) via OAuth so the
// assistant can read/act on the user's data when asked.
//
// Flow (identical for every provider):
//   1. connector_connect(id) binds a 127.0.0.1 loopback listener on an
//      ephemeral port, builds the consent URL (PKCE when the provider is a
//      public client, client_secret otherwise), opens it in the browser.
//   2. The provider redirects back to http://localhost:<port>/oauth2callback.
//   3. The code is exchanged for tokens via reqwest (renderer does no network
//      I/O — CSP stays locked) and the refresh token is saved to
//      ~/.timps/<id>/tokens.json (same on-disk contract as the CLI gmail
//      service, so `timps <id>:sync` can reuse it).
//   4. connector_oauth_finish(id) polls until the exchange completes.
//
// Credentials live in ~/.timps/<id>/client.json (Google desktop-app JSON or a
// flat { "client_id", "client_secret"? } body) and can be imported via
// connector_import_credentials(id, path).

use serde::Serialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const GOOGLE_AUTH: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN: &str = "https://oauth2.googleapis.com/token";
const OAUTH_TIMEOUT_SECS: u64 = 300;

// ── Provider registry ───────────────────────────────────────────────────────

#[derive(Clone, Copy, PartialEq)]
enum Identity {
    UserinfoEmail,
    GithubLogin,
    NotionName,
    SlackUserTeam,
    LinearUser,
    MsUserPrincipal,
}

struct ProviderDef {
    id: &'static str,
    display: &'static str,
    auth_uri: &'static str,
    token_uri: &'static str,
    scopes: &'static [&'static str],
    /// Google-family providers need `access_type=offline&prompt=consent`.
    google_family: bool,
    /// Providers that require a client_secret (no PKCE). Others are public
    /// clients and use PKCE with no secret.
    secret_required: bool,
    identity: Identity,
}

fn providers() -> Vec<ProviderDef> {
    vec![
        ProviderDef {
            id: "gmail",
            display: "Gmail",
            auth_uri: GOOGLE_AUTH,
            token_uri: GOOGLE_TOKEN,
            scopes: &["https://www.googleapis.com/auth/gmail.readonly"],
            google_family: true,
            secret_required: true,
            identity: Identity::UserinfoEmail,
        },
        ProviderDef {
            id: "calendar",
            display: "Google Calendar",
            auth_uri: GOOGLE_AUTH,
            token_uri: GOOGLE_TOKEN,
            scopes: &["https://www.googleapis.com/auth/calendar.readonly"],
            google_family: true,
            secret_required: true,
            identity: Identity::UserinfoEmail,
        },
        ProviderDef {
            id: "drive",
            display: "Google Drive",
            auth_uri: GOOGLE_AUTH,
            token_uri: GOOGLE_TOKEN,
            scopes: &["https://www.googleapis.com/auth/drive.readonly"],
            google_family: true,
            secret_required: true,
            identity: Identity::UserinfoEmail,
        },
        ProviderDef {
            id: "github",
            display: "GitHub",
            auth_uri: "https://github.com/login/oauth/authorize",
            token_uri: "https://github.com/login/oauth/access_token",
            scopes: &["read:user", "user:email", "repo"],
            google_family: false,
            secret_required: true,
            identity: Identity::GithubLogin,
        },
        ProviderDef {
            id: "notion",
            display: "Notion",
            auth_uri: "https://api.notion.com/v1/oauth/authorize",
            token_uri: "https://api.notion.com/v1/oauth/token",
            scopes: &[],
            google_family: false,
            secret_required: false,
            identity: Identity::NotionName,
        },
        ProviderDef {
            id: "slack",
            display: "Slack",
            auth_uri: "https://slack.com/oauth/v2/authorize",
            token_uri: "https://slack.com/api/oauth.v2.access",
            scopes: &[
                "channels:history",
                "groups:history",
                "im:history",
                "mpim:history",
                "users:read",
                "team:read",
            ],
            google_family: false,
            secret_required: false,
            identity: Identity::SlackUserTeam,
        },
        ProviderDef {
            id: "linear",
            display: "Linear",
            auth_uri: "https://linear.app/oauth/authorize",
            token_uri: "https://api.linear.app/oauth/token",
            scopes: &["read"],
            google_family: false,
            secret_required: false,
            identity: Identity::LinearUser,
        },
        ProviderDef {
            id: "ms365",
            display: "Microsoft 365",
            auth_uri: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
            token_uri: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
            scopes: &[
                "User.Read",
                "Mail.Read",
                "Calendars.Read",
                "Files.Read.All",
                "offline_access",
            ],
            google_family: false,
            secret_required: false,
            identity: Identity::MsUserPrincipal,
        },
    ]
}

fn provider(id: &str) -> Option<ProviderDef> {
    providers().into_iter().find(|p| p.id == id)
}

// ── Paths ────────────────────────────────────────────────────────────────────

fn home_dir() -> String {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string())
}

fn provider_dir(id: &str) -> PathBuf {
    if let Ok(dir) = std::env::var(format!("TIMPS_{}_DIR", id.to_uppercase())) {
        if !dir.is_empty() {
            return PathBuf::from(dir);
        }
    }
    PathBuf::from(home_dir()).join(".timps").join(id)
}

fn tokens_file(id: &str) -> PathBuf {
    provider_dir(id).join("tokens.json")
}

fn client_file(id: &str) -> PathBuf {
    provider_dir(id).join("client.json")
}

fn summaries_file(id: &str) -> PathBuf {
    provider_dir(id).join("summaries.jsonl")
}

// ── Small helpers ────────────────────────────────────────────────────────────

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
/// the loopback callback).
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

/// Entropy for PKCE verifiers. Reads /dev/urandom on unix; falls back to a
/// time/pid hash on other platforms.
fn random_bytes(n: usize) -> Vec<u8> {
    #[cfg(unix)]
    {
        if let Ok(mut f) = fs::File::open("/dev/urandom") {
            use std::io::Read;
            let mut buf = vec![0u8; n];
            if f.read_exact(&mut buf).is_ok() {
                return buf;
            }
        }
    }
    let start = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    (0..n)
        .map(|i| {
            (start.as_nanos() as u8)
                .wrapping_mul(131)
                .wrapping_add(i as u8)
                .wrapping_mul(17)
                .wrapping_add(std::process::id() as u8)
        })
        .collect()
}

/// Minimal RFC 4648 base64url (no padding) — enough for PKCE values.
fn base64url(bytes: &[u8]) -> String {
    const TABLE: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut out = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0];
        let b1 = *chunk.get(1).unwrap_or(&0);
        let b2 = *chunk.get(2).unwrap_or(&0);
        out.push(TABLE[(b0 >> 2) as usize] as char);
        out.push(TABLE[(((b0 & 0x03) << 4) | (b1 >> 4)) as usize] as char);
        if chunk.len() > 1 {
            out.push(TABLE[(((b1 & 0x0f) << 2) | (b2 >> 6)) as usize] as char);
        }
        if chunk.len() > 2 {
            out.push(TABLE[(b2 & 0x3f) as usize] as char);
        }
    }
    out
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

fn open_browser(url: &str) {
    #[cfg(target_os = "macos")]
    let _ = Command::new("open").arg(url).spawn();
    #[cfg(target_os = "linux")]
    let _ = Command::new("xdg-open").arg(url).spawn();
    #[cfg(target_os = "windows")]
    let _ = Command::new("cmd").args(["/c", "start", "", url]).spawn();
}

// ── Credentials ──────────────────────────────────────────────────────────────

struct ClientCreds {
    client_id: String,
    client_secret: Option<String>,
}

/// Loads `client.json`. Accepts Google's downloaded client JSON (flat,
/// `{ installed: ... }` or `{ web: ... }`) or a flat `{ client_id, client_secret? }`.
fn load_client(id: &str) -> Result<ClientCreds, String> {
    let file = client_file(id);
    let raw = fs::read_to_string(&file).map_err(|_| {
        format!(
            "No {} OAuth credentials found. Create an OAuth app for this provider and import its client JSON (Connectors → Credentials).",
            id
        )
    })?;
    let parsed: Value =
        serde_json::from_str(&raw).map_err(|_| format!("{} is not valid JSON.", file.display()))?;
    let section = parsed
        .get("installed")
        .or_else(|| parsed.get("web"))
        .unwrap_or(&parsed);
    let client_id = section
        .get("client_id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| format!("client.json for {} is missing client_id.", id))?
        .to_string();
    let client_secret = section
        .get("client_secret")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    Ok(ClientCreds {
        client_id,
        client_secret,
    })
}

fn has_tokens(id: &str) -> bool {
    read_json::<Value>(&tokens_file(id)).is_ok()
}

fn save_tokens(id: &str, access: &str, refresh: &str, expires_in: u64, account: &str) -> Result<(), String> {
    let def = provider(id).ok_or_else(|| format!("unknown connector: {}", id))?;
    let tokens = json!({
        "accessToken": access,
        "refreshToken": refresh,
        "expiresAt": now_millis() + expires_in as i64 * 1000,
        "scopes": def.scopes,
        "email": account,
        "obtainedAt": now_millis(),
    });
    write_mode(
        &tokens_file(id),
        &serde_json::to_string_pretty(&tokens).unwrap(),
        0o600,
    )
}

// ── Identity (account name shown in the UI) ─────────────────────────────────

async fn fetch_identity(client: &reqwest::Client, kind: Identity, access: &str) -> String {
    match kind {
        Identity::UserinfoEmail => {
            let j = get_json(client, "https://www.googleapis.com/oauth2/v2/userinfo", access).await;
            j.get("email")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string()
        }
        Identity::GithubLogin => {
            let j = get_json(client, "https://api.github.com/user", access).await;
            j.get("login")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string()
        }
        Identity::NotionName => {
            let j = get_json_with_header(
                client,
                "https://api.notion.com/v1/users/me",
                access,
                "Notion-Version",
                "2022-06-28",
            )
            .await;
            j.get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string()
        }
        Identity::SlackUserTeam => {
            let resp = client
                .post("https://slack.com/api/auth.test")
                .form(&[("token", access)])
                .send()
                .await;
            match resp {
                Ok(r) => {
                    let j: Value = r.json().await.unwrap_or(Value::Null);
                    let user = j.get("user").and_then(|v| v.as_str()).unwrap_or("unknown");
                    let team = j.get("team").and_then(|v| v.as_str()).unwrap_or("");
                    if team.is_empty() {
                        user.to_string()
                    } else {
                        format!("{} ({})", user, team)
                    }
                }
                Err(_) => "unknown".to_string(),
            }
        }
        Identity::LinearUser => {
            let resp = client
                .post("https://api.linear.app/graphql")
                .bearer_auth(access)
                .json(&json!({ "query": "{ viewer { name email } }" }))
                .send()
                .await;
            match resp {
                Ok(r) => {
                    let j: Value = r.json().await.unwrap_or(Value::Null);
                    let viewer = j.get("data").and_then(|d| d.get("viewer"));
                    let name = viewer
                        .and_then(|v| v.get("name"))
                        .and_then(|v| v.as_str());
                    let email = viewer
                        .and_then(|v| v.get("email"))
                        .and_then(|v| v.as_str());
                    email
                        .or(name)
                        .unwrap_or("unknown")
                        .to_string()
                }
                Err(_) => "unknown".to_string(),
            }
        }
        Identity::MsUserPrincipal => {
            let j = get_json(
                client,
                "https://graph.microsoft.com/v1.0/me",
                access,
            )
            .await;
            j.get("userPrincipalName")
                .and_then(|v| v.as_str())
                .or_else(|| j.get("displayName").and_then(|v| v.as_str()))
                .unwrap_or("unknown")
                .to_string()
        }
    }
}

async fn get_json(client: &reqwest::Client, url: &str, access: &str) -> Value {
    get_json_with_header(client, url, access, "", "").await
}

async fn get_json_with_header(
    client: &reqwest::Client,
    url: &str,
    access: &str,
    header_name: &str,
    header_value: &str,
) -> Value {
    let mut req = client.get(url).bearer_auth(access);
    if !header_name.is_empty() {
        req = req.header(header_name, header_value);
    }
    match req.send().await {
        Ok(r) => r.json().await.unwrap_or(Value::Null),
        Err(_) => Value::Null,
    }
}

// ── Managed state (one in-flight flow per connector) ─────────────────────────

#[derive(Clone)]
pub struct ConnectorOutcome {
    pub account: String,
}

#[derive(Default)]
pub struct ConnectorState {
    pub flows: Mutex<HashMap<String, Arc<Mutex<Option<ConnectorOutcome>>>>>,
}

// ── Command: list all connectors ─────────────────────────────────────────────

#[derive(Serialize)]
pub struct ConnectorEntry {
    pub id: String,
    #[serde(rename = "display")]
    pub display_name: String,
    pub connected: bool,
    pub account: String,
    #[serde(rename = "hasCredentials")]
    pub has_credentials: bool,
    #[serde(rename = "lastRun")]
    pub last_run: Option<String>,
    #[serde(rename = "syncedCount")]
    pub synced_count: usize,
    pub scopes: usize,
}

fn connector_entry(def: &ProviderDef) -> ConnectorEntry {
    let tokens: Option<Value> = read_json(&tokens_file(def.id)).ok();
    let account = tokens
        .as_ref()
        .and_then(|t| t.get("email"))
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();
    let state: Value = read_json::<Value>(&provider_dir(def.id).join("state.json")).unwrap_or(json!({}));
    let last_run = state
        .get("lastRun")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let synced_count = summaries_file(def.id)
        .exists()
        .then(|| {
            fs::read_to_string(summaries_file(def.id))
                .map(|raw| raw.lines().count())
                .unwrap_or(0)
        })
        .unwrap_or(0);
    ConnectorEntry {
        id: def.id.to_string(),
        display_name: def.display.to_string(),
        connected: has_tokens(def.id),
        account,
        has_credentials: client_file(def.id).exists(),
        last_run,
        synced_count,
        scopes: def.scopes.len(),
    }
}

#[tauri::command]
pub fn connector_list() -> Result<Vec<ConnectorEntry>, String> {
    Ok(providers().iter().map(connector_entry).collect())
}

#[tauri::command]
pub fn connector_status(id: String) -> Result<ConnectorEntry, String> {
    let def = provider(&id).ok_or_else(|| format!("unknown connector: {}", id))?;
    Ok(connector_entry(&def))
}

// ── Command: import credentials ──────────────────────────────────────────────

#[tauri::command]
pub fn connector_import_credentials(id: String, file_path: String) -> Result<Value, String> {
    let def = provider(&id).ok_or_else(|| format!("unknown connector: {}", id))?;
    let src = PathBuf::from(&file_path);
    let raw =
        fs::read_to_string(&src).map_err(|e| format!("cannot read {}: {}", file_path, e))?;
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
    if def.secret_required && section.get("client_secret").is_none() {
        return Err(format!(
            "{} requires a client_secret in the credential file.",
            def.display
        ));
    }
    fs::create_dir_all(provider_dir(&id))
        .map_err(|e| format!("mkdir {}: {}", provider_dir(&id).display(), e))?;
    let body = serde_json::to_string_pretty(section).unwrap();
    write_mode(&client_file(&id), &body, 0o600)?;
    Ok(json!({
        "clientId": client_id,
        "saved": client_file(&id).to_string_lossy(),
    }))
}

// ── Command: begin the loopback OAuth flow ───────────────────────────────────

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
pub async fn connector_connect(
    id: String,
    state: tauri::State<'_, ConnectorState>,
) -> Result<Value, String> {
    let def = provider(&id).ok_or_else(|| format!("unknown connector: {}", id))?;
    let creds = load_client(&id)?;

    let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
        .await
        .map_err(|e| format!("could not bind loopback listener: {}", e))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("could not read listener port: {}", e))?
        .port();
    let redirect_uri = format!("http://localhost:{}/oauth2callback", port);
    let state_token = random_state(&creds.client_id);

    // PKCE for public clients (no client_secret).
    let (verifier, challenge) = if def.secret_required || creds.client_secret.is_some() {
        (None, None)
    } else {
        let v = base64url(&random_bytes(48)).to_string();
        let hasher = Sha256::new();
        let digest = hasher.chain_update(v.as_bytes()).finalize();
        (Some(v), Some(base64url(&digest)))
    };

    let scope = def.scopes.join(" ");
    let mut auth_url = format!(
        "{}?client_id={}&redirect_uri={}&response_type=code&scope={}&state={}",
        def.auth_uri,
        urlencode(&creds.client_id),
        urlencode(&redirect_uri),
        urlencode(&scope),
        state_token,
    );
    if def.google_family {
        auth_url.push_str("&access_type=offline&prompt=consent");
    }
    if verifier.is_some() {
        let challenge = challenge.as_deref().unwrap_or("");
        auth_url.push_str(&format!(
            "&code_challenge={}&code_challenge_method=S256",
            challenge
        ));
    }

    let outcome = Arc::new(Mutex::new(None::<ConnectorOutcome>));
    state
        .flows
        .lock()
        .map_err(|_| "connector state poisoned")?
        .insert(id.clone(), outcome.clone());

    let client = reqwest::Client::new();
    let token_uri = def.token_uri.to_string();
    let client_id = creds.client_id.clone();
    let client_secret = creds.client_secret.clone();
    let redirect = redirect_uri.clone();
    let state_owned = state_token;
    let provider_id = def.id.to_string();
    let identity = def.identity;
    let verifier_owned = verifier;

    tauri::async_runtime::spawn(async move {
        let accept_fut = listener.accept();
        let (mut stream, _) = match tokio::time::timeout(
            Duration::from_secs(OAUTH_TIMEOUT_SECS),
            accept_fut,
        )
        .await
        {
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
                format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n<h3>&#10003; TIMPS connected.</h3><p>You can close this tab and return to TIMPS.</p>"
                )
                .as_bytes(),
            )
            .await;

        let mut params: Vec<(String, String)> = vec![
            ("grant_type".to_string(), "authorization_code".to_string()),
            ("client_id".to_string(), client_id.clone()),
            ("code".to_string(), code.clone()),
            ("redirect_uri".to_string(), redirect.clone()),
        ];
        if let Some(secret) = client_secret.as_deref() {
            params.push(("client_secret".to_string(), secret.to_string()));
        }
        if let Some(verifier) = verifier_owned.as_deref() {
            params.push(("code_verifier".to_string(), verifier.to_string()));
        }

        let token_resp = match client.post(&token_uri).form(&params).send().await {
            Ok(r) => match r.error_for_status() {
                Ok(r) => r,
                Err(e) => {
                    eprintln!("[connectors] {} token exchange error: {}", provider_id, e);
                    return;
                }
            },
            Err(e) => {
                eprintln!("[connectors] {} token exchange network error: {}", provider_id, e);
                return;
            }
        };
        let j: Value = token_resp.json().await.unwrap_or(Value::Null);
        let access = j.get("access_token").and_then(|v| v.as_str());
        let refresh = j.get("refresh_token").and_then(|v| v.as_str());
        let expires = j.get("expires_in").and_then(|v| v.as_u64()).unwrap_or(3600);
        let (Some(access), Some(refresh)) = (access, refresh) else {
            eprintln!("[connectors] {} token response missing tokens: {}", provider_id, j);
            return;
        };

        let account = fetch_identity(&client, identity, access).await;
        if save_tokens(&provider_id, access, refresh, expires, &account).is_ok() {
            *outcome.lock().unwrap() = Some(ConnectorOutcome { account });
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

// ── Command: poll until the flow completes ───────────────────────────────────

#[tauri::command]
pub async fn connector_oauth_finish(
    id: String,
    state: tauri::State<'_, ConnectorState>,
) -> Result<Value, String> {
    let poll_arc = state
        .flows
        .lock()
        .map_err(|_| "connector state poisoned")?
        .get(&id)
        .cloned();
    let Some(outcome) = poll_arc else {
        return Err(format!(
            "No OAuth flow in progress for {} — call connector_connect first.",
            id
        ));
    };

    let started = std::time::Instant::now();
    loop {
        if let Some(res) = outcome.lock().unwrap().clone() {
            return Ok(json!({ "account": res.account, "connected": true }));
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
pub fn connector_oauth_cancel(id: String, state: tauri::State<'_, ConnectorState>) -> Result<(), String> {
    state
        .flows
        .lock()
        .map_err(|_| "connector state poisoned")?
        .remove(&id);
    Ok(())
}

// ── Command: disconnect / reset ──────────────────────────────────────────────

#[tauri::command]
pub fn connector_disconnect(id: String) -> Result<Value, String> {
    let def = provider(&id).ok_or_else(|| format!("unknown connector: {}", id))?;
    let file = tokens_file(def.id);
    let removed = if file.exists() {
        fs::remove_file(&file).map_err(|e| format!("remove tokens: {}", e))?;
        true
    } else {
        false
    };
    Ok(json!({ "removed": removed }))
}

#[tauri::command]
pub fn connector_reset(id: String) -> Result<Value, String> {
    let def = provider(&id).ok_or_else(|| format!("unknown connector: {}", id))?;
    let dir = provider_dir(def.id);
    let existed = dir.exists();
    if existed {
        fs::remove_dir_all(&dir).map_err(|e| format!("reset {} store: {}", id, e))?;
    }
    Ok(json!({ "removed": existed, "dir": dir.to_string_lossy().to_string() }))
}

// ── Command: sync data into TIMPS memory ─────────────────────────────────────

/// Locate the TIMPS CLI entry (`timps-code/dist/bin/timps.js`) by walking up
/// from the current executable. Override with TIMPS_CLI_JS.
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

#[derive(Serialize)]
pub struct ConnectorSyncResult {
    pub ok: bool,
    #[serde(rename = "exitCode")]
    pub exit_code: i32,
    pub output: String,
}

#[tauri::command]
pub async fn connector_sync(id: String) -> Result<ConnectorSyncResult, String> {
    let def = provider(&id).ok_or_else(|| format!("unknown connector: {}", id))?;
    if !has_tokens(def.id) {
        return Err(format!("{} is not connected.", def.display));
    }
    let cli = match find_cli_js() {
        Some(p) => p,
        None => {
            return Ok(ConnectorSyncResult {
                ok: false,
                exit_code: -1,
                output: format!(
                    "Sync needs the TIMPS CLI ({}-based streaming into memory is on the roadmap, but the CLI implements it). Build with `npm run build` in timps-code.",
                    def.display
                ),
            })
        }
    };
    let subcommand = format!("{}:sync", def.id);
    let output = tauri::async_runtime::spawn_blocking(move || {
        Command::new("node").arg(&cli).arg(&subcommand).output()
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

    Ok(ConnectorSyncResult {
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