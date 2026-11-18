using System.Linq.Expressions;
using FreshMarket.Api.Domain;

namespace FreshMarket.Api.Contracts;

public static class Mapping
{
    public static readonly Expression<Func<Product, ProductDto>> ProductProjection = p => new ProductDto(
        p.Id, p.ShopId, p.CategoryId, p.Category!.Name, p.Category.Slug, p.Name, p.LocalName, p.Description, p.ImageUrl, p.Unit, p.Price,
        p.StockQuantity, p.MinOrderQuantity, p.StepQuantity, p.LowStockThreshold, p.IsActive, p.IsFeatured, p.SortOrder, p.UpdatedAt);

    public static ShopPublicDto ToPublicDto(this Shop s) => new(
        s.Id, s.Name, s.Slug, s.Tagline, s.LogoUrl, s.AddressLine, s.City, s.Pincode, s.Settings.ContactPhone, s.Settings.IsOpen,
        s.Settings.AcceptsUpi, s.Settings.UpiId, s.Settings.UpiPayeeName, s.Settings.UpiQrUrl, s.Settings.AcceptsCod,
        s.Settings.DeliveryEnabled, s.Settings.PickupEnabled, s.Settings.DeliveryFee, s.Settings.FreeDeliveryAbove,
        s.Settings.MinOrderAmount, s.Settings.DeliveryEta);

    public static ShopSettingsDto ToSettingsDto(this Shop s) => new(
        s.Id, s.Name, s.Slug, s.OwnerName, s.Email, s.Phone, s.LicenseNumber, s.GstNumber, s.AddressLine, s.City, s.Pincode, s.LogoUrl,
        s.Tagline, s.Settings.ContactPhone, s.Settings.IsOpen, s.Settings.AcceptsUpi, s.Settings.UpiId, s.Settings.UpiPayeeName,
        s.Settings.UpiQrUrl, s.Settings.AcceptsCod, s.Settings.DeliveryEnabled, s.Settings.PickupEnabled, s.Settings.DeliveryFee,
        s.Settings.FreeDeliveryAbove, s.Settings.MinOrderAmount, s.Settings.DeliveryEta);

    public static CustomerDto ToDto(this Customer c) => new(c.Id, c.Phone, c.Name, c.Email, c.AddressLine, c.Landmark, c.City, c.Pincode);

    public static AdminDto ToDto(this AdminUser a) => new(
        a.Id, a.FullName, a.Username, a.Email, a.Phone, a.Role == AdminRole.SuperAdmin ? "SuperAdmin" : "ShopAdmin",
        a.ShopId, a.Shop?.Name, a.Shop?.Slug, a.Shop?.LogoUrl);

    public static OrderDto ToDto(this Order o, Shop shop) => new(
        o.Id, o.OrderNumber, o.ShopId, shop.Name, shop.Slug, o.Status, o.PaymentMethod, o.PaymentStatus, o.PaymentReference, o.Fulfillment,
        o.Subtotal, o.DeliveryFee, o.Total, o.CustomerName, o.CustomerPhone, o.DeliveryAddress, o.Notes, o.CancelReason, o.CreatedAt, o.UpdatedAt,
        o.Items.OrderBy(i => i.Id).Select(i => new OrderItemDto(i.ProductId, i.ProductName, i.ImageUrl, i.Unit, i.UnitPrice, i.Quantity, i.LineTotal)).ToList(),
        o.History.OrderBy(h => h.ChangedAt).Select(h => new OrderHistoryDto(h.Status, h.Note, h.ChangedBy, h.ChangedAt)).ToList(),
        new ShopPaymentInfo(shop.Settings.AcceptsUpi ? shop.Settings.UpiId : null, shop.Settings.UpiPayeeName,
            shop.Settings.AcceptsUpi ? shop.Settings.UpiQrUrl : null, shop.Settings.ContactPhone),
        o.PaymentClaimedAt, o.InvoiceSentAt,
        new SellerInfo(shop.AddressLine, shop.City, shop.Pincode, shop.LicenseNumber, shop.GstNumber));

    public static readonly Expression<Func<Order, OrderSummaryDto>> OrderSummaryProjection = o => new OrderSummaryDto(
        o.Id, o.OrderNumber, o.Shop!.Name, o.Status, o.PaymentMethod, o.PaymentStatus, o.Fulfillment, o.Total, o.Items.Count,
        o.CustomerName, o.CustomerPhone, o.CreatedAt, o.Items.OrderBy(i => i.Id).Select(i => i.ImageUrl).Take(4).ToList());
}
