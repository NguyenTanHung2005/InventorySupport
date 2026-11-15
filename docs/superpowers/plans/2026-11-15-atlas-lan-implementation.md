# Atlas LAN implementation plan (APK deferred)

Spec: ../specs/2026-11-15-atlas-lan-mini-mart-design.md, approved by user instruction to execute. APK excluded by latest instruction.

Constraints: keep API DTOs/string IDs/ISO timestamps, existing role matrix, no old JSON migration, no automatic seed, no cloud writes without user configuration. Inline implementation, final independent review.

Review focus: concurrent export/adjustment; transaction rollback and push; async tool serialization; duplicate email/barcode; seed nonempty database and images.

### Task 1: Database connection and async queries
- [ ] Test URI validation and DTO mapping RED then GREEN.
- [ ] Add compatible mongoose dependencies, schema/models and async DatabaseService; remove runtime JSON/RAM arrays.
- [ ] Convert auth guard/auth/users/products/notifications to async access, preserve validation and errors.

### Task 2: Inventory transaction and AI callers
- [ ] Tests export overstock, adjustment zero, batch rollback and push-after-commit.
- [ ] Transaction all stock/history/alerts; await all AI tools/controllers/confirm/offline helpers.
- [ ] Adapt affected tests using test-only DB fixture; integration tests use real Mongo replica set via explicit test URI.

### Task 3: Mini-mart seed and images
- [ ] Test 60 products/6 accounts/30 days, stock chain, permissions, notifications and seed refusing occupied DB.
- [ ] Generate catalog/60 PNG and 3 invoices/answers; deterministic history and manifest; seed/check scripts, no destructive reset.

### Task 4: Setup docs and verification
- [ ] Atlas setup, local network/firewall/env, seed/check and backup documentation; no APK changes.
- [ ] Backend build/lint/unit/E2E and app checks where available; document package/network/test constraints.

### Task 5: Final review
- [ ] Fresh whole-change review, resolve material findings with regression checks, ledger rulings and remaining limits.

## Execution status 15/11/2026

Source and fixtures prepared; see docs/PROJECT_PROGRESS.md for exact test results. Build/install/lockfile and real Mongo integration blocked by npm network policy and missing test deployment. APK excluded. Do not treat unchecked runtime verification as complete.
