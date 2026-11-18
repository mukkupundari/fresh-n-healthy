using FreshMarket.Api.Auth;
using FreshMarket.Api.Contracts;
using FreshMarket.Api.Data;
using FreshMarket.Api.Domain;
using FreshMarket.Api.Infrastructure;
using FreshMarket.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FreshMarket.Api.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Policy = Policies.ShopAdmin)]
public class AdminOrdersController(AppDbContext db, OrderService orders) : ControllerBase
{
    [HttpGet("orders")]
    public async Task<PagedResult<OrderSummaryDto>> List(
        [FromQuery] OrderStatus? status, [FromQuery] string? search, [FromQuery] PaymentStatus? paymentStatus,
        [FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var shopId = User.GetShopId();
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 5, 100);
        var q = db.Orders.AsNoTracking().Where(o => o.ShopId == shopId);
        if (status is not null) q = q.Where(o => o.Status == status);
        if (paymentStatus is not null) q = q.Where(o => o.PaymentStatus == paymentStatus);
        if (from is not null) q = q.Where(o => o.CreatedAt >= from);
        if (to is not null) q = q.Where(o => o.CreatedAt < to.Value.AddDays(1));
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            q = q.Where(o => o.OrderNumber.Contains(s) || o.CustomerPhone.Contains(s) || o.CustomerName.Contains(s));
        }
        var total = await q.CountAsync();
        var items = await q.OrderByDescending(o => o.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(Mapping.OrderSummaryProjection).ToListAsync();
        return new PagedResult<OrderSummaryDto>(items, total, page, pageSize);
    }

    [HttpGet("orders/{id:int}")]
    public async Task<OrderDto> Get(int id)
    {
        var shopId = User.GetShopId();
        return await orders.LoadOrderDtoAsync(o => o.Id == id && o.ShopId == shopId) ?? throw ApiException.NotFound("Order");
    }

    [HttpPatch("orders/{id:int}/status")]
    public async Task<OrderDto> UpdateStatus(int id, UpdateOrderStatusRequest req)
    {
        var shopId = User.GetShopId();
        await orders.UpdateStatusAsync(shopId, id, req.Status, req.Note, User.GetDisplayName());
        return (await orders.LoadOrderDtoAsync(o => o.Id == id && o.ShopId == shopId))!;
    }

    [HttpPatch("orders/{id:int}/payment")]
    public async Task<OrderDto> UpdatePayment(int id, UpdatePaymentStatusRequest req)
    {
        var shopId = User.GetShopId();
        var order = await db.Orders.FirstOrDefaultAsync(o => o.Id == id && o.ShopId == shopId) ?? throw ApiException.NotFound("Order");
        order.PaymentStatus = req.PaymentStatus;
        order.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        if (req.PaymentStatus == PaymentStatus.Paid) await orders.SendInvoiceOnceAsync(order.Id);
        return (await orders.LoadOrderDtoAsync(o => o.Id == id))!;
    }

    [HttpGet("customers")]
    public async Task<List<AdminCustomerDto>> Customers([FromQuery] string? search)
    {
        var shopId = User.GetShopId();
        var q = db.Customers.AsNoTracking().Where(c => db.Orders.Any(o => o.CustomerId == c.Id && o.ShopId == shopId));
        if (!string.IsNullOrWhiteSpace(search)) q = q.Where(c => c.Name.Contains(search.Trim()) || c.Phone.Contains(search.Trim()));
        var rows = await q.Select(c => new
            {
                c.Id, c.Name, c.Phone, c.Email, c.City, c.CreatedAt,
                OrderCount = db.Orders.Count(o => o.CustomerId == c.Id && o.ShopId == shopId),
                TotalSpent = db.Orders.Where(o => o.CustomerId == c.Id && o.ShopId == shopId && o.Status != OrderStatus.Cancelled).Sum(o => (decimal?)o.Total) ?? 0,
                LastOrderAt = db.Orders.Where(o => o.CustomerId == c.Id && o.ShopId == shopId).Max(o => (DateTime?)o.CreatedAt),
            })
            .OrderByDescending(c => c.LastOrderAt)
            .Take(500)
            .ToListAsync();
        return rows.Select(c => new AdminCustomerDto(c.Id, c.Name, c.Phone, c.Email, c.City, c.OrderCount, c.TotalSpent, c.LastOrderAt, c.CreatedAt)).ToList();
    }
}
