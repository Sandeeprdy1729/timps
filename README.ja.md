# TIMPS — AIコーディングエージェントの永続メモリ

<p align="center">
  <img src="https://raw.githubusercontent.com/Sandeeprdy1729/timps/main/assets/banner.png" alt="TIMPS — AIコーディングエージェント" width="100%">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/timps-code"><img src="https://img.shields.io/npm/v/timps-code?label=timps-code&color=brightgreen&style=for-the-badge" alt="npm"></a>
  <a href="https://www.npmjs.com/package/timps-mcp"><img src="https://img.shields.io/npm/v/timps-mcp?label=timps-mcp&color=0ea5e9&style=for-the-badge" alt="npm"></a>
  <a href="https://github.com/Sandeeprdy1729/timps/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Sandeeprdy1729/timps/ci.yml?label=CI&style=for-the-badge" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="MIT"></a>
</p>

<p align="center">
  <b>Claude Code、Cursor、Windsurfはセッションを閉じるとすべて忘れてしまいます。</b><br>
  TIMPSはMCPサーバーで、再起動後も残るメモリを提供します — アーキテクチャの決定、過去のバグ、あなたの convention。<br>
  <i>Ollamaで完全にローカル無料。試すためにAPIキーは不要です。</i>
</p>

<p align="center">
  <b>翻訳:</b>
  <a href="README.md">English</a> •
  <a href="README.ja.md">日本語</a> •
  <a href="README.de.md">Deutsch</a> •
  <a href="README.es.md">Español</a> •
  <a href="README.fr.md">Français</a> •
  <a href="README.hi.md">हिन्दी</a> •
  <a href="README.pt.md">Português</a>
</p>

> **ステータス:** 個人プロジェクトの初期段階。MCPサーバーとCLIは実際に毎日使い信頼している部分です。リポジトリ内のその他すべて（デスクトップアプリ、モバイル、JetBrains、プラグインマーケットプレイス）はまだ若い・テストが不十分です。マーケティングコピーを読むより、コアを試して壊れているところを教えていただきたいです。

<p align="center">
  <video src="https://github.com/user-attachments/assets/7a3ddf8d-efd6-470a-a69b-ed5f54396eb2" controls width="100%" alt="TIMPSデモ — opencodeのセッションをまたいで記憶し、思い出します"></video>
</p>

---

## 30秒で試す

```bash
npx timps-code "what does this codebase do?"
```

インストール不要、設定不要、APIキー不要。どのリポジトリにもポイントするだけです。Ollamaがローカルで動いていれば、100%無料でデータは機外に出ません。動いていなければ、プロバイダーの選択を案内します。

Claude Code、Cursor、またはMCPクライアントで永続メモリを使うには、MCPサーバーを追加：

```bash
npm install -g timps-mcp
```

MCPクライアントで設定（[MCP設定](#mcp-setup)を参照）。

---

## 実際に何をするか

今日Claude Codeにバグ修正を頼んで、セッションを閉じます。明日関連することを聞くと — 昨日何を決めたか、何を試したか、なぜその構造にしたか、何も覚えていません。毎回同じコンテキストを言い直す必要があります。

TIMPSはMCPサーバーとしてエージェントとあなたの中間にあり、プロジェクトごとにメモリストアを保持します：

- **何を覚えるか** — あなたが行ったアーキテクチャの決定、コードベース特有のパターンと convention、発生したバグとその修正方法、書き込んだ内容と理由の監査ログ。
- **どこに保存するか** — デフォルトはローカルJSON/SQLiteファイル。プロジェクトごとにキー付けされ、異なるリポジトリが混ざりません。チームで共有する場合はPostgres/Qdrantが選択可能。
- **コスト** — Ollamaをローカルで実行すれば無料。更高品質の推論が欲しい場合はClaude、GPT、Geminiなどの有料プロバイダーが選択可能。

これだけです。新しいエージェントではなくメモリ層です — 既存のコーディングエージェントと共に動作します。

---

## 仕組み（簡潔版）

内部では、メモリはいくつかの階層で組織されています：

1. **作業メモリ** — 現在のセッション：アクティブファイル、最近のエラー、ライブゴール。終了時にクリア。
2. **エピソードメモリ** — 過去のセッションとその結果のログ。
3. **セマンティックメモリ** — 永続的なもの：エピソードから昇格されたパターン、convention、決定（継続的に重要だから）。
4. **監査トレイル** — すべてのメモリ書き込みの追加専用、ハッシュチェーンログ。システムが何を学習し、いつ学習したかを正確に確認できます。

この上により深いサブシステム（時系列パターン検出、矛盾検出、信頼度スコアリング、重要度ベースの刈り込み）があります — 詳細は[`ARCHITECTURE.md`](ARCHITECTURE.md)を参照。使うのに内部構造を知る必要は通常ありません。

---

## MCP設定

### Claude Code

`~/.claude.json`に追加：

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

`.cursor/mcp.json`に追加：

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

`~/.config/windsurf/config.json`に追加：

```json
{
  "mcpServers": {
    "timps": {
      "command": "timps-mcp"
    }
  }
}
```

### その他のMCPクライアント

`timps-mcp`をstdio経由で実行。プロトコルが必要とするのはそれだけです。

---

## 正直な測定結果

自分で実行：`npx tsx benchmark/index.ts --quick`

| 指標 | 結果 |
|---|---|
| Recall@5（50事実の合成コーパスに対する20テストクエリ） | 19/20 |
| 矛盾検出（10の既知矛盾ペア） | 10/10 |
| クエリレイテンシ、プロセス内、500事実 | ~1ms p95 |

これらは自分で構築した合成データセットに対する自己実行ベンチマークです — 独立した検証はされておらず、あなたの実際のコードベースでの性能を主張するものではありません。「コアロジックが設計通り動作する」ことの証明として受け取ってください。

---

## リポジトリ内のその他のプロジェクト（初期段階）

モノレポにはVS Code拡張、デスクトップアプリ（Tauri）、モバイルアプリ、JetBrainsプラグイン、タスク分解のためのマルチエージェント「スウォーム」モードが含まれます。これらは存在し概ね動作しますが、CLI/MCPコアよりも実際の使用が圧倒的に少ないです。「好奇心があれば試してみて」levelであり、「本番環境で使用可能」ではありません。それが分からずに見つかるより、先に正直に伝えた方が良いと考えています。

---

## 試して、何が問題か教えてください

今本当に役立つこと：上記の30秒コマンドをあなたの実際のリポジトリで実行し、何が壊れていたか、何が混乱したか、何が間違っていたかを教えてください。そのフィードバックはスターのよりもこのプロジェクトにとって価値があります。

- Issues: [github.com/Sandeeprdy1729/timps/issues](https://github.com/Sandeeprdy1729/timps/issues)
- Discord: [discord.gg/MmsTNm8WF6](https://discord.gg/MmsTNm8WF6)

## ライセンス

MIT
