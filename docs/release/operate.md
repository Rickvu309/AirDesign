# Prepare a release without deploying

1. Run root tests, type checking, lint, and `verify:pr-01` through `verify:pr-09` at the candidate commit.
2. Build Studio, the server capture bundle, export worker, and site. Run the release live probes at the same commit.
3. Review the ten lane receipts and raw performance distributions. Any local failure blocks release. Any open external gate blocks external acceptance.
4. Run `node bench/release/prepare-external.mjs`. Give the operator the six kits and their exact access requirements.
5. Review actual captures, the interaction video including failure, and the S11.01 and S12.01 comparison. Save the operator decision before merge.
6. Stop here. This procedure authorizes neither merge nor deployment. No endpoint, provider or production schedule is activated.

## Prepare rollback before deployment

Record the previous immutable application and static-site artifacts, database schema revision, migration compatibility, environment configuration, and worker queue version. Back up PostgreSQL and operation SQLite only through the deployment owner's approved consistent snapshot process. Keep backup hashes and encryption access outside this repository. Test restoration in an isolated environment before production changes.

Pause submissions and worker claims before a rollback that changes the operation schema. Drain or fence active leases. Preserve saved deck history, ledger idempotency records, provider event receipts, and deletion tombstones. Restoring an older binary does not undo a charged payment or a saved deck edit. Reconcile provider events through the shipped idempotent path.

Never restore deleted personal data from a backup into service. Replay deletion tombstones before access is enabled. Never copy an open SQLite database as a backup. The local rehearsal closes the store before copying it and tests the reopened copy.

## Respect retention boundaries

Operation artifacts expire after seven days. Expired artifacts cannot be downloaded. Account deletion uses the shipped retention locks and deletes account-owned data. PostgreSQL retention and provider reconciliation records follow their existing implementation; this release adds no production retention schedule. Backup retention, infrastructure snapshots and provider retention require an operator policy before deployment.

The disposable recovery probe exercises backup and restore, deletion that survives restart, foreign-owner refusal, lease cleanup and stale-worker fencing. The local receipt states whether interruption was simulated or involved a killed fixture worker. It does not certify a production backup or disaster recovery objective.

## Assign post-release owners

| Responsibility | Owner before release |
| --- | --- |
| Deployment, rollback, backup restoration, incident coordination | rickvu |
| Windows and Mac PowerPoint reference runs and fonts | rickvu or an explicitly assigned licensed operator |
| NVDA and VoiceOver accessibility | rickvu or an assigned accessibility reviewer |
| Model budget, SDK pins and quality calibration | rickvu and independently recruited human raters |
| Authorized HTTPS client walkthroughs and revocation | rickvu |
| Payment sandbox, eligibility, FX and reconciliation | rickvu |

Record named delegates in the external receipts before they execute a gate. There is no active production schedule in this candidate.

Rickvu owns monthly human judge recalibration and reruns the pinned two-model tool evaluation after any tool schema or description change. Actual paid-model first-change distributions remain X03; this candidate sets no model latency promise from the import budget.
