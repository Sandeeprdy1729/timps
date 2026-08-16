# TIMPS — Memória persistente para agentes de codificação com IA

<p align="center">
  <img src="https://raw.githubusercontent.com/Sandeeprdy1729/timps/main/assets/banner.png" alt="TIMPS — Agente de codificação com IA" width="100%">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/timps-code"><img src="https://img.shields.io/npm/v/timps-code?label=timps-code&color=brightgreen&style=for-the-badge" alt="npm"></a>
  <a href="https://www.npmjs.com/package/timps-mcp"><img src="https://img.shields.io/npm/v/timps-mcp?label=timps-mcp&color=0ea5e9&style=for-the-badge" alt="npm"></a>
  <a href="https://github.com/Sandeeprdy1729/timps/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Sandeeprdy1729/timps/ci.yml?label=CI&style=for-the-badge" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="MIT"></a>
</p>

<p align="center">
  <b>Claude Code, Cursor e Windsurf esquecem tudo ao fechar a sessão.</b><br>
  TIMPS é um servidor MCP que dá memória que sobrevive a reinicializações — decisões de arquitetura, bugs passados, suas convenções.<br>
  <i>Gratuito e completamente local com Ollama. Nenhuma chave de API necessária para experimentar.</i>
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

> **Status:** projeto individual, fase inicial. O servidor MCP e a CLI são as partes que uso diariamente e confio. Todo o resto neste repo (app desktop, mobile, JetBrains, marketplace de plugins) é mais jovem e menos testado — indicado abaixo. Preferiria honestamente que você experimentasse o core e me dissesse o que está quebrado, a ler texto de marketing.

<p align="center">
  <video src="https://github.com/user-attachments/assets/7a3ddf8d-efd6-470a-a69b-ed5f54396eb2" controls width="100%" alt="Demonstração do TIMPS — memoriza e recorda entre sessões do opencode"></video>
</p>

---

## Experimente em 30 segundos

```bash
npx timps-code "what does this codebase do?"
```

Sem instalar, sem configurar, sem chave de API. Aponte para qualquer repo. Se você tem Ollama rodando localmente, é 100% gratuito e nada sai da sua máquina. Se não, vai te guiar para escolher um provedor.

Para obter memória persistente no Claude Code, Cursor ou qualquer cliente MCP, adicione o servidor MCP:

```bash
npm install -g @timps-ai/timps-mcp
```

depois configure seu cliente MCP (instruções em [Configuração MCP](#mcp-setup)).

---

## O que realmente faz

Peça ao Claude Code para corrigir um bug hoje. Feche a sessão. Pergunte algo relacionado amanhã — ele não tem ideia do que você decidiu ontem, o que já tentou, ou por que você estruturou algo de uma certa maneira. Você acaba re-explicando o mesmo contexto toda sessão.

TIMPS se senta entre você e seu agente como um servidor MCP e mantém um armazenamento de memória por projeto:

- **O que lembra** — decisões de arquitetura, padrões e convenções específicas do seu codebase, bugs que você já teve e como foram corrigidos, e um log de auditoria do que escreveu e por quê.
- **Onde vive** — arquivos JSON/SQLite locais por padrão, com chave por projeto para que diferentes repos não se misturem. Opcional Postgres/Qdrant se quiser compartilhar entre equipes.
- **Quanto custa** — gratuito com Ollama local. Provedores pagos opcionais (Claude, GPT, Gemini) se quiser qualidade de raciocínio deles.

Essa é toda a proposta. É uma camada de memória, não um novo agente — funciona ao lado de qualquer agente de codificação que você já use.

---

## Como funciona (versão curta)

Por baixo dos panos, a memória é organizada em algumas camadas reais:

1. **Memória de trabalho** — sessão atual: arquivos ativos, erros recentes, metas ao vivo. Limpo ao sair.
2. **Memória episódica** — um log de sessões passadas e seus resultados.
3. **Memória semântica** — o duradouro: padrões, convenções, decisões que foram promovidas da episódica porque continuaram sendo importantes.
4. **Trilha de auditoria** — um registro append-only, encadeado por hash, de cada escrita de memória, para que você veja exatamente o que o sistema aprendeu e quando.

Existem subsistemas mais profundos acima (detecção de padrões temporais, detecção de contradições, scoring de confiança, poda baseada em importância) — detalhes em [`ARCHITECTURE.md`](ARCHITECTURE.md). A maioria das pessoas não precisa conhecer os internos para usá-lo.

---

## Configuração MCP

### Claude Code

Adicionar a `~/.claude.json`:

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

Adicionar a `.cursor/mcp.json`:

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

Adicionar a `~/.config/windsurf/config.json`:

```json
{
  "mcpServers": {
    "timps": {
      "command": "timps-mcp"
    }
  }
}
```

### Qualquer outro cliente MCP

Execute `timps-mcp` via stdio. É tudo que o protocolo requer.

---

## O que é medido honestamente

Execute você mesmo: `npx tsx benchmark/index.ts --quick`

| Métrica | Resultado |
|---|---|
| Recall@5 (20 consultas de teste contra um corpus sintético de 50 fatos) | 19/20 |
| Detecção de contradições (10 pares conhecidos) | 10/10 |
| Latência de consulta, em processo, 500 fatos | ~1ms p95 |

Estes são benchmarks executados por mim em um dataset sintético — não verificados independentemente, e não uma afirmação sobre como performa no seu codebase real. Tome como "a lógica central funciona como projetado", não como afirmação competitiva.

---

## também neste repo (precoce / experimental)

O monorepo inclui uma extensão do VS Code, um app desktop (Tauri), um app mobile, um plugin JetBrains e um modo multi-agente "swarm" para decomposição de tarefas. Estes existem e funcionam na maior parte, mas tiveram muito menos uso real do que o núcleo CLI/MCP — trate-os como "experimente por curiosidade", não "pronto para produção". Prefiro ser honesto a ter você descobrindo do pior jeito.

---

## Experimente e me diga o que está errado

Isto é realmente útil para mim agora: execute o comando de 30 segundos acima em um dos seus repos reais, e me diga o que quebrou, o que foi confuso ou o que estava errado. Esse feedback vale mais para este projeto que uma estrela.

- Issues: [github.com/Sandeeprdy1729/timps/issues](https://github.com/Sandeeprdy1729/timps/issues)
- Discord: [discord.gg/MmsTNm8WF6](https://discord.gg/MmsTNm8WF6)

## Licença

MIT
