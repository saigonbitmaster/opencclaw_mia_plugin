# Mina Toolkit

OpenClaw mina payment tool plugin.

## Build

```bash
npm install
npm run build
npm run validate
npm test
```

## Install plugin


```bash
openclaw plugins install --link .
openclaw config set plugins.allow '["openclaw-plugin-mina"]'
openclaw config set plugins.entries.openclaw-plugin-mina.enabled true
openclaw gateway restart
openclaw logs --follow

```