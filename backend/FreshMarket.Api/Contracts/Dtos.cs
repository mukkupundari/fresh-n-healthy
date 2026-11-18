using System.ComponentModel.DataAnnotations;
using FreshMarket.Api.Domain;

namespace FreshMarket.Api.Contracts;

public static class Patterns
{
    public const string IndianMobile = @"^[6-9]\d{9}$";
    public const string Username = @"^[a-zA-Z0-9_.]{4,30}$";
    public const string License = @"^[A-Za-z0-9\-/ ]{5,40}$";
    public const string Pincode = @"^\d{6}$";
    public const string Gst = @"^[0-9A-Za-z]{15}$";
    public const string Upi = @"^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$";
}

// ---------- Public ----------
public record CategoryDto(int Id, string Name, string Slug);

public record ShopSummaryDto(int Id, string Name, string Slug, string? Tagline, string? LogoUrl, string City, bool IsOpen, string DeliveryEta, int ProductCount);

public record ShopPublicDto(
    int Id, string Name, string Slug, string? Tagline, string? LogoUrl, string AddressLine, string City, string Pincode,
    string ContactPhone, bool IsOpen, bool AcceptsUpi, string? UpiId, string? UpiPayeeName, string? UpiQrUrl, bool AcceptsCod,
    bool DeliveryEnabled, bool PickupEnabled, decimal DeliveryFee, decimal? FreeDeliveryAbove, decimal MinOrderAmount, string DeliveryEta);

public record ProductDto(
    int Id, int ShopId, int CategoryId, string CategoryName, string CategorySlug, string Name, string? LocalName, string? Description, string ImageUrl,
    ProductUnit Unit, decimal Price, decimal StockQuantity, decimal MinOrderQuantity, decimal StepQuantity, decimal LowStockThreshold,
    bool IsActive, bool IsFeatured, int SortOrder, DateTime UpdatedAt);

// ---------- Customer auth ----------
public record OtpRequest([Required, RegularExpression(Patterns.IndianMobile, ErrorMessage = "Enter a valid 10-digit mobile number.")] string Phone);
public record OtpRequestResult(int ExpiresInSeconds, bool IsNewUser, string? DevCode);
public record OtpVerifyRequest(
    [Required, RegularExpression(Patterns.IndianMobile, ErrorMessage = "Enter a valid 10-digit mobile number.")] string Phone,
    [Required, RegularExpression(@"^\d{6}$", ErrorMessage = "Enter the 6-digit code.")] string Code,
    [MaxLength(120)] string? Name);

public record CustomerDto(int Id, string Phone, string Name, string? Email, string? AddressLine, string? Landmark, string? City, string? Pincode);
public record CustomerAuthResult(string AccessToken, DateTime ExpiresAt, CustomerDto Customer);

public record UpdateProfileRequest(
    [Required, MinLength(2), MaxLength(120)] string Name,
    [EmailAddress, MaxLength(200)] string? Email,
    [MaxLength(300)] string? AddressLine,
    [MaxLength(120)] string? Landmark,
    [MaxLength(80)] string? City,
    [RegularExpression(Patterns.Pincode, ErrorMessage = "Enter a valid 6-digit pincode.")] string? Pincode);

// ---------- Cart / orders ----------
public record CartLine([Range(1, int.MaxValue)] int ProductId, [Range(0.001, 10000)] decimal Quantity);
public record CartValidateRequest([Range(1, int.MaxValue)] int ShopId, [Required, MinLength(1)] List<CartLine> Items);
public record StockIssue(int ProductId, string ProductName, decimal Requested, decimal Available, string Reason);
public record CartValidateResult(bool IsValid, List<ProductDto> Products, List<StockIssue> Issues, decimal Subtotal);

public record PlaceOrderRequest(
    [Range(1, int.MaxValue)] int ShopId,
    [Required(ErrorMessage = "Add at least one vegetable to your cart."), MinLength(1, ErrorMessage = "Add at least one vegetable to your cart.")] List<CartLine> Items,
    PaymentMethod PaymentMethod,
    FulfillmentType Fulfillment,
    [Required, MinLength(2), MaxLength(120)] string CustomerName,
    [MaxLength(300)] string? AddressLine,
    [MaxLength(120)] string? Landmark,
    [MaxLength(80)] string? City,
    [RegularExpression(Patterns.Pincode, ErrorMessage = "Enter a valid 6-digit pincode.")] string? Pincode,
    [MaxLength(500)] string? Notes,
    [Required, MinLength(8), MaxLength(64)] string IdempotencyKey);

public record OrderItemDto(int ProductId, string ProductName, string ImageUrl, ProductUnit Unit, decimal UnitPrice, decimal Quantity, decimal LineTotal);
public record OrderHistoryDto(OrderStatus Status, string? Note, string ChangedBy, DateTime ChangedAt);

public record OrderDto(
    int Id, string OrderNumber, int ShopId, string ShopName, string ShopSlug, OrderStatus Status, PaymentMethod PaymentMethod,
    PaymentStatus PaymentStatus, string? PaymentReference, FulfillmentType Fulfillment, decimal Subtotal, decimal DeliveryFee, decimal Total,
    string CustomerName, string CustomerPhone, string? DeliveryAddress, string? Notes, string? CancelReason, DateTime CreatedAt, DateTime UpdatedAt,
    List<OrderItemDto> Items, List<OrderHistoryDto> History, ShopPaymentInfo Payment,
    DateTime? PaymentClaimedAt, DateTime? InvoiceSentAt, SellerInfo Seller);

public record SellerInfo(string AddressLine, string City, string Pincode, string? LicenseNumber, string? GstNumber);

public record ShopPaymentInfo(string? UpiId, string? UpiPayeeName, string? UpiQrUrl, string ContactPhone);

public record OrderSummaryDto(
    int Id, string OrderNumber, string ShopName, OrderStatus Status, PaymentMethod PaymentMethod, PaymentStatus PaymentStatus,
    FulfillmentType Fulfillment, decimal Total, int ItemCount, string CustomerName, string CustomerPhone, DateTime CreatedAt, List<string> Thumbnails);

public record CancelOrderRequest([MaxLength(300)] string? Reason);
public record PaymentReferenceRequest([Required, MinLength(4), MaxLength(60)] string Reference);
public record ConfirmPaymentRequest([MaxLength(60)] string? Reference);

// ---------- Admin auth ----------
public record ShopRegistrationDetails(
    [Required, MinLength(3), MaxLength(120)] string ShopName,
    [Required, MinLength(2), MaxLength(120)] string OwnerName,
    [Required, EmailAddress, MaxLength(200)] string Email,
    [Required, RegularExpression(Patterns.IndianMobile, ErrorMessage = "Enter a valid 10-digit mobile number.")] string Phone,
    [RegularExpression(Patterns.License, ErrorMessage = "Licence number should be 5-40 letters, digits, '-' or '/'.")] string? LicenseNumber,
    [RegularExpression(Patterns.Gst, ErrorMessage = "GSTIN should be 15 letters or digits.")] string? GstNumber,
    [Required, MinLength(5), MaxLength(300)] string AddressLine,
    [Required, MinLength(2), MaxLength(80)] string City,
    [Required, RegularExpression(Patterns.Pincode, ErrorMessage = "Enter a valid 6-digit pincode.")] string Pincode);

public record RegisterShopRequest(
    [Required] ShopRegistrationDetails Shop,
    [Required, RegularExpression(Patterns.Username, ErrorMessage = "Username: 4-30 letters, digits, '.' or '_'.")] string Username,
    [Required, MinLength(8), MaxLength(100)] string Password,
    [Required] ShopPaymentSetup Payment);

public record ShopPaymentSetup(
    bool AcceptsUpi,
    [RegularExpression(Patterns.Upi, ErrorMessage = "Enter a valid UPI ID, e.g. shopname@okaxis.")] string? UpiId,
    [MaxLength(100)] string? UpiPayeeName,
    [MaxLength(400)] string? UpiQrUrl,
    bool AcceptsCod);

public record RegistrationCheckResult(bool Ok, Dictionary<string, string> Errors);
public record RegisterShopResult(int ShopId, string ShopName, string Username);

public record AdminLoginRequest([Required] string Username, [Required] string Password);
public record AdminDto(int Id, string FullName, string Username, string Email, string Phone, string Role, int? ShopId, string? ShopName, string? ShopSlug, string? ShopLogoUrl);
public record AdminAuthResult(string AccessToken, DateTime ExpiresAt, AdminDto Admin);

// ---------- Admin products ----------
public record BulkCreateProductsRequest([Required, MinLength(1), MaxLength(100)] List<SaveProductRequest> Items);
public record BulkCreateProductsResult(int Created);

public record SaveProductRequest(
    [Required, MinLength(2), MaxLength(100)] string Name,
    [MaxLength(100, ErrorMessage = "Telugu name must be 100 characters or less.")] string? LocalName,
    [MaxLength(1000)] string? Description,
    [Range(1, int.MaxValue, ErrorMessage = "Choose a category.")] int CategoryId,
    [Required, MaxLength(400)] string ImageUrl,
    ProductUnit Unit,
    [Range(0.01, 100000, ErrorMessage = "Price must be greater than 0.")] decimal Price,
    [Range(0, 1000000, ErrorMessage = "Stock cannot be negative.")] decimal? StockQuantity,
    [Range(0.001, 1000)] decimal MinOrderQuantity,
    [Range(0.001, 1000)] decimal StepQuantity,
    [Range(0, 100000)] decimal LowStockThreshold,
    bool IsActive,
    bool IsFeatured);

public record ToggleRequest(bool Value);
public enum StockAdjustMode { Add, Remove, Set }
public record StockAdjustRequest(StockAdjustMode Mode, [Range(0, 1000000)] decimal Quantity, [MaxLength(300)] string? Note);
public record StockMovementDto(int Id, int ProductId, string ProductName, decimal Change, decimal BalanceAfter, StockMovementReason Reason, string? OrderNumber, string? Note, string CreatedBy, DateTime CreatedAt);

// ---------- Admin orders ----------
public record UpdateOrderStatusRequest(OrderStatus Status, [MaxLength(300)] string? Note);
public record UpdatePaymentStatusRequest(PaymentStatus PaymentStatus);
public record PagedResult<T>(List<T> Items, int Total, int Page, int PageSize);

// ---------- Admin dashboard ----------
public record DailySales(DateOnly Date, decimal Amount, int Orders);
public record StatusCount(OrderStatus Status, int Count);
public record TopProduct(int ProductId, string Name, string ImageUrl, decimal Quantity, decimal Revenue, ProductUnit Unit);
public record DashboardDto(
    int TotalProducts, int AvailableProducts, int SoldOutProducts, int LowStockProducts, int InactiveProducts,
    int TotalOrders, int PendingOrders, int CompletedOrders, int CancelledOrders,
    decimal TotalSales, decimal TodaySales, int TodayOrders, int TotalCustomers,
    List<DailySales> SalesLast14Days, List<StatusCount> StatusBreakdown, List<TopProduct> TopProducts,
    List<ProductDto> LowStock, List<OrderSummaryDto> RecentOrders);

public record AdminCustomerDto(int Id, string Name, string Phone, string? Email, string? City, int Orders, decimal TotalSpent, DateTime? LastOrderAt, DateTime JoinedAt);

// ---------- Admin settings ----------
public record ShopSettingsDto(
    int Id, string Name, string Slug, string OwnerName, string Email, string Phone, string? LicenseNumber, string? GstNumber,
    string AddressLine, string City, string Pincode, string? LogoUrl, string? Tagline,
    string ContactPhone, bool IsOpen, bool AcceptsUpi, string? UpiId, string? UpiPayeeName, string? UpiQrUrl, bool AcceptsCod,
    bool DeliveryEnabled, bool PickupEnabled, decimal DeliveryFee, decimal? FreeDeliveryAbove, decimal MinOrderAmount, string DeliveryEta);

public record UpdateShopSettingsRequest(
    [Required, MinLength(3), MaxLength(120)] string Name,
    [MaxLength(160)] string? Tagline,
    [MaxLength(400)] string? LogoUrl,
    [Required, MinLength(2), MaxLength(120)] string OwnerName,
    [Required, EmailAddress, MaxLength(200)] string Email,
    [Required, RegularExpression(Patterns.IndianMobile, ErrorMessage = "Enter a valid 10-digit mobile number.")] string Phone,
    [RegularExpression(Patterns.License, ErrorMessage = "Licence number should be 5-40 letters, digits, '-' or '/'.")] string? LicenseNumber,
    [RegularExpression(Patterns.Gst, ErrorMessage = "GSTIN should be 15 letters or digits.")] string? GstNumber,
    [Required, MinLength(5), MaxLength(300)] string AddressLine,
    [Required, MinLength(2), MaxLength(80)] string City,
    [Required, RegularExpression(Patterns.Pincode, ErrorMessage = "Enter a valid 6-digit pincode.")] string Pincode,
    [Required, RegularExpression(Patterns.IndianMobile, ErrorMessage = "Enter a valid 10-digit contact number.")] string ContactPhone,
    bool IsOpen,
    bool AcceptsUpi,
    [RegularExpression(Patterns.Upi, ErrorMessage = "Enter a valid UPI ID, e.g. shopname@okaxis.")] string? UpiId,
    [MaxLength(100)] string? UpiPayeeName,
    [MaxLength(400)] string? UpiQrUrl,
    bool AcceptsCod,
    bool DeliveryEnabled,
    bool PickupEnabled,
    [Range(0, 10000)] decimal DeliveryFee,
    [Range(0, 100000)] decimal? FreeDeliveryAbove,
    [Range(0, 100000)] decimal MinOrderAmount,
    [Required, MaxLength(40)] string DeliveryEta);

public record UploadResult(string Url);

// ---------- Platform ----------
public record PlatformShopDto(int Id, string Name, string Slug, string OwnerName, string Email, string Phone, string? LicenseNumber, string City, bool IsActive, bool IsOpen, int Products, int Orders, decimal Sales, DateTime CreatedAt);
public record PlatformOverviewDto(int Shops, int ActiveShops, int Customers, int Orders, decimal Sales);
