# Contributing

The application lives at the repository root. Use Node.js 24 and the committed
`package-lock.json`; install with `npm ci`, not `npm install --force`.

Copy `.env.example` to `.env.local` and supply credentials locally. Interactive
access requires membership in an active Clerk organization. Use a disposable
MongoDB replica set for transactional tests and development. Do not point
development migrations or backfills at production.

Before submitting changes:

```bash
npm run typecheck
npm test -- --runInBand
npm run lint
npm run build
git diff --check
```

`npm run verify` runs typechecking, tests, a real ONNX classifier smoke check and
the build. CI uses a synthetic
publishable Clerk key for compilation and does not certify real sign-in,
MongoDB, Gmail, Atlas or model-runtime behavior. CI results must be checked on
GitHub after publication; local checks are not remote CI evidence.

Lint currently has repository-wide debt and is advisory in CI. New changes
should pass targeted lint without weakening rules. The four skipped legacy
test placeholders are not passing integration tests.

Keep generated assets, dependency directories, private datasets, checkpoints
and secrets out of Git. Changes to authentication, tenant boundaries, inventory,
money or external integrations need negative/fault-injection tests.

See `docs/DELIVERY_STATUS.md` for implementation scope,
`docs/ORDER_PROCESSING.md` for order/index prerequisites and
`docs/RELEASE_CHECKLIST.md` for deployment gates.
