# Copilot Instructions — ChordPlay

ChordPlay is a barbershop harmony exploration tool with two frontends: a Haskell CLI that synthesizes PCM audio piped to PulseAudio, and a React/TypeScript web app using the Web Audio API. Both share the same music theory model but implement it independently.

## Important notes

**IMPORTANT** - ALWAYS load the using-superpowers skill immediately no matter what.

The haskell code was a proof of concept. For any future work, assume the user is talking about the web frontend and not haskell unless specifically asked to work on the haskell.

## Build & Test

### Web frontend (from `web/`)

```bash
nix develop

npm install
npm run build          # tsc -b && vite build
npm run dev            # vite dev server
npm test               # vitest run
npm run test:watch     # vitest watch mode
```

