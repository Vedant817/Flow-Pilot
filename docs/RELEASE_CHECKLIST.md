# Production release gates

Repository hygiene and a passing build do not make this application
production-certified. The eight-week roadmap is still incomplete.

## Before deployment

- Reconcile this thread's branch with the primary checkout without discarding
  either the security/transaction changes or the independent email workflows.
- Require the GitHub verification check; review the advisory lint report and
  resolve lint debt before treating lint as a required release gate.
- Review current dependency advisories. Remaining high-severity findings need
  remediation or documented, evidence-backed risk acceptance.
- Configure real Clerk organizations/roles and a transaction-capable MongoDB
  deployment. Exercise cross-tenant and wrong-role cases against real services.
- Review database-index collisions/options and rehearse migrations on a backup.
  Never drop correctness indexes merely to make startup pass.
- Provision the outbox scheduler for every tenant, and verify retries, exhausted
  events, queue-age monitoring and rebuild coordination.
- Verify Gmail authentication, MIME bodies, expired-history recovery and OAuth
  state handling; incomplete safeguards are not release-ready.
- Certify model artifacts, cold starts, memory/concurrency limits, timeouts,
  cancellation, answer provenance and adversarial AI evaluations.
- Verify backup restoration, retention/deletion, load behavior, mobile layout
  and accessibility with actual browsers/devices.

## Landing and checkout removal

Preserve both commit histories and uncommitted user work. Do not force-push
or silently select an entire side of a conflicted merge. Verify the landed
commit on the intended destination, then use Delta's managed checkout lifecycle
to archive the thread. Do not manually delete a live `.delta/worktrees` directory.
