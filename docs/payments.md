# Payments

Paper Fox takes **bank transfers** (and the odd bit of cash) for now. Card
payments through Stripe can be added later without changing how payments are
stored: every payment already records how it was paid.

## How money works in the system

- **Every amount is in whole pence**, so there are no rounding errors.
- **What someone owes is always worked out** from their price and the
  payments recorded, never typed in, so it can't drift the way a
  spreadsheet's totals can.
- **Payments are never edited or deleted.** A mistake is **removed** with a
  reason, and stays in the booking's history.
- Each booking has a **reference** (PF-2027-0001), with no gaps or
  duplicates. Customers use it as the payment reference, so transfers are
  easy to match.

## Bank details

Owners add the bank details under **Settings**. They go into the B1, thank
you and balance reminder emails, the booking details PDF and the customer's
account page, each with that person's reference. They're never stored in
the code.

## Recording a transfer

Three ways, all doing the same thing:

1. **The Pay box** on the people booked list: type the amount and press
   Enter. It's recorded as a bank transfer received today.
2. **Add** on the people booked list, or **Record a payment** on a booking's
   page: for cash, another date or a note.
3. **Bank statement** in the menu: upload the statement as a CSV file, check
   the matches, and record them all at once. Each line is matched by the
   booking reference in its description, or by the person's name. Nothing is
   recorded until you check it, and a statement uploaded twice won't record
   anything twice.

Each payment sends the right email by itself (B2 when the deposit's paid, B3
when it's paid in full, otherwise a thank you), unless an owner has switched
that off in Settings.

## Checking against the bank

**Reports → See payments by date** lists every payment by the day it
arrived, with totals for bank transfers and cash, and downloads as a CSV.
Compare it with the bank statement for the same dates: the bank transfer
total should match the money paid in from customers.

Payments brought across from the March 2027 spreadsheet are one total per
person with no date, so they don't appear in this report.

## Refunds and cancellations

Refunds are made by bank transfer outside the system. To record one, cancel
the booking (with the reason) and note the refund in the booking's payment
notes. Proper refund records, and credit towards a future event, come in a
later phase.

## Cards later (Stripe)

When cards are wanted, Stripe Checkout will be added on Paper Fox's own
Stripe account. Payments will then be confirmed by Stripe's webhook (never
by the browser), checked by signature, and recorded once only. Nothing in
the current design needs to change for that.
