# Product Trash Purge and Buy Now Design

## Goal

Add a recoverable 30-day product trash lifecycle with both manual permanent deletion and automatic expiry, and add a direct Buy Now checkout path that does not disturb the shopper's existing cart.

## Product deletion lifecycle

Deleting a product remains a soft-delete operation. The product is archived, hidden from the public catalog, and given a `deleted_at` timestamp. Restoring it republishes the product and clears `deleted_at`, cancelling its pending purge.

Archived products appear in the admin product list with Edit, Restore, and Permanently Delete actions. The row also shows the remaining retention time. Permanently Delete requires a destructive-action confirmation and cannot be undone.

Expired products are purged when the server starts and once every 24 hours afterward. The purge boundary is `deleted_at <= datetime('now', '-30 days')`. Manual and automatic deletion use the same server-side purge service so dependent-record handling remains consistent.

## Historical data and dependent records

Permanent deletion removes catalog-only data, including variants, specifications, wholesale tiers, product media records, reviews, and inventory transactions. Uploaded media files are removed only when they are local product uploads and no remaining database record references the same URL.

Commerce history must remain readable. Before deleting the product, references in `order_items` and `returns` are set to `NULL`; order line snapshots retain the historical product name, unit price, quantity, and totals. The relevant foreign keys are migrated to nullable `ON DELETE SET NULL` relationships where needed. Product-specific reviews and inventory history are removed because they cannot meaningfully exist without their catalog product.

Both manual permanent deletion and automatic purge write an activity-log entry. A manual purge uses the authenticated administrator as actor; scheduled purges use a system actor.

## Admin API and UI

The admin product serializer exposes `deletedAt` and a computed `purgeAt`. Soft-delete sets `deleted_at` only on the first delete, so repeated requests cannot reset the 30-day retention clock. Restore clears it.

A dedicated permanent-delete endpoint accepts only already-archived products. It uses the existing `products.delete` permission and returns a clear conflict response if the product is still active.

The admin table shows the purge deadline/remaining days for trashed products and adds a destructive permanent-delete control beside Edit and Restore. The control uses a stronger confirmation message explaining that restoration will no longer be possible.

## Buy Now checkout

Buy Now is available beside Add to Cart on both product cards and the product-detail modal. It is disabled wherever Add to Cart is disabled for out-of-stock or discontinued products. Pre-order products keep the existing pre-order messaging and checkout validation.

Buy Now opens the existing checkout flow with an explicit one-item checkout context containing the selected product, quantity, and selected options/variant data. It does not add the product to the persistent cart and does not replace, clear, or otherwise mutate existing cart items.

The checkout component derives displayed totals, sold-out/pre-order checks, and the order request from the active checkout context. Normal cart checkout continues using `cartState`; direct checkout uses its isolated item list. Completing or abandoning direct checkout leaves the stored cart untouched. Completing a normal cart checkout retains the existing behavior of clearing the cart.

Labels are added to Bengali, English, and Chinese locale files. The two actions share a responsive layout that remains usable on narrow mobile screens.

## Error handling

- Permanent deletion rejects active products and missing product IDs.
- Purge runs isolate individual product failures so one problematic product does not block other expired products.
- Local media cleanup is best-effort and path-restricted to the uploads directory; database deletion remains transactional.
- Buy Now reuses current server-side price, stock, promotion, and order validation, so client state is never authoritative.
- Direct checkout gracefully reports a product that becomes unavailable between opening the modal and submitting the order.

## Verification

Add focused Node tests for:

- soft-delete timestamp creation and idempotency;
- restore clearing the purge deadline;
- permission-protected manual permanent deletion;
- 30-day expiry selection and purge;
- preservation of historical order/return snapshots and references;
- dependent catalog cleanup and safe media cleanup;
- direct checkout item isolation and normal-cart compatibility;
- direct checkout success leaving the existing cart unchanged;
- sold-out and pre-order behavior in both checkout modes.

Run the full available server test suite plus syntax checks for changed browser modules.
