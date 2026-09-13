/* ─────────────────────────────────────────────────────────────────────────── */
/* TIMPS connect.js — connector handoff + live status                        */
/*                                                                           */
/* The website is static. Connecting happens on the visitor's machine via    */
/* the real loopback OAuth flow the TIMPS CLI/desktop already implements:   */
/*   1. attempt a `timps://connect/<slug>` deep link (desktop app), and      */
/*   2. fall back to a copy-ready terminal command (CLI).                    */
/* Status is rendered from data/gmail-memory.json published with the site.   */
/* ─────────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  /* ── Live connector status ─────────────────────────────────────────────── */
  var statFields = {
    gmail: { dot: 'gmail-dot', state: 'gmail-state', memories: 'gmail-memories', facts: 'gmail-facts', synced: 'gmail-synced' }
  };

  function setGmailStatus(state, extra) {
    var f = statFields.gmail;
    var set = function (id, val) {
      var el = document.getElementById(id);
      if (el && val != null) el.textContent = val;
    };
    if (state === 'connected') {
      set(f.dot, '');
      var dot = document.getElementById(f.dot);
      if (dot) dot.classList.remove('off'), dot.classList.add('on');
      set(f.state, (extra && extra.lastSync) ? 'synced ' + extra.lastSync : 'connected');
      set(f.memories, extra.memories);
      set(f.facts, extra.facts);
      set(f.synced, extra.synced);
    } else {
      var dotOff = document.getElementById(f.dot);
      if (dotOff) dotOff.classList.add('off'), dotOff.classList.remove('on');
      set(f.state, 'not connected');
      set(f.memories, '—');
      set(f.facts, '—');
      set(f.synced, '—');
    }
  }

  function renderLiveStatus(data) {
    var store = (data && data.store) || {};
    var connected = !!store.lastRun && (store.summaryCount || 0) > 0;
    if (connected) {
      setGmailStatus('connected', {
        lastSync: fmtDate(store.lastRun).replace(' · ', ' '),
        memories: store.summaryCount,
        facts: store.totalFacts,
        synced: store.messagesSynced,
      });
    } else {
      setGmailStatus('disconnected');
    }
  }

  function loadGmailStatus() {
    fetch('data/gmail-memory.json')
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(renderLiveStatus)
      .catch(function () { setGmailStatus('disconnected'); });
  }

  /* ── Home "live memory" preview ────────────────────────────────────────── */
  function renderLivePreview(data) {
    var statsEl = document.getElementById('live-stats');
    var recentEl = document.getElementById('live-recent');
    if (!statsEl || !recentEl) return;
    var store = (data && data.store) || {};
    var emails = (data && data.emails) || [];

    var cells = [
      ['memories', store.summaryCount],
      ['facts', store.totalFacts],
      ['emails synced', store.messagesSynced],
      ['last sync', fmtDate(store.lastRun)]
    ];
    statsEl.innerHTML = cells.map(function (c) {
      return '<div class="mem-stat"><div class="mem-stat-value">' + esc(c[1]) + '</div>' +
        '<div class="mem-stat-label">' + esc(c[0]) + '</div></div>';
    }).join('');

    recentEl.innerHTML = emails.slice(0, 4).map(function (e) {
      var fact = (e.facts || [])[0];
      return '<div class="mem-card">' +
        '<div class="mem-card-head">' +
          '<span class="mem-subject">' + esc(e.subject || '(no subject)') + '</span>' +
          '<span class="mem-from">' + esc(e.from || '') + '</span>' +
          '<span class="mem-date">' + esc(fmtDate(e.syncedAt || e.date)) + '</span>' +
        '</div>' +
        (fact ? '<ul class="mem-facts"><li>' + esc(fact) + '</li></ul>' : '') +
      '</div>';
    }).join('');
  }

  function loadLivePreview() {
    fetch('data/gmail-memory.json')
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(renderLivePreview)
      .catch(function () {});
  }

  /* ── Connect handoff ───────────────────────────────────────────────────── */

  var COMMANDS = {
    gmail: {
      name: 'Gmail',
      primary: 'timps gmail:connect',
      note: 'Requires OAuth credentials once — see the Docs page. Sync with: timps gmail:sync'
    }
  };

  function openDeepLink(slug) {
    var scheme = 'timps://connect/' + slug;
    var iframe = document.createElement('iframe');
    iframe.className = 'connect-frame';
    iframe.src = scheme;
    document.body.appendChild(iframe);
    setTimeout(function () { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); }, 2000);
  }

  function buildModal(slug) {
    var spec = COMMANDS[slug] || { name: slug, primary: 'timps ' + slug + ':connect', note: '' };

    var backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    modal.innerHTML =
      '<h3>Connect ' + esc(spec.name) + '</h3>' +
      '<p>Connecting hands off to the TIMPS app or CLI on this machine — ' +
      'real OAuth, read-only scope, tokens stay in <code>~/.timps/</code>.</p>' +
      '<ol class="modal-steps">' +
        '<li><b>App installed?</b> A connection window opened on your machine — finish the consent screen there.</li>' +
        '<li><b>No app?</b> Copy and run this in your terminal:</li>' +
      '</ol>' +
      '<div class="code-block cmd">' + esc(spec.primary) + '</div>' +
      '<p style="font-size:0.78rem; color:var(--ink-3); margin-top:10px;">' + esc(spec.note) + '</p>' +
      '<button class="btn btn-primary btn-sm modal-close" type="button">Close</button>';

    var close = function () { document.body.removeChild(backdrop); };
    modal.querySelector('.modal-close').addEventListener('click', close);
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });
    document.addEventListener('keydown', function key(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', key); }
    });

    document.body.appendChild(backdrop);
    openDeepLink(slug);
  }

  function bindConnectors() {
    document.querySelectorAll('[data-connect]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (el.getAttribute('href')) { e.preventDefault(); }
        var slug = el.getAttribute('data-connect');
        buildModal(slug);
      });
    });
  }

  /* ── Init ──────────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    loadGmailStatus();
    loadLivePreview();
    bindConnectors();
  });
})();