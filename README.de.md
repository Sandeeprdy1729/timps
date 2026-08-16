# TIMPS — Persistenter Speicher für KI-Coding-Agenten

<p align="center">
  <img src="https://raw.githubusercontent.com/Sandeeprdy1729/timps/main/assets/banner.png" alt="TIMPS — KI-Coding-Agent" width="100%">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/timps-code"><img src="https://img.shields.io/npm/v/timps-code?label=timps-code&color=brightgreen&style=for-the-badge" alt="npm"></a>
  <a href="https://www.npmjs.com/package/timps-mcp"><img src="https://img.shields.io/npm/v/timps-mcp?label=timps-mcp&color=0ea5e9&style=for-the-badge" alt="npm"></a>
  <a href="https://github.com/Sandeeprdy1729/timps/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Sandeeprdy1729/timps/ci.yml?label=CI&style=for-the-badge" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="MIT"></a>
</p>

<p align="center">
  <b>Claude Code, Cursor und Windsurf vergessen alles, sobald Sie die Sitzung schließen.</b><br>
  TIMPS ist ein MCP-Server, der Speicher gibt, der Neustarts überlebt — Architektur-Entscheidungen, vergangene Bugs, Ihre Konventionen.<br>
  <i>Kostenlos und vollständig lokal mit Ollama. Kein API-Schlüssel zum Ausprobieren nötig.</i>
</p>

<p align="center">
  <b>Sprachen:</b>
  <a href="README.md">English</a> •
  <a href="README.ja.md">日本語</a> •
  <a href="README.de.md">Deutsch</a> •
  <a href="README.es.md">Español</a> •
  <a href="README.fr.md">Français</a> •
  <a href="README.hi.md">हिन्दी</a> •
  <a href="README.pt.md">Português</a>
</p>

> **Status:** Einzelprojekt, frühe Phase. Der MCP-Server und die CLI sind die Teile, denen ich täglich vertraue. Alles andere in diesem Repo (Desktop-App, Mobile, JetBrains, Plugin-Marktplatz) ist jünger und weniger getestet — unten gekennzeichnet. Ich würde ehrlich lieber, dass Sie den Kern ausprobieren und mir sagen, was kaputt ist, als Marketing-Text zu lesen.

<p align="center">
  <video src="https://github.com/user-attachments/assets/7a3ddf8d-efd6-470a-a69b-ed5f54396eb2" controls width="100%" alt="TIMPS Demo — merkt sich Dinge und ruft sie über opencode-Sitzungen hinweg ab"></video>
</p>

---

## In 30 Sekunden ausprobieren

```bash
npx timps-code "what does this codebase do?"
```

Keine Installation, keine Konfiguration, kein API-Schlüssel. Zeigen Sie es auf jedes Repo. Wenn Ollama lokal läuft, ist das 100% kostenlos und nichts verlässt Ihren Rechner. Wenn nicht, führt es Sie durch die Auswahl eines Providers.

Für persistenen Speicher in Claude Code, Cursor oder jedem MCP-Client, fügen Sie den MCP-Server hinzu:

```bash
npm install -g @timps-ai/timps-mcp
```

dann richten Sie Ihren MCP-Client ein (Anleitung in [MCP-Einrichtung](#mcp-setup)).

---

## Was es tatsächlich macht

Bitten Sie Claude Code heute einen Bug zu fixen. Schließen Sie die Sitzung. Fragen Sie morgen etwas Ähnliches — es hat keine Ahnung, was Sie gestern entschieden haben, was Sie bereits versucht haben, oder warum Sie etwas so strukturiert haben. Sie erklären jede Sitzung denselben Kontext neu.

TIMPS sitszt als MCP-Server zwischen Ihnen und Ihrem Agenten und speichert einen Speicherstore pro Projekt:

- **Was es merkt sich** — Architektur-Entscheidungen, Muster und Konventionen, die für Ihr Codebase spezifisch sind, Bugs, die Sie bereits hatten und wie sie behoben wurden, und ein einfaches Audit-Log über das, was es geschrieben hat und warum.
- **Wo es lebt** — Standardmäßig lokale JSON/SQLite-Dateien, pro Projekt Schlüsselgeteilt, damit verschiedene Repos nicht ineinander überlaufen. Optional Postgres/Qdrant für Teamnutzung.
- **Was es kostet** — kostenlos mit lokalem Ollama. Optionale bezahlte Provider (Claude, GPT, Gemini) für deren Schlussfolgerungsqualität.

Das ist der ganze Pitch. Es ist eine Speicherschicht, kein neuer Agent — es arbeitet neben jedem Coding-Agenten, den Sie bereits verwenden.

---

## Wie es funktioniert (kurze Version)

Intern ist Speicher in einigen Schichten organisiert:

1. **Arbeitsspeicher** — aktuelle Sitzung: aktive Dateien, kürzliche Fehler, Live-Ziele. Wird bei Beendigung gelöscht.
2. **Episodenspeicher** — ein Log vergangener Sitzungen und deren Ergebnisse.
3. **Semantischer Speicher** — das Dauerhafte: Muster, Konventionen, Entscheidungen, die aus Episoden befördert wurden, weil sie immer wieder wichtig waren.
4. **Audit-Trail** — eine append-only, hash-verkettete Aufzeichnung jeder Speicher-Schreibung, damit Sie genau sehen können, was das System gelernt hat und wann.

Darüber gibt es tiefere Subsysteme (Zeitmustererkennung, Widerspruchserkennung, Konfidenz-Scorecard, Importance-basiertes Pruning) — Details in [`ARCHITECTURE.md`](ARCHITECTURE.md). Die meisten brauchen die Interna nicht, um es zu nutzen.

---

## MCP-Einrichtung

### Claude Code

Zu `~/.claude.json` hinzufügen:

```json
{
  "mcpServers": {
    "timps": {
      "command": "timps-mcp"
    }
  }
}
```

### Cursor

Zu `.cursor/mcp.json` hinzufügen:

```json
{
  "mcpServers": {
    "timps": {
      "command": "timps-mcp"
    }
  }
}
```

### Windsurf

Zu `~/.config/windsurf/config.json` hinzufügen:

```json
{
  "mcpServers": {
    "timps": {
      "command": "timps-mcp"
    }
  }
}
```

### Jeder andere MCP-Client

Führen Sie `timps-mcp` über stdio aus. Das ist alles, was das Protokoll erfordert.

---

## Was ehrlich gemessen wird

Selber ausführen: `npx tsx benchmark/index.ts --quick`

| Metrik | Ergebnis |
|---|---|
| Recall@5 (20 Testabfragen gegen einen 50-Fakten-Synthese-Korpus) | 19/20 |
| Widerspruchserkennung (10 bekannte Widerspruchspaare) | 10/10 |
| Abfrage-Latenz, im Prozess, 500 Fakten | ~1ms p95 |

Dies sind selbst ausgeführte Benchmarks auf einem Synthese-Datensatz, nicht unabhängig verifiziert und kein Anspruch für Ihre tatsächliche Codebasis. Nehmen Sie es als „die Kernlogik funktioniert wie entworfen" und nicht als Wettbewerbsaussage.

---

## Auch in diesem Repo (früh / experimentell)

Das Monorepo enthält eine VS-Code-Erweiterung, eine Desktop-App (Tauri), eine Mobile-App, ein JetBrains-Plugin und einen Multi-Agent „Schwarm"-Modus zur Aufgabendekomposition. Diese existieren und funktionieren größtenteils, wurden aber viel weniger im realen Einsatz getestet als der CLI/MCP-Kern — behandeln Sie sie als „ausprobieren aus Neugier", nicht als produktionsbereit. Ich möchte lieber ehrlich sein, als dass Sie es selbst herausfinden.

---

## Ausprobieren und sagen, was falsch ist

Das ist mir gerade wirklich hilfreich: Führen Sie den 30-Sekunden-Befehl oben auf einem Ihrer echten Repos aus und sagen Sie mir, was kaputt ging, was verwirrend war oder was es falsch gemacht hat. Dieses Feedback ist dieses Projekt mehr wert als ein Stern.

- Issues: [github.com/Sandeeprdy1729/timps/issues](https://github.com/Sandeeprdy1729/timps/issues)
- Discord: [discord.gg/MmsTNm8WF6](https://discord.gg/MmsTNm8WF6)

## Lizenz

MIT
