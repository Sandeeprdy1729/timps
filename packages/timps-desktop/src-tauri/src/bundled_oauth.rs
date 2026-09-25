// ── TIMPS Desktop — Bundled OAuth clients ──────────────────────────────────
// One-click connectors. Claude/Grok ship their own registered OAuth app so the
// user clicks "Connect" and only sees the provider's consent screen. This
// module is the equivalent for TIMPS: TIMPS owns the Google Cloud project, so
// the desktop app carries the client_id/secret and no Google Cloud setup is
// needed on the user's machine.
//
// Resolution order (first hit wins):
//   1. ~/.timps/<id>/client.json   — user override, written by
//      `connector_import_credentials` / `connector_save_credentials`.
//   2. TIMPS_<ID>_CLIENT_ID + TIMPS_<ID>_CLIENT_SECRET env vars — for
//      contributors who want their own Google Cloud project.
//   3. Compile-time injection via `option_env!` — official release builds bake
//      the TIMPS-owned client in from CI secrets, so a fresh install connects
//      with no setup while the credential itself never enters git. Build with:
//        TIMPS_BUNDLED_GOOGLE_CLIENT_ID=… TIMPS_BUNDLED_GOOGLE_CLIENT_SECRET=… \
//          cargo tauri build
//
// The credential is deliberately NOT committed. A from-source build without
// step 1–3 simply has no bundled client, and the Connectors UI falls back to
// the guided credential-import flow rather than failing.

use serde_json::Value;
use std::fs;
use std::path::PathBuf;

use crate::connectors::provider_dir;

/// A resolved OAuth client for one provider.
#[derive(Clone, Debug)]
pub struct OAuthClient {
    pub client_id: String,
    pub client_secret: Option<String>,
    pub token_uri: String,
    /// Where these credentials came from — surfaced in logs when debugging a
    /// connector that resolves to the wrong OAuth app.
    pub source: &'static str,
}

/// TIMPS-owned Google Cloud project. Desktop-app OAuth client, Gmail readonly
/// scope. The same client works for calendar + drive.
///
/// Injected at compile time so the secret stays out of the repository. Both
/// must be present for the bundled path to be considered available, so a
/// half-configured build degrades to the guided setup instead of failing
/// mid-OAuth.
const BUNDLED_GOOGLE_CLIENT_ID: Option<&str> = option_env!("TIMPS_BUNDLED_GOOGLE_CLIENT_ID");
const BUNDLED_GOOGLE_CLIENT_SECRET: Option<&str> = option_env!("TIMPS_BUNDLED_GOOGLE_CLIENT_SECRET");

const GOOGLE_TOKEN_URI: &str = "https://oauth2.googleapis.com/token";

/// Environment variable prefix for a provider, e.g. gmail → `TIMPS_GMAIL_`.
fn env_key(id: &str) -> String {
    id.to_uppercase().replace(|c: char| !c.is_ascii_alphanumeric(), "_")
}

fn env_var(id: &str, suffix: &str) -> String {
    format!("TIMPS_{}_{}", env_key(id), suffix)
}

fn client_file(id: &str) -> PathBuf {
    provider_dir(id).join("client.json")
}

/// The TIMPS-owned client, when this provider can use the bundled path.
///
/// Only the Google family can: the other providers (GitHub, Slack, Notion,
/// Linear, Microsoft) each require the user to register *their own* OAuth app
/// on that provider's developer console, so there is nothing we can ship.
pub fn bundled_client(id: &str) -> Option<OAuthClient> {
    // Only the Google family can: the other providers (GitHub, Slack, Notion,
    // Linear, Microsoft) each require the user to register *their own* OAuth
    // app on that provider's developer console, so there is nothing we ship.
    if !matches!(id, "gmail" | "calendar" | "drive") {
        return None;
    }
    google_bundled_client(
        BUNDLED_GOOGLE_CLIENT_ID,
        BUNDLED_GOOGLE_CLIENT_SECRET,
    )
}

/// Build the Google bundled client from compile-time injected values.
///
/// Split out from `bundled_client` so the both-present / one-missing / neither
/// cases are testable without needing an actual injected build secret.
fn google_bundled_client(
    client_id: Option<&str>,
    client_secret: Option<&str>,
) -> Option<OAuthClient> {
    // Both halves must be baked in. A build with only the id would otherwise
    // advertise one-click Connect and then fail at the token exchange.
    let cid = client_id?;
    let csec = client_secret?;
    if cid.is_empty() || csec.is_empty() {
        return None;
    }
    Some(OAuthClient {
        client_id: cid.to_string(),
        client_secret: Some(csec.to_string()),
        token_uri: GOOGLE_TOKEN_URI.to_string(),
        source: "bundled",
    })
}

/// True when TIMPS ships an OAuth app for this provider, so the user can
/// connect with one click and never touch a developer console. Drives whether
/// the UI hides the credential form. Independent of whether a local
/// `client.json` override happens to exist.
pub fn bundled_available(id: &str) -> bool {
    bundled_client(id).is_some()
}

/// Read `client.json` (Google's downloaded layout: flat, `{installed}`, or
/// `{web}`) from the provider folder.
fn read_client_file(id: &str) -> Option<OAuthClient> {
    let file: PathBuf = client_file(id);
    let raw = fs::read_to_string(&file).ok()?;
    let parsed: Value = serde_json::from_str(&raw).ok()?;
    let section = parsed
        .get("installed")
        .or_else(|| parsed.get("web"))
        .unwrap_or(&parsed);
    let client_id = section.get("client_id").and_then(|v| v.as_str())?.to_string();
    if client_id.is_empty() {
        return None;
    }
    Some(OAuthClient {
        client_id,
        client_secret: section
            .get("client_secret")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        token_uri: section
            .get("token_uri")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| GOOGLE_TOKEN_URI.to_string()),
        source: "custom",
    })
}

/// Resolve the OAuth client to use for `id`, preferring user config over the
/// bundled default so a power user's own project always wins.
pub fn resolve(id: &str) -> Result<OAuthClient, String> {
    if let Some(c) = read_client_file(id) {
        return Ok(c);
    }
    if let (Ok(cid), Ok(csec)) = (
        std::env::var(env_var(id, "CLIENT_ID")),
        std::env::var(env_var(id, "CLIENT_SECRET")),
    ) {
        if !cid.trim().is_empty() {
            return Ok(OAuthClient {
                client_id: cid,
                client_secret: Some(csec),
                token_uri: GOOGLE_TOKEN_URI.to_string(),
                source: "env",
            });
        }
    }
    bundled_client(id).ok_or_else(|| {
        format!(
            "No OAuth credentials for {}. Create an OAuth app for this provider and import its client JSON (Connectors → Credentials).",
            id
        )
    })
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use std::sync::MutexGuard;

    /// These tests all override `TIMPS_GMAIL_DIR`, which is process-global.
    /// Rust runs test fns on parallel threads, so they must be serialized or
    /// they read each other's temp dirs and fail nondeterministically.
    ///
    /// Shared with `gmail_sync`'s tests: two separate mutexes would not
    /// serialize against each other, and those tests also override this var.
    pub(crate) fn env_lock() -> MutexGuard<'static, ()> {
        crate::TEST_ENV_LOCK
            .lock()
            .unwrap_or_else(|e| e.into_inner())
    }

    /// Run `f` with `TIMPS_GMAIL_DIR` pointed at an empty temp dir, so results
    /// don't depend on whatever client.json the developer has on disk.
    fn with_isolated_dir(name: &str, body: impl FnOnce(&std::path::Path)) {
        let _guard = env_lock();
        let tmp = std::env::temp_dir().join(name);
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        std::env::set_var("TIMPS_GMAIL_DIR", &tmp);
        body(&tmp);
        std::env::remove_var("TIMPS_GMAIL_DIR");
        let _ = fs::remove_dir_all(&tmp);
    }

    // The bundled credential is injected at compile time, so these assertions
    // are conditional: a plain `cargo test` has none, while a release build
    // (or `cargo test` with TIMPS_BUNDLED_GOOGLE_CLIENT_ID/SECRET set) does.
    // What must hold in *both* worlds is that the Google family shares one
    // decision and the non-Google providers never do.
    fn injected() -> bool {
        BUNDLED_GOOGLE_CLIENT_ID.is_some() && BUNDLED_GOOGLE_CLIENT_SECRET.is_some()
    }

    #[test]
    fn google_family_shares_bundled_availability() {
        let g = bundled_available("gmail");
        assert_eq!(bundled_available("calendar"), g, "calendar must match gmail");
        assert_eq!(bundled_available("drive"), g, "drive must match gmail");
        assert_eq!(g, injected(), "availability must track injection");
    }

    #[test]
    fn bundled_requires_both_id_and_secret() {
        // A half-injected build must not advertise one-click Connect, or the
        // user clicks through and then fails at the token exchange.
        assert!(google_bundled_client(Some("id"), Some("sec")).is_some());
        assert!(google_bundled_client(None, Some("sec")).is_none());
        assert!(google_bundled_client(Some("id"), None).is_none());
        assert!(google_bundled_client(None, None).is_none());
        assert!(google_bundled_client(Some(""), Some("sec")).is_none());
        assert!(google_bundled_client(Some("id"), Some("")).is_none());
    }

    #[test]
    fn injected_bundle_is_well_formed() {
        let Some(cid) = BUNDLED_GOOGLE_CLIENT_ID else {
            return; // nothing injected in this build
        };
        let c = google_bundled_client(BUNDLED_GOOGLE_CLIENT_ID, BUNDLED_GOOGLE_CLIENT_SECRET)
            .expect("both injected");
        assert_eq!(c.client_id, cid);
        assert_eq!(c.source, "bundled");
        assert!(c.client_secret.is_some());
        assert!(c.token_uri.starts_with("https://oauth2"));
        // A Google client_id must be an apps.googleusercontent.com value.
        assert!(
            cid.ends_with(".apps.googleusercontent.com"),
            "unexpected client_id shape: {}",
            cid
        );
    }

    #[test]
    fn non_google_providers_have_no_bundled_client() {
        // These genuinely require the user to register their own OAuth app.
        for id in ["github", "slack", "notion", "linear", "ms365"] {
            assert!(!bundled_available(id), "{} should not be bundled", id);
            assert!(bundled_client(id).is_none());
        }
    }

    #[test]
    fn resolves_bundled_when_no_local_file() {
        with_isolated_dir("timps-bundled-oauth-test-empty", |_| {
            if !injected() {
                // No bundled credential in this build: resolution must fail
                // cleanly rather than hand back an empty client.
                assert!(resolve("gmail").is_err(), "must not fabricate a client");
                return;
            }
            let client = resolve("gmail").expect("gmail must resolve when injected");
            assert_eq!(client.client_id, BUNDLED_GOOGLE_CLIENT_ID.unwrap());
            assert_eq!(client.source, "bundled");
            assert!(client.client_secret.is_some());
            assert!(client.token_uri.starts_with("https://oauth2"));
        });
    }

    #[test]
    fn local_client_json_overrides_bundled() {
        // A power user pointing TIMPS at their own Google Cloud project must
        // win over the shipped app, without rebuilding.
        with_isolated_dir("timps-bundled-oauth-test-custom", |tmp| {
            fs::write(
                tmp.join("client.json"),
                r#"{"installed":{"client_id":"my-own-client.apps.googleusercontent.com",
                     "client_secret":"my-own-secret",
                     "auth_uri":"https://accounts.google.com/o/oauth2/auth",
                     "token_uri":"https://oauth2.googleapis.com/token"}}"#,
            )
            .unwrap();
            let client = resolve("gmail").expect("gmail must always resolve");
            assert_eq!(client.client_id, "my-own-client.apps.googleusercontent.com");
            assert_eq!(client.client_secret.as_deref(), Some("my-own-secret"));
            assert_eq!(client.source, "custom");
        });
    }

    #[test]
    fn accepts_flat_client_json_layout() {
        // `connector_save_credentials` writes the flat form.
        with_isolated_dir("timps-bundled-oauth-test-flat", |tmp| {
            fs::write(
                tmp.join("client.json"),
                r#"{"client_id":"flat-id.apps.googleusercontent.com"}"#,
            )
            .unwrap();
            let client = resolve("gmail").expect("flat layout must parse");
            assert_eq!(client.client_id, "flat-id.apps.googleusercontent.com");
            // No secret present — must still be usable as a public client.
            assert!(client.client_secret.is_none());
        });
    }

    #[test]
    fn ignores_malformed_client_json_and_falls_back() {
        // A corrupt override must not brick Connect — fall back to whatever is
        // next in the chain (the injected bundle, else a clean error).
        with_isolated_dir("timps-bundled-oauth-test-bad", |tmp| {
            fs::write(tmp.join("client.json"), "{not json").unwrap();
            if injected() {
                let client = resolve("gmail").expect("must fall back to bundled");
                assert_eq!(client.source, "bundled");
            } else {
                // Nothing to fall back to: must error, not return a stub with
                // an empty client_id that would fail confusingly at Google.
                assert!(resolve("gmail").is_err());
            }
        });
    }

    #[test]
    fn never_returns_an_empty_client_id() {
        // Whatever the source, an empty client_id would produce a Google error
        // that looks like a network problem.
        with_isolated_dir("timps-bundled-oauth-test-empty-id", |tmp| {
            fs::write(tmp.join("client.json"), r#"{"installed":{"client_id":""}}"#).unwrap();
            if let Ok(c) = resolve("gmail") {
                assert!(!c.client_id.is_empty(), "resolved an empty client_id");
            }
        });
    }

    #[test]
    fn unknown_provider_does_not_resolve() {
        assert!(resolve("github").is_err());
    }
}
