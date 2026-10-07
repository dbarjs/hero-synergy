# Billing rewrite

## Destination

Billing v2 decided: every question it depends on is answered, ready for `/to-spec`.

## Notes

- Domain: invoicing. Grilling tickets use /grilling and /domain-modeling.

## Decisions so far

- [Which database?](issues/01-which-database.md) — Postgres: the team runs it already, and the refund ledger needs transactions

## Not yet specified

- How refunds reach the ledger once the policy is decided.

## Out of scope

- Multi-currency invoices: a separate effort once billing v2 ships.
