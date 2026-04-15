# Copilot Instructions for Notes-Atlas

## Build, test, and lint

This repository is a Docsify-based Markdown knowledge base and currently has **no checked-in build, test, or lint toolchain** (no root `package.json`, Python test config, or CI workflows).

- **Full build:** Not configured
- **Full test suite:** Not configured
- **Lint:** Not configured
- **Run a single test:** Not available (no test framework configured in tracked files)
- **Update per-page last-modified data:** `./scripts/generate-last-updated.sh` (regenerates `static/last-updated.json` from git history)

## High-level architecture

- The site is a client-side Docsify app configured in `index.html` via `window.$docsify`.
- `README.md` is the homepage; root navigation is split between `_sidebar.md` (left nav) and `navbar.md` (top nav).
- Content is organized as route-first Markdown collections under top-level sections such as `meet/`, `study/`, `linux-install/`, `interview/`, and `others/`.
- Section entry pages are typically `README.md` files inside each section directory (for example `meet/README.md`, `linux-install/README.md`).
- Visual/theme customization lives in `static/css/custom.css`; Docsify plugins (search, pagination, KaTeX, breadcrumb, auth, footer, etc.) are loaded directly from CDNs in `index.html`.

## Key repository conventions

- Use **Docsify route links** (usually extensionless paths like `/meet/docs/20260331`) rather than relative `.md` file links.
- When adding content, update the relevant sidebar file so the page is reachable in navigation (for example root `_sidebar.md`, `meet/_sidebar.md`, `linux-install/_sidebar.md`).
- `meet/` uses date-based note slugs (`meet/docs/YYYYMMDD.md`) and usually keeps a matching slide deck in `meet/pptx/YYYYMMDD.pptx`.
- `/others` is configured as a protected Docsify area in `index.html` (`auth.paths` + SHA-256 hash), so auth settings must stay aligned with protected route changes.
