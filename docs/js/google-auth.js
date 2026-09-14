/* ── Google sign-in (Google Identity Services, client-side OAuth) ──
 * Real Google OAuth needs a Client ID from Google Cloud Console.
 * Put yours here (Application type: Web application), then add this site's
 * origin to Authorized JavaScript origins:
 *   https://sandeeprdy1729.github.io
 * Leave empty to fall back to a copyable local CLI connect command.
 */
const GOOGLE_CLIENT_ID = '';

(function () {
  const btnHost = document.getElementById('google-btn');
  if (!btnHost) return;

  const startClickHandoff = () => {
    const cmd = 'timps gmail:connect';
    navigator.clipboard.writeText(cmd).then(() => {
      btnHost.innerHTML = '<span style="font-size:13px;color:var(--ink-3)">Copied <code>timps gmail:connect</code> — open the Gmail page to connect locally.</span>';
    }).catch(() => {
      btnHost.innerHTML = '<span style="font-size:13px;color:var(--ink-3)">Run <code>timps gmail:connect</code> locally to connect.</span>';
    });
  };

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_ID.endsWith('apps.googleusercontent.com')) {
    const a = document.createElement('a');
    a.href = 'gmail.html';
    a.className = 'btn btn-primary btn-lg';
    a.style.cssText = 'display:flex;width:100%;justify-content:center;gap:10px;align-items:center';
    a.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"/></svg> Continue with Google';
    a.addEventListener('click', startClickHandoff);
    btnHost.appendChild(a);
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
        if (resp.error) {
          btnHost.innerHTML = '<span style="font-size:13px;color:var(--red)">Sign-in failed: ' + resp.error + '</span>';
          return;
        }
        try {
          const base64 = resp.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(decodeURIComponent(escape(atob(base64))));
          btnHost.innerHTML = '<span style="display:flex;align-items:center;gap:10px;justify-content:center"><img src="' + (payload.picture || '') + '" width="26" height="26" style="border-radius:50%" referrerpolicy="no-referrer"> <span style="font-size:15px;font-weight:600">' + (payload.name || payload.email) + '</span></span>';
        } catch (e) {
          btnHost.innerHTML = '<span style="font-size:13px;color:var(--green)">Signed in with Google ✓</span>';
        }
      }
    });
    google.accounts.id.renderButton(btnHost, {
      type: 'standard', theme: 'outline', size: 'large',
      text: 'continue_with', shape: 'pill',
      width: 260, logo_alignment: 'left'
    });
  };
  document.head.appendChild(script);
})();