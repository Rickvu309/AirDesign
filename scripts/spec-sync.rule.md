# Specs track covered declarations and their last synced digests in `specs/<topic>/covers.json`

The `spec-drift` step warns about changed or removed declarations. `--sync <topic>` records a new sync only after `pnpm check:specs <topic>` passed.
