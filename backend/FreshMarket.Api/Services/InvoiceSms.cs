using System.Globalization;
using System.Text;
using FreshMarket.Api.Domain;

namespace FreshMarket.Api.Services;

/// <summary>Plain-text invoice sized for SMS. Uses "Rs." instead of the rupee sign so it stays in the cheaper GSM-7 encoding.</summary>
public static class InvoiceSms
{
    private static readonly CultureInfo India = CultureInfo.GetCultureInfo("en-IN");

    public static string Build(Order order, Shop shop, TimeSpan utcOffset, string publicUrl)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"{shop.Name} - Invoice");
        sb.AppendLine($"Order {order.OrderNumber}, {(order.CreatedAt + utcOffset).ToString("d MMM yyyy h:mm tt", India)}");
        foreach (var i in order.Items.OrderBy(i => i.Id))
            sb.AppendLine($"{i.ProductName} {Qty(i.Quantity, i.Unit)} x {Money(i.UnitPrice)} = {Money(i.LineTotal)}");
        sb.AppendLine(order.Fulfillment == FulfillmentType.Pickup
            ? $"Items {Money(order.Subtotal)} | Store pickup"
            : $"Items {Money(order.Subtotal)} | Delivery {(order.DeliveryFee > 0 ? Money(order.DeliveryFee) : "Free")}");
        sb.AppendLine($"TOTAL {Money(order.Total)} - {PaymentLine(order)}");
        var ids = new[] { shop.LicenseNumber is null ? null : $"Lic {shop.LicenseNumber}", shop.GstNumber is null ? null : $"GSTIN {shop.GstNumber}" }
            .Where(x => x is not null).ToList();
        if (ids.Count > 0) sb.Append(string.Join(", ", ids));
        if (!string.IsNullOrWhiteSpace(publicUrl)) sb.Append($"\nView: {publicUrl.TrimEnd('/')}/orders/{order.OrderNumber}/invoice");
        return sb.ToString();
    }

    private static string PaymentLine(Order o) => o.PaymentMethod switch
    {
        PaymentMethod.Upi when o.PaymentStatus == PaymentStatus.Paid => "Paid by UPI",
        PaymentMethod.Upi => "UPI, being verified by the shop",
        _ when o.PaymentStatus == PaymentStatus.Paid => "Paid in cash",
        _ => o.Fulfillment == FulfillmentType.Pickup ? "Pay at store" : "Cash on delivery",
    };

    private static string Money(decimal v) => "Rs." + v.ToString(v % 1 == 0 ? "#,##0" : "#,##0.00", India);

    private static string Qty(decimal q, ProductUnit unit) => unit switch
    {
        ProductUnit.Kg when q < 1 => $"{q * 1000:0} g",
        ProductUnit.Kg => $"{q:0.###} kg",
        ProductUnit.Piece => $"{q:0.###} pc",
        ProductUnit.Bunch => $"{q:0.###} {(q == 1 ? "bunch" : "bunches")}",
        _ => $"{q:0.###} {(q == 1 ? "pack" : "packs")}",
    };
}
