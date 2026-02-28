# Frontend Runbook — JSON Diff Checker

> **Project subfolder:** `json-diff/`

---

## Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9

---

## Local Development Setup

```bash
# Navigate to the project directory
cd json-diff

# Install dependencies
npm install

# Start the dev server (hot-reload)
npm run dev
```

The dev server runs at `http://localhost:5173` by default.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run typecheck` | Run TypeScript type checking (`tsc --noEmit`) |
| `npm run lint` | Run ESLint on all TS/TSX files |
| `npm run test:unit` | Run all Vitest unit and component tests (single run) |
| `npm run test:unit:watch` | Run Vitest in watch mode |

---

## Running Tests

### Unit & Component Tests (Tier 1 + Tier 2)

```bash
npm run test:unit
```

This runs all co-located `.test.ts` and `.test.tsx` files under `src/` using Vitest with jsdom.

### Watch Mode (for development)

```bash
npm run test:unit:watch
```

---

## Building for Production

```bash
npm run build
```

Output is written to `dist/`. Deploy the contents of `dist/` to any static host (GitHub Pages, Netlify, Vercel, S3+CloudFront, etc.).

No environment variables are required at runtime.

---

## Project Structure

```
json-diff/
├── src/
│   ├── types/diff.ts            # Shared TypeScript types (source of truth)
│   ├── utils/                   # Pure utility functions + co-located tests
│   ├── hooks/                   # React hooks + co-located tests
│   ├── components/              # React components + CSS modules + co-located tests
│   ├── styles/tokens.css        # CSS custom properties (design tokens)
│   ├── index.css                # Global reset
│   └── main.tsx                 # App entry point
├── docs/                        # Design documentation
├── index.html                   # HTML entry point
├── vite.config.ts               # Vite + Vitest configuration
├── tsconfig.json                # TypeScript project references
├── tsconfig.app.json            # App TypeScript config
└── package.json
```

---

## Troubleshooting

| Issue | Resolution |
|---|---|
| `npm install` fails | Ensure Node.js ≥ 18 is installed. Delete `node_modules` and `package-lock.json`, then re-run `npm install`. |
| Type errors in IDE | Run `npm run typecheck` to see full error output. Ensure your IDE uses the workspace TypeScript version. |
| Tests fail with "cannot find module" | Run `npm install` to ensure all dependencies are present. |
| Build fails with CSS module errors | Ensure `vite.config.ts` is not modified. CSS Modules are configured automatically by Vite. |
| Port 5173 in use | Stop other Vite dev servers or set a different port: `npm run dev -- --port 3000` |

---

## Environment Variables

This is a fully client-side application. **No environment variables are required** at build or runtime. No data leaves the browser.
