# ADR-0009: Preserve `operator` database identifiers during SAM rename

- Status: Accepted
- Date: 2026-07-17

## Context
Phase 3A renames the user-facing product surface from "Operator" to "SAM".
Two database identifiers still contain the word `operator`:
`conversation_message_role` enum value `operator`, and
`decisions.operator_recommendation` column. Both are load-bearing.

## Decision
Leave the database identifiers unchanged. Map them at the boundary — SAM
messages persist with `role = 'operator'` and are surfaced to the user as SAM.

## Consequences
- Positive: zero data risk, migration-free rename.
- Negative: developers must remember the enum still says `operator`.
