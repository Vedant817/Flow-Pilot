# Google Gmail connection

Only a workspace administrator can start or complete OAuth. There are no
hard-coded callback domains and no refresh tokens in responses or application
logs. The flow requests only Gmail read access; Pub/Sub IAM setup is separate.

## Configuration

Provide `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, and
`INTEGRATION_ENCRYPTION_KEY` through a secret manager or local `.env.local`.
The encryption key must be a canonical base64 encoding of 32 random bytes.
Generate and store it privately; never paste it into this thread or commit it.
Changing the key without re-encrypting existing credentials breaks connections.

Register the exact HTTPS callback URI with Google, for example
`https://your-app.example/api/auth/callback/google`. Development may use HTTP
only on `localhost` or `127.0.0.1`. Sign in to the intended active Clerk
organization as an administrator, then open:

```text
/api/auth/google/google?action=login
```

OAuth state is signed, expires after ten minutes, is bound to an HTTP-only
browser cookie plus user and workspace, and is consumed atomically before the
authorization code is exchanged. Replay requires restarting the flow. Refresh
tokens are stored in `integration_credentials` under the authenticated workspace,
encrypted with AES-256-GCM and workspace-bound associated data.

## Ingestion channel

Gmail watch and webhook ingestion currently use the explicitly configured
`GMAIL_ORG_ID` / `GOOGLE_TOPIC_NAME` channel. An administrator from a different
workspace cannot configure that watch. They prefer that workspace's encrypted
credential; legacy `GOOGLE_REFRESH_TOKEN` is usable only when its configured
`GMAIL_ORG_ID` matches. This does not yet provision arbitrary per-tenant Pub/Sub
channels automatically.

Keep `ADMIN_SECRET` and `DEFAULT_ORG_ID` aligned with the intended maintenance
workspace for service calls. Configure authenticated Pub/Sub pushes. State TTL
and credential uniqueness indexes are included in database readiness checks.

Encrypted integration credentials cannot simply be relabeled during tenant
migration: their authenticated encryption is bound to the old workspace.
Migration fails closed until those integrations are handled separately.

## Validation limits

Cryptographic and mocked-route tests cover state binding/expiry/tampering,
single-use checks, administrator enforcement, confidentiality and credential use.
Real Google authorization, revocation, Pub/Sub configuration and Gmail delivery
still require test credentials and a connected transaction-capable database.
