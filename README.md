# Fresh n Healthy

A multi-shop fresh-vegetable marketplace. Customers browse a shop's vegetables, see live stock, and order with UPI or cash on delivery. Each shop runs its own console to manage products, stock, orders and payment settings. A platform admin oversees all shops.

- `backend/FreshMarket.Api`: ASP.NET Core 8 REST API, EF Core 8 on SQL Server, JWT auth, and SignalR for live stock and orders.
- `frontend`: Angular 19, mobile-first. The customer storefront is at `/` and the shop console at `/admin`.
- `docs/ARCHITECTURE.md`: design system, screens, database schema and API reference.
- `docs/IMAGE_CREDITS.txt`: sources and licences for the vegetable photos.

## Run locally

Requirements: .NET 8 SDK or newer, Node 18.19+ and SQL Server LocalDB (installed with Visual Studio). You can use any other SQL Server by changing `ConnectionStrings:Default`.

```powershell
# 1. API on http://localhost:5168. It creates and seeds the database on first start.
cd backend/FreshMarket.Api
dotnet run --launch-profile http

# 2. Web app on http://localhost:4200. It proxies /api, /hubs, /images and /uploads to the API.
cd frontend
npm install
npm start
```

## Demo accounts (seed data)

| Who | Where | Login |
| --- | --- | --- |
| Shop admin: Green Basket Organics | `/admin/login` | `greenbasket` / `Admin@123` |
| Shop admin: Farm Fresh Mandi | `/admin/login` | `farmfresh` / `Admin@123` |
| Shop admin: Daily Harvest Veggies | `/admin/login` | `dailyharvest` / `Admin@123` |
| Platform admin (all shops) | `/admin/login` | `superadmin` / `Super@123` |
| Customer (has a saved address) | `/login` | `9876543210` with an OTP |

In Development, `Otp:DevMode` is on, so the login screen shows the OTP code instead of sending an SMS. Any 10-digit mobile number starting with 6 to 9 creates a new customer.

New shops register at `/admin/register` in two steps: first shop and owner details (phone, email, shop name, licence number, optional GSTIN and address), then a username and password. A shop stays hidden from the public store list until it has at least one visible product. Its own storefront link (`/?shop=<slug>`) works straight away.

To start over with clean seed data:

```powershell
cd backend/FreshMarket.Api
dotnet tool run dotnet-ef database drop -f   # then start the API again
```

## Configuration for production

Set these values with environment variables or a secrets store. Never put them in `appsettings.json`.

| Setting | Purpose |
| --- | --- |
| `ConnectionStrings__Default` | SQL Server connection string |
| `Jwt__SigningKey` | At least 32 random characters. The API refuses to start without it. |
| `Otp__Pepper` | Secret mixed into stored OTP hashes |
| `Otp__DevMode` | Must be `false`. Register a real `ISmsSender` (in `Services/SmsSender.cs`) for your SMS provider. |
| `Cors__Origins__0` | The web app's origin, if it's served from a different host than the API |
| `Storage__*` | Uploads are stored on local disk under `wwwroot/uploads` by default. To use cloud storage, implement `IImageStorage` (in `Services/ImageStorage.cs`). |
| `Seed__Enabled` | Set to `false` to skip loading demo data |

Build the web app with `npx ng build` (the output goes to `frontend/dist/frontend/browser`). Serve it from any static host, with `/api`, `/hubs`, `/images` and `/uploads` routed to the API, and with a fallback to `index.html` for client-side routes.

## How stock stays correct

- Stock is decremented with a single conditional `UPDATE … WHERE StockQuantity >= @qty` inside the order transaction, and a database `CHECK (StockQuantity >= 0)` backs it up. Two customers buying the last kilo can't both succeed. The second one gets a `409 stock_conflict` listing what changed, and the checkout adjusts their basket.
- Every order carries an idempotency key, so double taps and retries never create duplicate orders.
- Cancelling an order (by the shop, or by the customer while it's Pending) returns the items to stock. Every change is recorded as a stock movement on the Inventory page.
- Stock and price changes reach every open storefront instantly over SignalR. New orders and status changes reach the shop console the same way.
