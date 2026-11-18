using FreshMarket.Api.Auth;
using FreshMarket.Api.Contracts;
using FreshMarket.Api.Data;
using FreshMarket.Api.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FreshMarket.Api.Controllers;

[ApiController]
[Route("api/admin/dashboard")]
[Authorize(Policy = Policies.ShopAdmin)]
public class AdminDashboardController(AppDbContext db, IConfiguration config) : ControllerBase
{
    [HttpGet]
    public async Task<DashboardDto> Get()
    {
        var shopId = User.GetShopId();
        var offset = TimeSpan.FromMinutes(config.GetValue("Store:UtcOffsetMinutes", 330));
        var localToday = DateOnly.FromDateTime(DateTime.UtcNow + offset);

        var products = await db.Products.AsNoTracking().Where(p => p.ShopId == shopId)
            .Select(p => new { p.IsActive, p.StockQuantity, p.LowStockThreshold }).ToListAsync();

        var orders = db.Orders.AsNoTracking().Where(o => o.ShopId == shopId);
        var statusCounts = await orders.GroupBy(o => o.Status).Select(g => new StatusCount(g.Key, g.Count())).ToListAsync();
        int Count(OrderStatus s) => statusCounts.FirstOrDefault(x => x.Status == s)?.Count ?? 0;

        var totalSales = await orders.Where(o => o.Status != OrderStatus.Cancelled).SumAsync(o => (decimal?)o.Total) ?? 0;

        var since = DateTime.UtcNow.Date.AddDays(-15);
        var recentRaw = await orders.Where(o => o.CreatedAt >= since && o.Status != OrderStatus.Cancelled)
            .Select(o => new { o.CreatedAt, o.Total }).ToListAsync();
        var series = Enumerable.Range(0, 14).Select(i => localToday.AddDays(i - 13)).Select(day =>
        {
            var dayOrders = recentRaw.Where(o => DateOnly.FromDateTime(o.CreatedAt + offset) == day).ToList();
            return new DailySales(day, dayOrders.Sum(o => o.Total), dayOrders.Count);
        }).ToList();

        var topSince = DateTime.UtcNow.AddDays(-30);
        var topRaw = await db.OrderItems.AsNoTracking()
            .Where(i => i.Order!.ShopId == shopId && i.Order.Status != OrderStatus.Cancelled && i.Order.CreatedAt >= topSince)
            .GroupBy(i => new { i.ProductId, i.ProductName, i.ImageUrl, i.Unit })
            .Select(g => new { g.Key, Quantity = g.Sum(i => i.Quantity), Revenue = g.Sum(i => i.LineTotal) })
            .OrderByDescending(t => t.Revenue).Take(5).ToListAsync();
        var top = topRaw.Select(t => new TopProduct(t.Key.ProductId, t.Key.ProductName, t.Key.ImageUrl, t.Quantity, t.Revenue, t.Key.Unit)).ToList();

        var lowStock = await db.Products.AsNoTracking()
            .Where(p => p.ShopId == shopId && p.IsActive && p.StockQuantity <= p.LowStockThreshold)
            .OrderBy(p => p.StockQuantity).Take(8).Select(Mapping.ProductProjection).ToListAsync();

        var recent = await orders.OrderByDescending(o => o.CreatedAt).Take(6).Select(Mapping.OrderSummaryProjection).ToListAsync();
        var customers = await orders.Select(o => o.CustomerId).Distinct().CountAsync();

        return new DashboardDto(
            TotalProducts: products.Count,
            AvailableProducts: products.Count(p => p.IsActive && p.StockQuantity > 0),
            SoldOutProducts: products.Count(p => p.IsActive && p.StockQuantity <= 0),
            LowStockProducts: products.Count(p => p.IsActive && p.StockQuantity > 0 && p.StockQuantity <= p.LowStockThreshold),
            InactiveProducts: products.Count(p => !p.IsActive),
            TotalOrders: statusCounts.Sum(s => s.Count),
            PendingOrders: Count(OrderStatus.Pending) + Count(OrderStatus.Confirmed) + Count(OrderStatus.Processing) + Count(OrderStatus.ReadyForDelivery),
            CompletedOrders: Count(OrderStatus.Completed),
            CancelledOrders: Count(OrderStatus.Cancelled),
            TotalSales: totalSales,
            TodaySales: series[^1].Amount,
            TodayOrders: series[^1].Orders,
            TotalCustomers: customers,
            SalesLast14Days: series,
            StatusBreakdown: Enum.GetValues<OrderStatus>().Select(s => new StatusCount(s, Count(s))).ToList(),
            TopProducts: top,
            LowStock: lowStock,
            RecentOrders: recent);
    }
}
