/* ── Google sign-in (Google Identity Services, client-side OAuth) ──
 * Real Google OAuth needs a Client ID from Google Cloud Console.
 * Put yours here (Application type: Web application), then add this site's
 * origin to Authorized JavaScript origins:
 *   https://sandeeprdy1729.github.io
 * Leave empty to fall back to a copyable local CLI connect command.
 */
const GOOGLE_CLIENT_ID = '';

(function () {
  const reminder = 'Go to console.cloud.google.com → Credentials → Create "Web application" client, add this origin to Authorized JS origins, then set GOOGLE_CLIENT_ID in js/google-auth.js.';
  const btnWrap = document.getElementById('google-btn-wrap');
  const btnHost = document.getElementById('google-btn');
  const signedIn = document.getElementById('signed-in');
  const signoutBtn = document.getElementById('si-signout');
  const noteEl = document.getElementById('login-note');
  const LS_KEY = 'timps.google.session';

  function note(msg, isError = true) {
    if (!noteEl) return;
    noteEl.textContent = msg;
    noteEl.hidden = !msg;
    noteEl.style.color = isError ? 'var(--red)' : 'var(--green)';
    noteEl.style.background = isError ? 'rgba(180,67,46,0.08)' : 'rgba(46,125,91,0.08)';
    noteEl.style.borderColor = isError ? 'rgba(180,67,46,0.25)' : 'rgba(46,125,91,0.25)';
  }

  function decodeJwt(token) {
    try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(decodeURIComponent(escape(atob(base64))));
    } catch (e) {
      return null;
    }
  }

  function session() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { return null; }
  }

  function renderSignedIn(payload) {
    if (!signedIn) return;
    signedIn.hidden = false;
    if (btnWrap) btnWrap.hidden = true;
    if (document.getElementById('si-avatar')) document.getElementById('si-avatar').src = payload.picture || '';
    if (document.getElementById('si-name')) document.getElementById('si-name').textContent = payload.name || 'Signed in';
    if (document.getElementById('si-email')) document.getElementById('si-email').textContent = payload.email || '';
  }

  function renderSignedOut() {
    if (!signedIn) return;
    signedIn.hidden = true;
    if (btnWrap) btnWrap.hidden = false;
  }

  function writeSession(payload) {
    localStorage.setItem(LS_KEY, JSON.stringify({
      name: payload.name, email: payload.email, picture: payload.picture,
      sub: payload.sub, exp: payload.exp, at: Date.now()
    }));
    renderSignedIn(payload);
  }

  function clearSession() {
    localStorage.removeItem(LS_KEY);
    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
      google.accounts.id.disableAutoSelect();
    }
    renderSignedOut();
  }

  function startClickHandoff() {
    const cmd = 'timps gmail:connect';
    navigator.clipboard.writeText(cmd).then(() => {
      note('No Google Client ID configured yet. Copied "' + cmd + '" — run it in your terminal to connect locally instead.', false);
    }).catch(() => {
      note('No Google Client ID configured yet. Run "' + cmd + '" locally to connect.', false);
    });
    window.open('gmail.html', '_self');
  }

  function initButton() {
    if (!btnHost) return;
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_ID.endsWith('apps.googleusercontent.com')) {
      const a = document.createElement('a');
      a.href = 'gmail.html';
      a.className = 'btn btn-primary btn-lg';
      a.style.cssText = 'display:flex;width:100%;justify-content:center;gap:10px;align-items:center';
      a.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"/></svg> Connect with Google';
      a.id = 'google-fallback-link';
      a.addEventListener('click', startClickHandoff);
      btnHost.appendChild(a);
      note('Google sign-in needs a Client ID. Tap the button to run the local connect flow instead.', true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        ux_mode: 'popup',
        callback: (resp) => {
          if (resp.error) { note('Sign-in failed: ' + resp.error); return; }
          const payload = decodeJwt(resp.credential);
          if (!payload) { note('Could not decode Google ID token.'); return; }
          writeSession(payload);
          note('Signed in as ' + payload.email, false);
        }
      });
      google.accounts.id.renderButton(btnHost, {
        type: 'standard', theme: 'outline', size: 'large',
        text: 'continue_with', shape: 'pill',
        width: 340, logo_alignment: 'left'
      });
    };
    script.onerror = () => note('Failed to load Google Identity Services from accounts.google.com.');
    document.head.appendChild(script);
  }

  if (signoutBtn) signoutBtn.addEventListener('click', () => {
    clearSession();
    window.location.reload();
  });

  const existing = session();
  if (existing && Date.now() < existing.exp * 1000) {
    renderSignedIn(existing);
  } else {
    renderSignedOut();
  }
  initButton();
})();