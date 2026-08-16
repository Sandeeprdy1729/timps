# TIMPS — Memoria persistente para agentes de codificación con IA

<p align="center">
  <img src="https://raw.githubusercontent.com/Sandeeprdy1729/timps/main/assets/banner.png" alt="TIMPS — Agente de codificación con IA" width="100%">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/timps-code"><img src="https://img.shields.io/npm/v/timps-code?label=timps-code&color=brightgreen&style=for-the-badge" alt="npm"></a>
  <a href="https://www.npmjs.com/package/timps-mcp"><img src="https://img.shields.io/npm/v/timps-mcp?label=timps-mcp&color=0ea5e9&style=for-the-badge" alt="npm"></a>
  <a href="https://github.com/Sandeeprdy1729/timps/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Sandeeprdy1729/timps/ci.yml?label=CI&style=for-the-badge" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="MIT"></a>
</p>

<p align="center">
  <b>Claude Code, Cursor y Windsurf olvidan todo al cerrar la sesión.</b><br>
  TIMPS es un servidor MCP que da memoria que sobrevive reinicios — decisiones de arquitectura, bugs pasados, tus convenciones.<br>
  <i>Gratis y completamente local con Ollama. No se necesita API key para probarlo.</i>
</p>

<p align="center">
  <b>Idiomas:</b>
  <a href="README.md">English</a> •
  <a href="README.ja.md">日本語</a> •
  <a href="README.de.md">Deutsch</a> •
  <a href="README.es.md">Español</a> •
  <a href="README.fr.md">Français</a> •
  <a href="README.hi.md">हिन्दी</a> •
  <a href="README.pt.md">Português</a>
</p>

> **Estado:** proyecto individual, etapa temprana. El servidor MCP y la CLI son las partes que uso a diario y en las que confío. Todo lo demás en este repo (app de escritorio, móvil, JetBrains, marketplace de plugins) es más joven y menos testeado — indicado abajo. Preferiría que pruebes el core y me digas qué está roto, a que leas texto de marketing.

<p align="center">
  <video src="https://github.com/user-attachments/assets/7a3ddf8d-efd6-470a-a69b-ed5f54396eb2" controls width="100%" alt="Demo de TIMPS — almacena y recuerda entre sesiones de opencode"></video>
</p>

---

## Prueba en 30 segundos

```bash
npx timps-code "what does this codebase do?"
```

Sin instalar, sin configurar, sin API key. Apunta a cualquier repo. Si tienes Ollama corriendo localmente, esto es 100% gratuito y nada sale de tu máquina. Si no, te guiará para elegir un proveedor.

Para obtener memoria persistente en Claude Code, Cursor o cualquier cliente MCP, agrega el servidor MCP:

```bash
npm install -g timps-mcp
```

luego configura tu cliente MCP (instrucciones en [Configuración MCP](#mcp-setup)).

---

## Qué hace realmente

Pídele a Claude Code que arregle un bug hoy. Cierra la sesión. Pregúntale algo relacionado mañana — no tiene idea de qué decidiste ayer, qué ya intentaste, o por qué estructuraste algo de cierta manera. Terminas re-explicando el mismo contexto cada sesión.

TIMPS se sienta entre tú y tu agente como un servidor MCP y mantiene un almacén de memoria por proyecto:

- **Qué recuerda** — decisiones de arquitectura, patrones y convenciones específicas de tu codebase, bugs que ya tuviste y cómo se arreglaron, y un log de auditoría de qué escribió y por qué.
- **Dónde vive** — archivos JSON/SQLite locales por defecto, con clave por proyecto para que diferentes repos no se mezclen. Opcional Postgres/Qdrant si quieres compartir entre equipos.
- **Qué cuesta** — gratis con Ollama local. Proveedores de pago opcionales (Claude, GPT, Gemini) si quieres su calidad de razonamiento.

Eso es todo. Es una capa de memoria, no un nuevo agente — funciona junto a cualquier agente de codificación que ya uses.

---

## Cómo funciona (versión corta)

Internamente, la memoria se organiza en varias capas:

1. **Memoria de trabajo** — sesión actual: archivos activos, errores recientes, metas en vivo. Se limpia al salir.
2. **Memoria episódica** — un log de sesiones pasadas y sus resultados.
3. **Memoria semántica** — lo duradero: patrones, convenciones, decisiones que se promovieron de episódica porque siguieron siendo importantes.
4. **Cadena de auditoría** — un registro append-only, encadenado por hash, de cada escritura de memoria, para que veas exactamente qué aprendió el sistema y cuándo.

Hay subsistemas más profundos encima (detección de patrones temporales, detección de contradicciones, scoring de confianza, poda por importancia) — detalles en [`ARCHITECTURE.md`](ARCHITECTURE.md). La mayoría no necesita conocer los internos para usarlo.

---

## Configuración MCP

### Claude Code

Agregar a `~/.claude.json`:

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

Agregar a `.cursor/mcp.json`:

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

Agregar a `~/.config/windsurf/config.json`:

```json
{
  "mcpServers": {
    "timps": {
      "command": "timps-mcp"
    }
  }
}
```

### Cualquier otro cliente MCP

Ejecuta `timps-mcp` por stdio. Eso es todo lo que el protocolo requiere.

---

## Lo que se mide honestamente

Ejecuta tú mismo: `npx tsx benchmark/index.ts --quick`

| Métrica | Resultado |
|---|---|
| Recall@5 (20 queries de prueba contra un corpus sintético de 50 hechos) | 19/20 |
| Detección de contradicciones (10 pares conocidos) | 10/10 |
| Latencia de query, en proceso, 500 hechos | ~1ms p95 |

Estos son benchmarks auto-ejecutados en un dataset sintético — no verificados independientemente, y no una afirmación sobre cómo rinde en tu codebase real. Tómalo como "la lógica central funciona como fue diseñada", no como una afirmación competitiva.

---

## También en este repo (temprano / experimental)

El monorepo incluye una extensión de VS Code, una app de escritorio (Tauri), una app móvil, un plugin de JetBrains y un modo multi-agente "swarm" para descomposición de tareas. Estos existen y funcionan en su mayoría, pero han tenido mucho menos uso real que el núcleo CLI/MCP — trátalos como "prueba por curiosidad", no "listo para producción". Prefiero ser honesto a que lo descubras por las malas.

---

## Pruébalo y dime qué está mal

Esto me es útil ahora mismo: ejecuta el comando de 30 segundos arriba en uno de tus repos reales, y dime qué se rompió, qué fue confuso o qué estuvo mal. Ese feedback vale más para este proyecto que una estrella.

- Issues: [github.com/Sandeeprdy1729/timps/issues](https://github.com/Sandeeprdy1729/timps/issues)
- Discord: [discord.gg/MmsTNm8WF6](https://discord.gg/MmsTNm8WF6)

## Licencia

MIT
