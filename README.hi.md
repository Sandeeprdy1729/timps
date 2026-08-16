# TIMPS — AI कोडिंग एजेंट के लिए स्थायी मेमोरी

<p align="center">
  <img src="https://raw.githubusercontent.com/Sandeeprdy1729/timps/main/assets/banner.png" alt="TIMPS — AI कोडिंग एजेंट" width="100%">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/timps-code"><img src="https://img.shields.io/npm/v/timps-code?label=timps-code&color=brightgreen&style=for-the-badge" alt="npm"></a>
  <a href="https://www.npmjs.com/package/timps-mcp"><img src="https://img.shields.io/npm/v/timps-mcp?label=timps-mcp&color=0ea5e9&style=for-the-badge" alt="npm"></a>
  <a href="https://github.com/Sandeeprdy1729/timps/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Sandeeprdy1729/timps/ci.yml?label=CI&style=for-the-badge" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="MIT"></a>
</p>

<p align="center">
  <b>Claude Code, Cursor और Windsurf सेशन बंद करते ही सब कुछ भूल जाते हैं।</b><br>
  TIMPS एक MCP सर्वर है जो रीस्टार्ट के बाद भी बची रहने वाली मेमोरी देता है — आर्किटेक्चर के फैसले, पिछले बग्स, आपके convention.<br>
  <i>Ollama के साथ पूरी तरह मुफ्त और लोकल। आज़माने के लिए API key की ज़रूरत नहीं।</i>
</p>

<p align="center">
  <b>भाषाएँ:</b>
  <a href="README.md">English</a> •
  <a href="README.ja.md">日本語</a> •
  <a href="README.de.md">Deutsch</a> •
  <a href="README.es.md">Español</a> •
  <a href="README.fr.md">Français</a> •
  <a href="README.hi.md">हिन्दी</a> •
  <a href="README.pt.md">Português</a>
</p>

> **स्टेटस:** अकेला प्रोजेक्ट, शुरुआती चरण। MCP सर्वर और CLI वो हिस्से हैं जिन पर मैं रोज़ भरोसा करता हूँ। इस रिपो में बाकी सब (डेस्कटॉप ऐप, मोबाइल, JetBrains, प्लगइन मार्केटप्लेस) ज़्यादा नए और कम टेस्टेड हैं — नीचे चिन्हित। मैं ईमानदारी से चाहूँगा कि आप कोर आज़माएँ और बताएँ क्या टूटा है, मार्केटिंग कॉपी पढ़ने से बेहतर।

<p align="center">
  <video src="https://github.com/user-attachments/assets/7a3ddf8d-efd6-470a-a69b-ed5f54396eb2" controls width="100%" alt="TIMPS डेमो — opencode सेशन के बीच याद रखें और याद करें"></video>
</p>

---

## 30 सेकंड में आज़माएँ

```bash
npx timps-code "what does this codebase do?"
```

कोई इंस्टॉल नहीं, कोई सेटअप नहीं, कोई API key नहीं। किसी भी रिपो पर पॉइंट करें। अगर Ollama लोकल चल रहा है तो 100% मुफ्त है और कुछ भी मशीन से बाहर नहीं जाता। नहीं तो, प्रोवाइडर चुनने में गाइड करेगा।

Claude Code, Cursor या किसी MCP क्लाइंट में स्थायी मेमोरी के लिए, MCP सर्वर जोड़ें:

```bash
npm install -g timps-mcp
```

फिर अपने MCP क्लाइंट को कॉन्फ़िगर करें ([MCP सेटअप](#mcp-setup) देखें)।

---

## यह वास्तव में क्या करता है

आज Claude Code से बग ठीक करने को कहें। सेशन बंद करें। कल कुछ संबंधित पूछें — उसे कल आपने क्या तय किया, क्या पहले ट्राई किया, या किसी चीज़ को उस स्ट्रक्चर में क्यों बनाया, इसका कोई आइडिया नहीं है। आपको हर सेशन में वही कॉन्टेक्स्ट दोबारा बताना पड़ता है।

TIMPS MCP सर्वर के रूप में आपके और आपके एजेंट के बीच बैठता है और प्रोजेक्ट के हिसाब से मेमोरी स्टोर रखता है:

- **क्या याद रखता है** — आर्किटेक्चर के फैसले, आपके कोडबेस के specific patterns और conventions, जो बग्स पहले आ चुके हैं और कैसे ठीक हुए, और इसने क्या लिखा और क्यों — इसका प्लेन ऑडिट लॉग।
- **कहाँ रहता है** — डिफ़ॉल्ट में लोकल JSON/SQLite फाइलें, प्रोजेक्ट-वाइज़ की हुईं ताकि अलग-अलग रिपो मिक्स न हों। टीम शेयर करनी हो तो ऑप्शनल Postgres/Qdrant।
- **कितना खर्च** — लोकल Ollama से मुफ्त। ऑप्शनल पेड प्रोवाइडर्स (Claude, GPT, Gemini) अगर उनकी reasoning quality चाहिए।

बस। यह एक मेमोरी लेयर है, कोई नया एजेंट नहीं — यह आपके मौजूदा कोडिंग एजेंट के साथ काम करता है।

---

## कैसे काम करता है (छोटा वर्ज़न)

अंदर, मेमोरी कुछ असली लेयर्स में ऑर्गेनाइज़ होती है:

1. **वर्किंग मेमोरी** — करंट सेशन: एक्टिव फाइलें, हाल के एरर, लाइव गोल्स। बंद करने पर क्लियर।
2. **एपिसोडिक मेमोरी** — पिछले सेशन्स और उनके नतीजों का लॉग।
3. **सेमांटिक मेमोरी** — टिकने वाली चीज़ें: patterns, conventions, फैसले जो एपिसोडिक से प्रमोट हुए क्योंकि बार-बार ज़रूरी रहे।
4. **ऑडिट ट्रेल** — हर मेमोरी राइट का append-only, hash-chained लॉग, ताकि आप देख सकें सिस्टम ने क्या सीखा और कब।

इसके ऊपर और भी गहरे subsystems हैं (टेम्पोरल पैटर्न डिटेक्शन, कंट्रैडिक्शन डिटेक्शन, confidence scoring, importance-based pruning) — पूरी डिटेल्स [`ARCHITECTURE.md`](ARCHITECTURE.md) में। ज़्यादातर लोगों को इसे इस्तेमाल करने के लिए इंटर्नल्स जानने की ज़रूरत नहीं।

---

## MCP सेटअप

### Claude Code

`~/.claude.json` में जोड़ें:

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

`.cursor/mcp.json` में जोड़ें:

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

`~/.config/windsurf/config.json` में जोड़ें:

```json
{
  "mcpServers": {
    "timps": {
      "command": "timps-mcp"
    }
  }
}
```

### कोई और MCP क्लाइंट

`timps-mcp` को stdio पर चलाएँ। प्रोटोकॉल को बस इतना ही चाहिए।

---

## क्या ईमानदारी से मापा गया

खुद चलाएँ: `npx tsx benchmark/index.ts --quick`

| मेट्रिक | रिज़ल्ट |
|---|---|
| Recall@5 (50-फैक्ट सिंथेटिक कॉर्पस के खिलाफ़ 20 टेस्ट क्वेरी) | 19/20 |
| कंट्रैडिक्शन डिटेक्शन (10 ज्ञात कंट्रैडिक्टरी पेयर्स) | 10/10 |
| क्वेरी लेटेंसी, इन-प्रोसेस, 500 फैक्ट्स | ~1ms p95 |

ये सिंथेटिक डेटासेट पर सेल्फ-रन बेंचमार्क हैं — स्वतंत्र रूप से verify नहीं हुए, और आपके असली कोडबेस पर दावा नहीं। इसे "कोर लॉजिक डिज़ाइन के अनुसार काम करता है" के रूप में लें, प्रतिस्पर्धी दावे के रूप में नहीं।

---

## इस रिपो में भी (शुरुआती / एक्सपेरिमेंटल)

मोनोरेपो में VS Code एक्स्टेंशन, डेस्कटॉप ऐप (Tauri), मोबाइल ऐप, JetBrains प्लगइन, और टास्क डीकंपोज़िशन के लिए मल्टी-एजेंट "swarm" मोड शामिल हैं। ये मौजूद हैं और ज़्यादातर काम करते हैं, लेकिन CLI/MCP कोर की तुलना में असली इस्तेमाल बहुत कम हुआ है — इन्हें "जिज्ञासा से आज़माएँ", "प्रोडक्शन-रेडी" नहीं समझें। मैं ईमानदार रहना पसंद करूँगा बजाय इसके कि आप खुद पता लगाएँ।

---

## आज़माएँ और बताएँ क्या गलत है

अभी मेरे लिए सच में मददगार है: अपने असली रिपो में ऊपर का 30-सेकंड कमांड चलाएँ, और बताएँ क्या टूटा, क्या कन्फ्यूज़िंग था, या क्या गलत था। वो फीडबैक इस प्रोजेक्ट के लिए एक स्टार से ज़्यादा कीमती है।

- Issues: [github.com/Sandeeprdy1729/timps/issues](https://github.com/Sandeeprdy1729/timps/issues)
- Discord: [discord.gg/MmsTNm8WF6](https://discord.gg/MmsTNm8WF6)

## लाइसेंस

MIT
