# ADR-006: Money representation and customer/admin DTO split

**Status**: accepted (2026-09-05)

- Customer money: integer sen (MYR×100). Provider money: integer micro-USD.
- Two serializer families per aggregate: `toCustomerDTO` and `toAdminDTO`.
  Customer DTOs are the only ones reachable from `/api/v1` (non-admin) and MCP.
- A snapshot test guards that customer DTOs never contain
  `provider_cost*`, `markup*`, `margin*`, `provider_request_id`.
