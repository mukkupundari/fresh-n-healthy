using System.Linq.Expressions;
using System.Security.Cryptography;
using FreshMarket.Api.Contracts;
using FreshMarket.Api.Data;
using FreshMarket.Api.Domain;
using FreshMarket.Api.Infrastructure;
using FreshMarket.Api.Realtime;
using Microsoft.EntityFrameworkCore;

namespace FreshMarket.Api.Services;

public class OrderService(AppDbContext db, IStoreNotifier notifier, SmsQueue sms, IConfiguration config)
{
    private const string OrderAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    public static decimal LineTotal(decimal price, decimal qty) => Math.Round(price * qty, 2, MidpointRounding.AwayFromZero);

    public static bool IsValidStep(decimal qty, decimal step)
    {
        if (step <= 0) return true;
        var ratio = qty / step;
        return Math.Abs(ratio - Math.Round(ratio)) < 0.0001m;
    }

    private static Dictionary<int, decimal> Merge(IEnumerable<CartLine> lines) =>
        lines.GroupBy(l => l.ProductId).ToDictionary(g => g.Key, g => Math.Round(g.Sum(l => l.Quantity), 3));

    public async Task<CartValidateResult> ValidateCartAsync(int shopId, IEnumerable<CartLine> lines)
    {
        var merged = Merge(lines);
        var ids = merged.Keys.ToList();
        var products = await db.Products.AsNoTracking()
            .Where(p => p.ShopId == shopId && ids.Contains(p.Id))
            .Select(Mapping.ProductProjection)
            .ToListAsync();

        var issues = new List<StockIssue>();
        decimal subtotal = 0;
        foreach (var (id, qty) in merged)
        {
            var p = products.FirstOrDefault(x => x.Id == id);
            if (p is null) { issues.Add(new StockIssue(id, "Item", qty, 0, "not_found")); continue; }
            var reason =
                !p.IsActive ? "unavailable" :
                p.StockQuantity <= 0 ? "sold_out" :
                qty > p.StockQuantity ? "insufficient_stock" :
                qty <= 0 || qty < p.MinOrderQuantity ? "below_minimum" :
                !IsValidStep(qty, p.StepQuantity) ? "invalid_step" : null;
            if (reason is not null) issues.Add(new StockIssue(id, p.Name, qty, p.IsActive ? p.StockQuantity : 0, reason));
            else subtotal += LineTotal(p.Price, qty);
        }
        return new CartValidateResult(issues.Count == 0, products, issues, subtotal);
    }

    public async Task<OrderDto> PlaceOrderAsync(int customerId, PlaceOrderRequest req)
    {
        var existing = await LoadOrderDtoAsync(o => o.CustomerId == customerId && o.IdempotencyKey == req.IdempotencyKey);
        if (existing is not null) return existing;

        var shop = await db.Shops.AsNoTracking().FirstOrDefaultAsync(s => s.Id == req.ShopId) ?? throw ApiException.NotFound("Shop");
        if (!shop.IsActive) throw ApiException.Conflict("This shop is not accepting orders right now.", "shop_inactive");
        if (!shop.Settings.IsOpen) throw ApiException.Conflict($"{shop.Name} is closed right now. Please try again later.", "shop_closed");

        if (req.PaymentMethod == PaymentMethod.Upi && !(shop.Settings.AcceptsUpi && !string.IsNullOrWhiteSpace(shop.Settings.UpiId)))
            throw ApiException.BadRequest("UPI payment is not available for this shop.", "payment_unavailable");
        if (req.PaymentMethod == PaymentMethod.Cod && !shop.Settings.AcceptsCod)
            throw ApiException.BadRequest("Cash on delivery is not available for this shop.", "payment_unavailable");
        if (req.Fulfillment == FulfillmentType.Delivery && !shop.Settings.DeliveryEnabled)
            throw ApiException.BadRequest("Home delivery is not available for this shop.", "fulfillment_unavailable");
        if (req.Fulfillment == FulfillmentType.Pickup && !shop.Settings.PickupEnabled)
            throw ApiException.BadRequest("Store pickup is not available for this shop.", "fulfillment_unavailable");
        if (req.Fulfillment == FulfillmentType.Delivery && (string.IsNullOrWhiteSpace(req.AddressLine) || req.AddressLine.Trim().Length < 5 || string.IsNullOrWhiteSpace(req.Pincode)))
            throw ApiException.BadRequest("Please enter your delivery address and pincode.", "address_required");

        var check = await ValidateCartAsync(shop.Id, req.Items);
        if (!check.IsValid) throw ApiException.Conflict("Some items in your cart need attention.", "stock_conflict", check.Issues);

        var customer = await db.Customers.FirstAsync(c => c.Id == customerId);
        var merged = Merge(req.Items);

        await using var tx = await db.Database.BeginTransactionAsync();
        try
        {
            // Atomic conditional decrement: the WHERE clause guarantees stock never goes below zero,
            // even when many customers order the same product at the same moment.
            foreach (var (productId, qty) in merged.OrderBy(k => k.Key))
            {
                var rows = await db.Products
                    .Where(p => p.Id == productId && p.ShopId == shop.Id && p.IsActive && p.StockQuantity >= qty)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(p => p.StockQuantity, p => p.StockQuantity - qty)
                        .SetProperty(p => p.UpdatedAt, DateTime.UtcNow));
                if (rows == 0)
                {
                    await tx.RollbackAsync();
                    var fresh = await ValidateCartAsync(shop.Id, req.Items);
                    throw ApiException.Conflict("Sorry, some items just sold out. Your cart has been updated.", "stock_conflict", fresh.Issues);
                }
            }

            var ids = merged.Keys.ToList();
            var locked = await db.Products.AsNoTracking().Where(p => ids.Contains(p.Id))
                .Select(p => new { p.Id, p.Name, p.ImageUrl, p.Unit, p.Price, p.StockQuantity })
                .ToDictionaryAsync(p => p.Id);

            var items = merged.OrderBy(k => k.Key).Select(kv =>
            {
                var p = locked[kv.Key];
                return new OrderItem { ProductId = p.Id, ProductName = p.Name, ImageUrl = p.ImageUrl, Unit = p.Unit, UnitPrice = p.Price, Quantity = kv.Value, LineTotal = LineTotal(p.Price, kv.Value) };
            }).ToList();

            var subtotal = items.Sum(i => i.LineTotal);
            var deliveryFee = req.Fulfillment == FulfillmentType.Delivery &&
                              !(shop.Settings.FreeDeliveryAbove is decimal free && subtotal >= free)
                ? shop.Settings.DeliveryFee : 0m;

            var address = req.Fulfillment == FulfillmentType.Delivery
                ? string.Join(", ", new[] { req.AddressLine, req.Landmark, req.City, req.Pincode }.Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => s!.Trim()))
                : null;

            var order = new Order
            {
                OrderNumber = NewOrderNumber(),
                ShopId = shop.Id,
                CustomerId = customer.Id,
                PaymentMethod = req.PaymentMethod,
                Fulfillment = req.Fulfillment,
                Subtotal = subtotal,
                DeliveryFee = deliveryFee,
                Total = subtotal + deliveryFee,
                CustomerName = req.CustomerName.Trim(),
                CustomerPhone = customer.Phone,
                DeliveryAddress = address,
                Notes = string.IsNullOrWhiteSpace(req.Notes) ? null : req.Notes.Trim(),
                IdempotencyKey = req.IdempotencyKey,
                Items = items,
                History = [new OrderStatusHistory { Status = OrderStatus.Pending, Note = "Order placed", ChangedBy = req.CustomerName.Trim() }],
            };
            db.Orders.Add(order);
            await db.SaveChangesAsync();

            db.StockMovements.AddRange(items.Select(i => new StockMovement
            {
                ProductId = i.ProductId, Change = -i.Quantity, BalanceAfter = locked[i.ProductId].StockQuantity,
                Reason = StockMovementReason.Sale, OrderId = order.Id, CreatedBy = order.CustomerName,
            }));

            customer.Name = order.CustomerName;
            if (req.Fulfillment == FulfillmentType.Delivery)
            {
                customer.AddressLine = req.AddressLine?.Trim();
                customer.Landmark = req.Landmark?.Trim();
                customer.City = req.City?.Trim();
                customer.Pincode = req.Pincode?.Trim();
            }
            await db.SaveChangesAsync();
            await tx.CommitAsync();

            await BroadcastProducts(shop.Id, ids);
            await notifier.OrderChanged(shop.Id, order.OrderNumber, order.Status.ToString());
            // UPI invoices go out once the customer confirms payment (see ConfirmPaymentAsync).
            if (order.PaymentMethod == PaymentMethod.Cod) await SendInvoiceOnceAsync(order.Id);
            return (await LoadOrderDtoAsync(o => o.Id == order.Id))!;
        }
        catch (DbUpdateException)
        {
            // Most likely a double submit racing on the (CustomerId, IdempotencyKey) unique index.
            try { await tx.RollbackAsync(); } catch (InvalidOperationException) { }
            db.ChangeTracker.Clear();
            var dup = await LoadOrderDtoAsync(o => o.CustomerId == customerId && o.IdempotencyKey == req.IdempotencyKey);
            if (dup is not null) return dup;
            throw;
        }
    }

    public async Task CancelAsync(int orderId, string actor, string? reason)
    {
        var order = await db.Orders.AsNoTracking().Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == orderId) ?? throw ApiException.NotFound("Order");
        if (order.Status == OrderStatus.Cancelled) throw ApiException.Conflict("This order is already cancelled.");
        if (order.Status == OrderStatus.Completed) throw ApiException.Conflict("Completed orders cannot be cancelled.");

        await using var tx = await db.Database.BeginTransactionAsync();
        var now = DateTime.UtcNow;
        var cancelReason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        var rows = await db.Orders
            .Where(o => o.Id == orderId && o.Status != OrderStatus.Cancelled && o.Status != OrderStatus.Completed)
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.Status, OrderStatus.Cancelled)
                .SetProperty(o => o.CancelReason, cancelReason)
                .SetProperty(o => o.UpdatedAt, now));
        if (rows == 0)
        {
            await tx.RollbackAsync();
            throw ApiException.Conflict("This order can no longer be cancelled.");
        }

        foreach (var item in order.Items)
        {
            await db.Products.Where(p => p.Id == item.ProductId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(p => p.StockQuantity, p => p.StockQuantity + item.Quantity)
                    .SetProperty(p => p.UpdatedAt, now));
            var balance = await db.Products.Where(p => p.Id == item.ProductId).Select(p => p.StockQuantity).FirstAsync();
            db.StockMovements.Add(new StockMovement
            {
                ProductId = item.ProductId, Change = item.Quantity, BalanceAfter = balance, Reason = StockMovementReason.Cancellation,
                OrderId = order.Id, CreatedBy = actor, Note = $"Restored from cancelled order {order.OrderNumber}",
            });
        }
        db.OrderStatusHistory.Add(new OrderStatusHistory { OrderId = order.Id, Status = OrderStatus.Cancelled, Note = cancelReason ?? "Order cancelled", ChangedBy = actor });
        await db.SaveChangesAsync();
        await tx.CommitAsync();

        await BroadcastProducts(order.ShopId, order.Items.Select(i => i.ProductId).ToList());
        await notifier.OrderChanged(order.ShopId, order.OrderNumber, OrderStatus.Cancelled.ToString());
    }

    public async Task UpdateStatusAsync(int shopId, int orderId, OrderStatus status, string? note, string actor)
    {
        var order = await db.Orders.FirstOrDefaultAsync(o => o.Id == orderId && o.ShopId == shopId) ?? throw ApiException.NotFound("Order");
        if (order.Status is OrderStatus.Cancelled or OrderStatus.Completed)
            throw ApiException.Conflict($"This order is already {order.Status.ToString().ToLowerInvariant()} and cannot be changed.");
        if (status == order.Status) return;
        if (status == OrderStatus.Cancelled)
        {
            await CancelAsync(orderId, actor, note);
            return;
        }

        order.Status = status;
        order.UpdatedAt = DateTime.UtcNow;
        if (status == OrderStatus.Completed && order.PaymentMethod == PaymentMethod.Cod) order.PaymentStatus = PaymentStatus.Paid;
        db.OrderStatusHistory.Add(new OrderStatusHistory { OrderId = order.Id, Status = status, Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim(), ChangedBy = actor });
        await db.SaveChangesAsync();
        await notifier.OrderChanged(shopId, order.OrderNumber, status.ToString());
    }

    /// <summary>Customer says the UPI payment is done. The shop still verifies it before marking the order paid.</summary>
    public async Task<OrderDto> ConfirmPaymentAsync(int customerId, string number, string? reference)
    {
        var order = await db.Orders.FirstOrDefaultAsync(o => o.OrderNumber == number && o.CustomerId == customerId) ?? throw ApiException.NotFound("Order");
        if (order.PaymentMethod != PaymentMethod.Upi) throw ApiException.BadRequest("Only UPI orders need a payment confirmation.");
        if (order.Status == OrderStatus.Cancelled) throw ApiException.Conflict("This order was cancelled.", "order_cancelled");
        if (order.PaymentStatus != PaymentStatus.Paid)
        {
            if (!string.IsNullOrWhiteSpace(reference)) order.PaymentReference = reference.Trim();
            order.PaymentClaimedAt ??= DateTime.UtcNow;
            order.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            await notifier.OrderChanged(order.ShopId, order.OrderNumber, order.Status.ToString());
        }
        await SendInvoiceOnceAsync(order.Id);
        return (await LoadOrderDtoAsync(o => o.Id == order.Id))!;
    }

    /// <summary>Queues the SMS invoice to the customer. Safe to call repeatedly: only the first call sends.</summary>
    public async Task SendInvoiceOnceAsync(int orderId)
    {
        var claimed = await db.Orders.Where(o => o.Id == orderId && o.InvoiceSentAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(o => o.InvoiceSentAt, DateTime.UtcNow));
        if (claimed == 0) return;
        var order = await db.Orders.AsNoTracking().Include(o => o.Items).Include(o => o.Shop).FirstAsync(o => o.Id == orderId);
        var offset = TimeSpan.FromMinutes(config.GetValue("Store:UtcOffsetMinutes", 330));
        sms.Enqueue(order.CustomerPhone, InvoiceSms.Build(order, order.Shop!, offset, config.GetValue("App:PublicUrl", "")!));
    }

    public async Task<OrderDto?> LoadOrderDtoAsync(Expression<Func<Order, bool>> filter)
    {
        var order = await db.Orders.AsNoTracking().AsSplitQuery()
            .Include(o => o.Items).Include(o => o.History).Include(o => o.Shop)
            .FirstOrDefaultAsync(filter);
        return order?.ToDto(order.Shop!);
    }

    public async Task BroadcastProducts(int shopId, List<int> productIds)
    {
        var dtos = await db.Products.AsNoTracking().Where(p => productIds.Contains(p.Id)).Select(Mapping.ProductProjection).ToListAsync();
        await notifier.ProductsChanged(shopId, dtos);
    }

    private static string NewOrderNumber()
    {
        Span<char> suffix = stackalloc char[5];
        for (var i = 0; i < suffix.Length; i++) suffix[i] = OrderAlphabet[RandomNumberGenerator.GetInt32(OrderAlphabet.Length)];
        return $"FH{DateTime.UtcNow:yyMMdd}-{suffix}";
    }
}
