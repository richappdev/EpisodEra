# Dependency Audit

Last reviewed: 2026-07-10

This document records the current npm audit posture for the MVP. Do not run `npm audit fix --force` without a separate migration plan, because current fixes require semver-major framework upgrades.

## Summary

| Package | Audit result | Highest severity | Production impact | Current decision |
| --- | --- | --- | --- | --- |
| `functions` | 9 findings | Moderate | Backend dependency chain through Firebase packages | Defer automatic fix; plan Firebase major upgrade |
| `web` | 2 findings | High | Vite dev server/tooling exposure | Defer automatic fix; avoid exposing Vite dev server publicly |

## Functions

Command:

```text
cd functions
npm audit --json
```

Findings:

- 9 moderate findings.
- Root direct packages involved:
  - `firebase-admin`
  - `firebase-functions`
- Main transitive advisory path:
  - `uuid`
  - `google-gax`
  - `@google-cloud/firestore`
  - `@google-cloud/storage`
  - `retry-request`
  - `teeny-request`
  - `gaxios`

Audit-reported fix:

```text
firebase-admin -> 14.1.0
firebase-functions -> 7.2.5
```

Both are semver-major upgrades from the current MVP dependencies. Treat this as a framework migration, not an automatic patch.

Recommended follow-up:

1. Create a Firebase Functions dependency upgrade branch.
2. Upgrade `firebase-admin` and `firebase-functions` together.
3. Rebuild functions and verify exported v2 HTTPS function behavior.
4. Run Firebase emulator tests once Java/emulator support is available.
5. Deploy to a non-production Firebase project before production.

## Web

Command:

```text
cd web
npm audit --json
```

Findings:

- 1 high finding through `vite`.
- 1 moderate finding through `esbuild`.
- Advisories are development-server/tooling focused.

Audit-reported fix:

```text
vite -> 8.1.4
```

This is a semver-major upgrade from the current Vite 5 setup. It may also require a compatible `@vitejs/plugin-react` upgrade.

MVP mitigation:

- Do not expose `vite dev` beyond localhost.
- Keep local dev bound to `127.0.0.1` as configured in `web/package.json`.
- Production deploys must use built static assets, not the Vite dev server.

Recommended follow-up:

1. Create a web tooling upgrade branch.
2. Upgrade `vite` and `@vitejs/plugin-react` together.
3. Run `npm run build`.
4. Smoke-test the production build locally with `npm run preview`.

## Release Gate

Before production deployment:

- Re-run `npm audit` in both `functions` and `web`.
- Either complete the major upgrade work or explicitly accept the residual risk for the beta.
- Record the decision in this document and the deployment notes.
