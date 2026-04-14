# Publishing TIMPs VS Code Extension

This guide explains how to publish the TIMPs VS Code extension to the marketplace.

## Prerequisites

1. **GitHub Account** - For open-source hosting
2. **Microsoft Account** - For VS Code Marketplace
3. **npm** - For building/packaging

---

## Step 1: Create Publisher Account

1. Go to https://marketplace.visualstudio.com/manage
2. Click "Publish Extensions"
3. Sign in with Microsoft
4. Click "Create publisher":
   - **Publisher ID**: `sandeeprdy1729` (use your GitHub username)
   - **Display Name**: `TIMPs by Sandeep`
   - **Description**: AI Memory Intelligence for Developers
5. Save the publisher ID (you'll need it in package.json)

---

## Step 2: Generate Personal Access Token (PAT)

1. Go to https://dev.azure.com
2. Click your profile > Security
3. Personal Access Tokens > New Token
4. Configure:
   - **Organization**: + Create new > give it a name
   - **Expiration**: 90 days or custom
   - **Scopes**: Marketplace > Manage

---

## Step 3: Update Configuration

Edit `package.json`:

```json
{
  "name": "timps-vscode",
  "displayName": "TIMPs — AI Memory Intelligence",
  "description": "Inline warnings from your personal bug patterns, tech debt history, and API quirks. Memory that thinks.",
  "version": "1.0.0",
  "publisher": "sandeeprdy1729",  // Your publisher ID
  "repository": {
    "type": "git",
    "url": "https://github.com/YOUR_USERNAME/timps.git"
  },
  "icon": "icon.png",
  ...
}
```

---

## Step 4: Build and Package

```bash
cd timps-vscode

# Install dependencies
npm install

# Build the extension
npm run compile

# Package for distribution
npx vsce package
```

This creates `timps-vscode-1.0.0.vsix`

---

## Step 5: Publish to Marketplace

### Option A: Using vsce CLI (Recommended)

```bash
# Login first
npx vsce login sandeeprdy1729
# Enter your PAT when prompted

# Publish
npx vsce publish
```

### Option B: Upload Manually

1. Go to https://marketplace.visualstudio.com/manage
2. Click "New Extension" > "VS Code"
3. Upload the `.vsix` file
4. Fill in marketplace details:
   - **Categories**: AI, Developer Tools, Linters
   - **Tags**: ai, memory, bugs, tech-debt, coding-assistant
   - **Pricing**: Free
   - **License**: MIT
5. Submit for review (usually instant for free extensions)

---

## Step 6: Share Your Extension

After publishing, share the link:
- **Marketplace**: `https://marketplace.visualstudio.com/items?itemName=sandeeprdy1729.timps-vscode`
- **Install button**: 
  ```markdown
  [![Install](https://img.shields.io/badge/VS%20Code-Install-blue)](https://marketplace.visualstudio.com/items?itemName=sandeeprdy1729.timps-vscode)
  ```

---

## Alternative: Open VSX Registry (Open Source Alternative)

For open-source extensions, consider Open VSX:
1. Go to https://open-vsx.org/publish
2. Connect with GitHub
3. Publish for free (no Microsoft account needed)

```bash
# Install open-vsx publisher
npx ovsx publish timps-vscode-1.0.0.vsix
```

---

## Testing Before Publishing

### Local Installation
```bash
# Install from .vsix
code --install-extension timps-vscode-1.0.0.vsix
```

### Uninstall
```bash
code --uninstall-extension sandeeprdy1729.timps-vscode
```

---

## Updating Your Extension

```bash
# Make changes, bump version
# Edit package.json: "version": "1.1.0"

# Rebuild
npm run compile

# Publish new version
npx vsce publish
```

---

## Extension Files Overview

```
timps-vscode/
├── package.json       # Extension metadata
├── icon.png          # Extension icon (128x128)
├── README.md         # User documentation
├── CHANGELOG.md      # Version history
├── LICENSE           # MIT License
├── src/
│   ├── extension.ts   # Main entry point
│   └── ...
└── out/              # Compiled JavaScript
```

---

## Checklist Before Publishing

- [ ] Update `publisher` in package.json
- [ ] Update `repository` URL in package.json
- [ ] Add CHANGELOG.md
- [ ] Ensure icon.png exists (128x128 recommended)
- [ ] Test locally with F5 (Extension Development Host)
- [ ] Run `npm run lint` if available
- [ ] Build with `npm run compile`
- [ ] Test .vsix install locally
- [ ] Publish with `npx vsce publish`

---

## Need Help?

- VS Code Extension Docs: https://code.visualstudio.com/api
- Marketplace: https://marketplace.visualstudio.com
- Open VSX: https://open-vsx.org
