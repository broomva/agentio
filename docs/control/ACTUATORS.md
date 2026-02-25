# Actuators

Define the actions agents are allowed to perform to move the system toward setpoints.

## Actuation Surface

- Code edits (TypeScript source in packages/ and apps/)
- Test and build execution (via harness scripts)
- Script/template updates (scripts/harness/, scripts/control/)
- CI workflow adjustments (.github/workflows/)
- Documentation updates (docs/, AGENTS.md, PLANS.md)

## Safety Boundaries

- **Protected branches/rules:** main requires CI pass and review
- **Restricted commands:** `rm -rf`, force push, secret logging — all denied
- **Approval-required actions:** Push to main, dependency removal, protocol changes

## Action Catalog

| Action | Preconditions | Postconditions | Rollback |
|---|---|---|---|
| Patch code | Tests defined | `make ci` green | Revert commit |
| Update harness docs | Doc owner review | Docs aligned with code | Restore prior doc |
| Tune CI workflow | CI dry run | Stable runtime | Revert workflow |
| Add package | Justified in PLANS.md | Audit passes | Remove package |
| Update dependencies | Lock file committed | Tests pass | Restore lock file |
