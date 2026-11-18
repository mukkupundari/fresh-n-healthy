using System.ComponentModel.DataAnnotations;

namespace FreshMarket.Api.Domain;

public enum AdminRole { SuperAdmin = 1, ShopAdmin = 2 }
public enum ProductUnit { Kg = 1, Piece = 2, Bunch = 3, Pack = 4 }
public enum OrderStatus { Pending = 1, Confirmed = 2, Processing = 3, ReadyForDelivery = 4, Completed = 5, Cancelled = 6 }
public enum PaymentMethod { Upi = 1, Cod = 2 }
public enum PaymentStatus { Pending = 1, Paid = 2, Failed = 3, Refunded = 4 }
public enum FulfillmentType { Delivery = 1, Pickup = 2 }
public enum StockMovementReason { Initial = 1, Restock = 2, Sale = 3, Cancellation = 4, Correction = 5 }
public enum TokenSubject { Admin = 1, Customer = 2 }

public class Shop
{
    public int Id { get; set; }
    [MaxLength(120)] public string Name { get; set; } = "";
    [MaxLength(140)] public string Slug { get; set; } = "";
    [MaxLength(120)] public string OwnerName { get; set; } = "";
    [MaxLength(200)] public string Email { get; set; } = "";
    [MaxLength(15)] public string Phone { get; set; } = "";
    [MaxLength(40)] public string? LicenseNumber { get; set; }
    [MaxLength(20)] public string? GstNumber { get; set; }
    [MaxLength(300)] public string AddressLine { get; set; } = "";
    [MaxLength(80)] public string City { get; set; } = "";
    [MaxLength(10)] public string Pincode { get; set; } = "";
    [MaxLength(400)] public string? LogoUrl { get; set; }
    [MaxLength(160)] public string? Tagline { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ShopSettings Settings { get; set; } = new();

    public List<Product> Products { get; set; } = [];
    public List<AdminUser> Admins { get; set; } = [];
}

public class ShopSettings
{
    [MaxLength(15)] public string ContactPhone { get; set; } = "";
    public bool IsOpen { get; set; } = true;
    public bool AcceptsUpi { get; set; }
    [MaxLength(100)] public string? UpiId { get; set; }
    [MaxLength(100)] public string? UpiPayeeName { get; set; }
    [MaxLength(400)] public string? UpiQrUrl { get; set; }
    public bool AcceptsCod { get; set; } = true;
    public bool DeliveryEnabled { get; set; } = true;
    public bool PickupEnabled { get; set; } = true;
    public decimal DeliveryFee { get; set; }
    public decimal? FreeDeliveryAbove { get; set; }
    public decimal MinOrderAmount { get; set; }
    [MaxLength(40)] public string DeliveryEta { get; set; } = "30-45 min";
}

public class AdminUser
{
    public int Id { get; set; }
    public int? ShopId { get; set; }
    public Shop? Shop { get; set; }
    public AdminRole Role { get; set; } = AdminRole.ShopAdmin;
    [MaxLength(120)] public string FullName { get; set; } = "";
    [MaxLength(40)] public string Username { get; set; } = "";
    [MaxLength(200)] public string Email { get; set; } = "";
    [MaxLength(15)] public string Phone { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }
}

public class Customer
{
    public int Id { get; set; }
    [MaxLength(15)] public string Phone { get; set; } = "";
    [MaxLength(120)] public string Name { get; set; } = "";
    [MaxLength(200)] public string? Email { get; set; }
    [MaxLength(300)] public string? AddressLine { get; set; }
    [MaxLength(120)] public string? Landmark { get; set; }
    [MaxLength(80)] public string? City { get; set; }
    [MaxLength(10)] public string? Pincode { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }
}

public class OtpCode
{
    public int Id { get; set; }
    [MaxLength(15)] public string Phone { get; set; } = "";
    [MaxLength(128)] public string CodeHash { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
    public int Attempts { get; set; }
    public DateTime? ConsumedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class RefreshToken
{
    public int Id { get; set; }
    public TokenSubject SubjectType { get; set; }
    public int SubjectId { get; set; }
    [MaxLength(128)] public string TokenHash { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Category
{
    public int Id { get; set; }
    [MaxLength(80)] public string Name { get; set; } = "";
    [MaxLength(80)] public string Slug { get; set; } = "";
    public int SortOrder { get; set; }
}

public class Product
{
    public int Id { get; set; }
    public int ShopId { get; set; }
    public Shop? Shop { get; set; }
    public int CategoryId { get; set; }
    public Category? Category { get; set; }
    [MaxLength(100)] public string Name { get; set; } = "";
    [MaxLength(1000)] public string? Description { get; set; }
    [MaxLength(400)] public string ImageUrl { get; set; } = "";
    public ProductUnit Unit { get; set; } = ProductUnit.Kg;
    public decimal Price { get; set; }
    public decimal StockQuantity { get; set; }
    public decimal MinOrderQuantity { get; set; } = 0.25m;
    public decimal StepQuantity { get; set; } = 0.25m;
    public decimal LowStockThreshold { get; set; } = 3;
    public bool IsActive { get; set; } = true;
    public bool IsFeatured { get; set; }
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    [Timestamp] public byte[] RowVersion { get; set; } = [];
}

public class Order
{
    public int Id { get; set; }
    [MaxLength(20)] public string OrderNumber { get; set; } = "";
    public int ShopId { get; set; }
    public Shop? Shop { get; set; }
    public int CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.Pending;
    public PaymentMethod PaymentMethod { get; set; }
    public PaymentStatus PaymentStatus { get; set; } = PaymentStatus.Pending;
    [MaxLength(60)] public string? PaymentReference { get; set; }
    /// <summary>When the customer said they finished paying by UPI; the shop still verifies before marking it paid.</summary>
    public DateTime? PaymentClaimedAt { get; set; }
    public DateTime? InvoiceSentAt { get; set; }
    public FulfillmentType Fulfillment { get; set; } = FulfillmentType.Delivery;
    public decimal Subtotal { get; set; }
    public decimal DeliveryFee { get; set; }
    public decimal Total { get; set; }
    [MaxLength(120)] public string CustomerName { get; set; } = "";
    [MaxLength(15)] public string CustomerPhone { get; set; } = "";
    [MaxLength(500)] public string? DeliveryAddress { get; set; }
    [MaxLength(500)] public string? Notes { get; set; }
    [MaxLength(64)] public string IdempotencyKey { get; set; } = "";
    [MaxLength(300)] public string? CancelReason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public List<OrderItem> Items { get; set; } = [];
    public List<OrderStatusHistory> History { get; set; } = [];
}

public class OrderItem
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public Order? Order { get; set; }
    public int ProductId { get; set; }
    public Product? Product { get; set; }
    [MaxLength(100)] public string ProductName { get; set; } = "";
    [MaxLength(400)] public string ImageUrl { get; set; } = "";
    public ProductUnit Unit { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Quantity { get; set; }
    public decimal LineTotal { get; set; }
}

public class OrderStatusHistory
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public OrderStatus Status { get; set; }
    [MaxLength(300)] public string? Note { get; set; }
    [MaxLength(120)] public string ChangedBy { get; set; } = "";
    public DateTime ChangedAt { get; set; } = DateTime.UtcNow;
}

public class StockMovement
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public Product? Product { get; set; }
    public decimal Change { get; set; }
    public decimal BalanceAfter { get; set; }
    public StockMovementReason Reason { get; set; }
    public int? OrderId { get; set; }
    [MaxLength(300)] public string? Note { get; set; }
    [MaxLength(120)] public string CreatedBy { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
