# Entropy Management

Define recurring cleanup actions that prevent harness drift.

## Drift Sources

- Stale docs after workflow changes
- Dead scripts no longer called by CI
- Flaky tests ignored over time
- Inconsistent logging field names
- Unused package dependencies

## Entropy Controls

- Weekly harness audit (`make audit`)
- Monthly docs/script alignment review
- Periodic flaky-test triage
- Architectural boundary checks after refactors
- Nightly automated entropy check

## Required Commands

- `scripts/harness/entropy_check.sh`
- `scripts/audit_harness.sh .`
- `scripts/audit_control.sh . --strict`

## Ownership

- **Primary owner:** Project lead
- **Backup owner:** Architecture team
- **Review cadence:** Quarterly deep review, weekly spot checks
