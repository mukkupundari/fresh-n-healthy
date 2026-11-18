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
[Route("api")]
public class OrdersController(AppDbContext db, OrderService orders) : ControllerBase
{
    [HttpPost("cart/validate")]
    public Task<CartValidateResult> Validate(CartValidateRequest req) => orders.ValidateCartAsync(req.ShopId, req.Items);

    [HttpPost("orders")]
    [Authorize(Policy = Policies.Customer)]
    public Task<OrderDto> Place(PlaceOrderRequest req) => orders.PlaceOrderAsync(User.GetUserId(), req);

    [HttpGet("orders")]
    [Authorize(Policy = Policies.Customer)]
    public Task<List<OrderSummaryDto>> Mine()
    {
        var id = User.GetUserId();
        return db.Orders.AsNoTracking().Where(o => o.CustomerId == id).OrderByDescending(o => o.CreatedAt).Take(100)
            .Select(Mapping.OrderSummaryProjection).ToListAsync();
    }

    [HttpGet("orders/{number}")]
    [Authorize(Policy = Policies.Customer)]
    public async Task<OrderDto> Get(string number)
    {
        var id = User.GetUserId();
        return await orders.LoadOrderDtoAsync(o => o.OrderNumber == number && o.CustomerId == id) ?? throw ApiException.NotFound("Order");
    }

    [HttpPost("orders/{number}/cancel")]
    [Authorize(Policy = Policies.Customer)]
    public async Task<OrderDto> Cancel(string number, CancelOrderRequest req)
    {
        var id = User.GetUserId();
        var order = await db.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.OrderNumber == number && o.CustomerId == id) ?? throw ApiException.NotFound("Order");
        if (order.Status != OrderStatus.Pending)
            throw ApiException.Conflict("The shop has already started preparing this order. Please call the shop to cancel it.", "cannot_cancel");
        await orders.CancelAsync(order.Id, User.GetDisplayName(), req.Reason ?? "Cancelled by customer");
        return (await orders.LoadOrderDtoAsync(o => o.Id == order.Id))!;
    }

    [HttpPost("orders/{number}/confirm-payment")]
    [Authorize(Policy = Policies.Customer)]
    public Task<OrderDto> ConfirmPayment(string number, ConfirmPaymentRequest req) =>
        orders.ConfirmPaymentAsync(User.GetUserId(), number, req.Reference);

    [HttpPost("orders/{number}/payment-reference")]
    [Authorize(Policy = Policies.Customer)]
    public async Task<OrderDto> PaymentReference(string number, PaymentReferenceRequest req)
    {
        var id = User.GetUserId();
        var order = await db.Orders.FirstOrDefaultAsync(o => o.OrderNumber == number && o.CustomerId == id) ?? throw ApiException.NotFound("Order");
        if (order.PaymentMethod != PaymentMethod.Upi) throw ApiException.BadRequest("Payment reference is only needed for UPI orders.");
        if (order.PaymentStatus == PaymentStatus.Paid) throw ApiException.Conflict("This order is already marked as paid.");
        order.PaymentReference = req.Reference.Trim();
        order.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return (await orders.LoadOrderDtoAsync(o => o.Id == order.Id))!;
    }
}
