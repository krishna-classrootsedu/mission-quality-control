# Mission Quality Control — CLAUDE.md

## What This Is

Kanban UI + Convex backend for the EdTechPlus multi-agent content review pipeline. Next.js 14, Convex serverless backend, deployed on Netlify.

## Commands

```bash
npm run dev          # Dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npx convex dev --once  # Deploy Convex functions to dev
npx convex deploy --yes  # Deploy Convex functions to prod
```

## Deployments

| Instance | Deployment | URL |
|----------|-----------|-----|
| Dev | `trustworthy-platypus-466` | `https://trustworthy-platypus-466.convex.cloud` |
| Prod | `tame-ibex-528` | `https://tame-ibex-528.convex.cloud` |
| Netlify | `mission-quality-control` | `https://mission-quality-control.netlify.app` |

Netlify auto-deploys on push to `main`. Free plan — limited build credits, so avoid unnecessary pushes.

## Critical Rules

- **Always run `npm run build` before committing and pushing.** Netlify builds will fail on ESLint errors and TypeScript errors that `npm run dev` doesn't catch. Fix all errors locally first.
- **After ANY change to `convex/` files**, run `npx convex dev --once` (dev) and `npx convex deploy --yes` (prod).
- **VPS agents talk to prod Convex** (`tame-ibex-528`). Local dev/testing uses dev (`trustworthy-platypus-466`). Never mix them up.
- **Netlify env var:** `NEXT_PUBLIC_CONVEX_URL` points to prod (`https://tame-ibex-528.convex.cloud`).
