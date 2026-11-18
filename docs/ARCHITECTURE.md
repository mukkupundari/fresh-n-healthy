# Fresh n Healthy — Architecture

Multi-shop fresh vegetable marketplace. Each shop (tenant) is run by its own admin, who manages products, prices, stock, orders and payment settings. Customers sign in with their mobile number, pick a shop, and order vegetables with live stock.

```
frontend/   Angular 19 (standalone components, signals, SCSS) — customer app + /admin app
backend/    ASP.NET Core 8 Web API, EF Core 8, SQL Server, JWT, SignalR
docs/       This document
```

## 1. Design system

| Token | Value | Use |
|---|---|---|
| `--forest-900` | `#12301F` | Headings, dark surfaces (cart bar, admin sidebar) |
| `--leaf-600` | `#2E7D3E` | Primary actions |
| `--leaf-100` | `#E4F1E0` | Soft highlights, chips |
| `--lime-400` | `#A8D45B` | Accent (badges, focus) — used sparingly |
| `--cream-50` | `#FBF8F1` | App background |
| `--cream-200` | `#F1ECDF` | Image wells, skeletons |
| `--ink` / `--muted` | `#18221C` / `#6A776F` | Text |
| `--danger` / `--amber` | `#C2412D` / `#C98A1B` | Sold out / low stock |

- Typography: **Fraunces** (display serif, headings and prices) + **Plus Jakarta Sans** (UI text).
- Radius scale 10 / 14 / 20 / 28 px; soft layered shadows; no decorative gradients (only a photo scrim for legibility).
- Motion: 180–320 ms ease-out; cart bar slides up, product cards "pop" on add, bottom sheets spring in. `prefers-reduced-motion` respected.
- Photography: real Pexels photos (free commercial licence), square-cropped 800×800 for products, full-bleed for hero.

## 2. Screens

Customer (`/`): Home (hero, search, category chips, product grid, floating cart) · Store picker · Product detail · Cart (bottom sheet + full page) · Checkout · Order success · My orders / order detail · Profile · Login (mobile OTP).

Admin (`/admin`): Login · Register shop (2 steps: shop & owner details → username & password) · Dashboard · Products · Add/Edit product · Inventory (stock adjustments + movement log) · Orders · Order detail · Customers · Store settings (profile, payments, delivery, availability) · Platform (super admin: all shops, suspend/activate).

Mobile: single column, bottom tab bar, sticky search, 2-column product grid, floating cart bar above tab bar. Tablet/desktop: hero becomes a 3-photo mosaic, 3–5 column grid, admin gets a fixed sidebar.

## 3. Frontend structure

```
src/app/
  core/        api clients, auth stores, cart store, shop store, realtime (SignalR), interceptors, guards, models
  shared/      product-card, qty-stepper, bottom-sheet, status-badge, empty-state, skeletons, image-upload, pipes
  customer/    shell + pages (home, product, cart, checkout, success, orders, profile, login, shops)
  admin/       shell + pages (login, register, dashboard, products, product-form, inventory, orders, order-detail, customers, settings, platform)
```

- The cart is client-side per shop (localStorage), clamped to live stock, and revalidated by the server at checkout.
- Live updates: the shop page joins SignalR group `shop:{id}`; any stock/price change (order, cancel, admin edit) is pushed to every connected customer.

## 4. Database schema (SQL Server)

```
Shops(Id, Name, Slug UQ, OwnerName, Email UQ, Phone, LicenseNumber UQ, GstNumber, AddressLine, City, Pincode,
      LogoUrl, Tagline, IsActive, CreatedAt,
      Settings_* : ContactPhone, IsOpen, AcceptsUpi, UpiId, UpiPayeeName, UpiQrUrl, AcceptsCod,
                   DeliveryEnabled, PickupEnabled, DeliveryFee, FreeDeliveryAbove, MinOrderAmount, DeliveryEta)
AdminUsers(Id, ShopId FK NULL, Role[SuperAdmin|ShopAdmin], FullName, Username UQ, Email, Phone, PasswordHash, IsActive, CreatedAt, LastLoginAt)
Customers(Id, Phone UQ, Name, Email, AddressLine, Landmark, City, Pincode, CreatedAt, LastLoginAt)
OtpCodes(Id, Phone, CodeHash, ExpiresAt, Attempts, ConsumedAt, CreatedAt)
RefreshTokens(Id, SubjectType, SubjectId, TokenHash UQ, ExpiresAt, RevokedAt, CreatedAt)
Categories(Id, Name, Slug UQ, SortOrder)
Products(Id, ShopId FK, CategoryId FK, Name, Description, ImageUrl, Unit[Kg|Piece|Bunch|Pack], Price, StockQuantity CHECK>=0,
         MinOrderQuantity, StepQuantity, LowStockThreshold, IsActive, IsFeatured, SortOrder, CreatedAt, UpdatedAt, RowVersion)
         UQ(ShopId, Name)
Orders(Id, OrderNumber UQ, ShopId FK, CustomerId FK, Status, PaymentMethod, PaymentStatus, PaymentReference, Fulfillment,
       Subtotal, DeliveryFee, Total, CustomerName, CustomerPhone, DeliveryAddress, Notes, IdempotencyKey, CreatedAt, UpdatedAt, CancelReason)
       UQ(CustomerId, IdempotencyKey)
OrderItems(Id, OrderId FK, ProductId FK, ProductName, ImageUrl, Unit, UnitPrice, Quantity, LineTotal)
OrderStatusHistory(Id, OrderId FK, Status, Note, ChangedBy, ChangedAt)
StockMovements(Id, ProductId FK, Change, BalanceAfter, Reason[Restock|Sale|Cancellation|Correction], OrderId NULL, Note, CreatedBy, CreatedAt)
```

### Inventory guarantees

Placing an order runs in one database transaction:

1. Idempotency check on `(CustomerId, IdempotencyKey)` — a retried submit returns the original order.
2. Prices and stock are read from the database (client prices are ignored).
3. For each line, in product-id order, an atomic conditional update:
   `UPDATE Products SET StockQuantity = StockQuantity - @q WHERE Id = @id AND IsActive = 1 AND StockQuantity >= @q`.
   Zero rows affected means another customer took the stock; the transaction rolls back and the API returns `409` with the current availability per product.
4. The order, items, status history and stock movements are inserted, then committed. The `CHECK (StockQuantity >= 0)` constraint is a last line of defence.

Cancelling (customer while `Pending`, or admin any time before `Completed`) restores stock in a transaction and records a `Cancellation` movement exactly once.

## 5. API

| Area | Endpoints |
|---|---|
| Public | `GET /api/shops`, `GET /api/shops/{slug}`, `GET /api/shops/{slug}/products`, `GET /api/categories` |
| Customer auth | `POST /api/auth/otp/request`, `POST /api/auth/otp/verify`, `POST /api/auth/refresh`, `POST /api/auth/logout` |
| Customer | `GET/PUT /api/me`, `POST /api/cart/validate`, `POST /api/orders`, `GET /api/orders`, `GET /api/orders/{number}`, `POST /api/orders/{number}/cancel` |
| Admin auth | `POST /api/admin/auth/register/check`, `POST /api/admin/auth/register`, `POST /api/admin/auth/login`, `POST /api/admin/auth/refresh`, `POST /api/admin/auth/logout`, `GET /api/admin/auth/me` |
| Shop admin | `GET /api/admin/dashboard`, `/api/admin/products` (CRUD, `/status`, `/featured`, `/stock`), `GET /api/admin/inventory/movements`, `/api/admin/orders` (list, detail, `/status`, `/payment`), `GET /api/admin/customers`, `GET/PUT /api/admin/settings`, `POST /api/admin/uploads` |
| Super admin | `GET /api/platform/overview`, `GET /api/platform/shops`, `PATCH /api/platform/shops/{id}/status` |
| Realtime | SignalR hub `/hubs/store`: `productChanged`, `shopChanged` (customers); `orderChanged` (shop admins) |

### Security

- Admin passwords hashed with ASP.NET Core Identity `PasswordHasher` (PBKDF2, salted). Policy: 8+ chars, upper, lower, digit.
- Customers sign in with a 6-digit OTP (hashed, 5-minute expiry, 5 attempts, rate-limited). SMS is behind `ISmsSender`; in development the code is returned to the UI.
- Short-lived JWT access tokens (30 min) + rotating refresh tokens in `HttpOnly; SameSite=Strict` cookies (separate cookies for admin and customer sessions), stored hashed and revoked on logout.
- Role policies: `Customer`, `ShopAdmin`, `SuperAdmin`. Every admin query is scoped by the `shop_id` claim, so one shop can never read or modify another shop's data. Suspended shops cannot log in.
- Uploads: JPEG/PNG/WebP only, 5 MB max, magic-byte check, random file names, behind `IImageStorage` (local disk by default; swap for blob storage).
- Rate limiting on OTP and login endpoints.
