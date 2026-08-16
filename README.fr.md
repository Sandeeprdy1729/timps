# TIMPS — Mémoire persistante pour les agents de codage IA

<p align="center">
  <img src="https://raw.githubusercontent.com/Sandeeprdy1729/timps/main/assets/banner.png" alt="TIMPS — Agent de codage IA" width="100%">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/timps-code"><img src="https://img.shields.io/npm/v/timps-code?label=timps-code&color=brightgreen&style=for-the-badge" alt="npm"></a>
  <a href="https://www.npmjs.com/package/timps-mcp"><img src="https://img.shields.io/npm/v/timps-mcp?label=timps-mcp&color=0ea5e9&style=for-the-badge" alt="npm"></a>
  <a href="https://github.com/Sandeeprdy1729/timps/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Sandeeprdy1729/timps/ci.yml?label=CI&style=for-the-badge" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="MIT"></a>
</p>

<p align="center">
  <b>Claude Code, Cursor et Windsurf oublient tout dès que vous fermez la session.</b><br>
  TIMPS est un serveur MCP qui donne une mémoire qui survit les redémarrages — décisions d'architecture, bugs passés, vos conventions.<br>
  <i>Gratuit et entièrement local avec Ollama. Aucune clé API nécessaire pour essayer.</i>
</p>

<p align="center">
  <b>Langues :</b>
  <a href="README.md">English</a> •
  <a href="README.ja.md">日本語</a> •
  <a href="README.de.md">Deutsch</a> •
  <a href="README.es.md">Español</a> •
  <a href="README.fr.md">Français</a> •
  <a href="README.hi.md">हिन्दी</a> •
  <a href="README.pt.md">Português</a>
</p>

> **Statut :** projet individuel, en phase précoce. Le serveur MCP et la CLI sont les parties que j'utilise quotidiennement et en qui j'ai confiance. Tout le reste dans ce repo (application de bureau, mobile, JetBrains, marketplace de plugins) est plus jeune et moins testé — indiqué ci-dessous. Je préférerais honnêtement que vous testiez le core et me disiez ce qui est cassé, plutôt que de lire du texte marketing.

<p align="center">
  <video src="https://github.com/user-attachments/assets/7a3ddf8d-efd6-470a-a69b-ed5f54396eb2" controls width="100%" alt="Démo TIMPS — mémorise et rappelle entre les sessions opencode"></video>
</p>

---

## Essayez en 30 secondes

```bash
npx timps-code "what does this codebase do?"
```

Pas d'installation, pas de configuration, pas de clé API. Pointez-le vers n'importe quel repo. Si Ollama tourne en local, c'est 100% gratuit et rien ne sort de votre machine. Sinon, il vous guidera dans le choix d'un fournisseur.

Pour obtenir de la mémoire persistante dans Claude Code, Cursor ou n'importe quel client MCP, ajoutez le serveur MCP :

```bash
npm install -g @timps-ai/timps-mcp
```

puis configurez votre client MCP (instructions dans [Configuration MCP](#mcp-setup)).

---

## Ce que ça fait vraiment

Demandez à Claude Code de corriger un bug aujourd'hui. Fermez la session. Demandez-lui quelque chose de lié demain — il n'a aucune idée de ce que vous avez décidé hier, ce que vous avez déjà essayé, ou pourquoi vous avez structuré quelque chose d'une certaine manière. Vous finissez par re-expliquer le même contexte à chaque session.

TIMPS se situe entre vous et votre agent comme un serveur MCP et maintient un magasin de mémoire par projet :

- **Ce qu'il se souvient** — décisions d'architecture, patterns et conventions spécifiques à votre codebase, bugs que vous avez déjà eus et comment ils ont été corrigés, et un journal d'audit de ce qu'il a écrit et pourquoi.
- **Où ça vit** — fichiers JSON/SQLite locaux par défaut, clé par projet pour que les différents repos ne se mélangent pas. Optionnel Postgres/Qdrant si vous voulez partager entre équipes.
- **Ça coûte quoi** — gratuit avec Ollama local. Fournisseurs payants optionnels (Claude, GPT, Gemini) pour leur qualité de raisonnement.

C'est tout le pitch. C'est une couche de mémoire, pas un nouvel agent — ça fonctionne aux côtés de l'agent de codage que vous utilisez déjà.

---

## Comment ça marche (version courte)

En interne, la mémoire est organisée en quelques niveaux :

1. **Mémoire de travail** — session en cours : fichiers actifs, erreurs récentes, objectifs en direct. Effacé à la sortie.
2. **Mémoire épisodique** — un journal des sessions passées et de leurs résultats.
3. **Mémoire sémantique** — ce qui dure : patterns, conventions, décisions promues de l'épodique parce qu'elles continuaient d'avoir de l'importance.
4. **Piste d'audit** — un journal append-only, chaîné par hash, de chaque écriture en mémoire, pour que vous puissiez voir exactement ce que le système a appris et quand.

Il y a des sous-systèmes plus profonds au-dessus (détection de patterns temporels, détection de contradictions, scoring de confiance, élagage basé sur l'importance) — détails dans [`ARCHITECTURE.md`](ARCHITECTURE.md). La plupart des gens n'ont pas besoin de connaître les détails pour l'utiliser.

---

## Configuration MCP

### Claude Code

Ajouter à `~/.claude.json` :

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

Ajouter à `.cursor/mcp.json` :

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

Ajouter à `~/.config/windsurf/config.json` :

```json
{
  "mcpServers": {
    "timps": {
      "command": "timps-mcp"
    }
  }
}
```

### Tout autre client MCP

Exécutez `timps-mcp` via stdio. C'est tout ce que le protocole nécessite.

---

## Ce qui est mesuré honnêtement

Exécutez vous-même : `npx tsx benchmark/index.ts --quick`

| Métrique | Résultat |
|---|---|
| Recall@5 (20 requêtes de test contre un corpus synthétique de 50 faits) | 19/20 |
| Détection de contradictions (10 paires connues) | 10/10 |
| Latence de requête, en processus, 500 faits | ~1ms p95 |

Ce sont des benchmarks exécutés soi-même sur un dataset synthétique — pas vérifiés indépendamment, et pas une affirmation sur les performances dans votre codebase réel. Prenez-le comme « la logique de base fonctionne comme conçu », pas comme une affirmation concurrentielle.

---

## aussi dans ce repo (précoce / expérimental)

Le monorepo inclut une extension VS Code, une application de bureau (Tauri), une application mobile, un plugin JetBrains et un mode multi-agent « swarm » pour la décomposition de tâches. Ces éléments existent et fonctionnent pour la plupart, mais ont eu beaucoup moins d'utilisation réelle que le cœur CLI/MCP — traitez-les comme « essayez par curiosité », pas « prêt pour la production ». Je préfère être honnête plutôt que de le découvrir le moment venu.

---

## Essayez et dites-moi ce qui ne va pas

C'est vraiment utile pour moi maintenant : exécutez la commande de 30 secondes ci-dessus sur l'un de vos vrais repos, et dites-moi ce qui s'est cassé, ce qui était confus ou ce qui était mal. Ce feedback vaut plus pour ce projet qu'une étoile.

- Issues : [github.com/Sandeeprdy1729/timps/issues](https://github.com/Sandeeprdy1729/timps/issues)
- Discord : [discord.gg/MmsTNm8WF6](https://discord.gg/MmsTNm8WF6)

## Licence

MIT
