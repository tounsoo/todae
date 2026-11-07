# 0012. The docs build in GitHub Actions and deploy prebuilt to Vercel

- **Date:** 2026-11-07
- **Status:** Active
- **Source:** Ben, 2026-11-07: "Since Todae is public, and public does not pay for CI, can we build in Github fully so we can save build on Vercel" and "Yes, build on GitHub".

## Decision

`.github/workflows/docs-deploy.yml` builds the docs site with `vercel build` on GitHub's runners and uploads the output with `vercel deploy --prebuilt`. Pull requests from this repository and `main` get preview deployments, and `docs-stable` deploys to production, as before. Vercel still hosts everything, including the docs MCP server and the link preview card routes, which need a server. Pull requests from forks get no preview, since building them with the deploy token would hand their code the token.

The switch happens in two steps, so previews never stop:

1. This workflow ships while Vercel's own Git builds still run. Without the `VERCEL_TOKEN` secret it skips with a notice.
2. Once the secret is set and the workflow has deployed a pull request preview, a `main` preview and a `docs-stable` production deployment, a follow-up pull request adds `"git": { "deploymentEnabled": false }` to `apps/docs/vercel.json` and drops its `ignoreCommand`. From then on Vercel builds nothing.

## Why

The repository is public, so GitHub Actions minutes on standard runners cost nothing, while every Vercel build counts against the plan's build minutes. Keeping Vercel as the host, rather than moving to a static host such as Cloudflare, keeps the MCP server and the link preview routes working without porting them, and keeps preview URLs, deployment protection and the verify skills' Vercel checks as they are.
