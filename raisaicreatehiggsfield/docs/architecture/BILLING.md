# Billing

Customer sees three numbers only: **Balance**, **Estimated cost**, **Charged**
(§4, §93, §94, §164). Currency MYR, stored in sen. No credits.

## Ledger (§71)
Append-only `balance_transactions`; `balances` is a materialized cache updated
in the same D1 batch. Types and sign:

| type | amount_sen | available_delta_sen | reserved_delta_sen |
| --- | --- | --- | --- |
| deposit | + | + | 0 |
| reservation | − | − | + |
| charge (against reservation) | − | 0 | − |
| charge (overage beyond reservation) | − | − | 0 |
| refund | + | + (unused part) | − |
| adjustment | ± | ± | 0 |

Each row carries its own per-bucket deltas so balances replay from the ledger
alone. `amount_sen` is the customer-facing magnitude of the event; the deltas
are the accounting effect.

Flow per run: estimate → reserve(estimate) → execute → actual → charge(actual) →
refund(estimate − actual). If actual > estimate (allowed up to a configurable
overage, default 25%), charge the difference from available; if that would go
negative, still complete the run (never fail after provider spend) and record a
negative balance with a low-balance event.

`BillingService.reserve()` rejects with `insufficient_balance` and returns
`{ estimatedSen, availableSen }` for the UI to render "Add Balance" (§29).

## Pricing math
```
providerUsd   = f(pricing.unit, resolved inputs)          // from CLOUDFLARE-AI.md shapes
customerSen   = roundUp(providerUsd × fxUsdMyr × (1 + markup%) × 100, rounding_sen)
customerSen   = max(customerSen, minimum_charge_sen)
```
`fx_rate_usd_myr`, `markup_percent`, `minimum_charge_sen`, `rounding_sen` are
per `model_pricing` row with global defaults (admin §72). Estimates are computed
from `customer_price_json` so no markup logic runs in the UI. After execution,
actual usage from the provider response (tokens, neurons, seconds) recomputes
`actual_cost_sen`; if the provider gives no usage, actual = estimate and the
generation is flagged `cost_basis: 'estimated'`.

## Idempotency (§120)
`POST /generations` and `/workflows/:id/run` accept `Idempotency-Key`; unique on
`(org_id, idempotency_key)`; a replay returns the original resource, no new
reservation.

## Deposits (§121)
`PaymentService` creates a `payments` row, verifies the provider callback, then
writes a `deposit`. AI execution never touches the payment provider.

## Low balance (§122)
After every charge, if `available_sen < user.settings.low_balance_threshold_sen`
emit `balance.low` (webhook + in-app banner) at most once per day.

## Admin view (§123)
Admin DTOs add `provider_cost_micro_usd`, `markup_percent`, `margin_sen`. Margin
= customer charge − provider cost × fx. Reports roll up from `usage_records`.
