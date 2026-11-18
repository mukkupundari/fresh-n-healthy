using FreshMarket.Api.Auth;
using FreshMarket.Api.Contracts;
using FreshMarket.Api.Data;
using FreshMarket.Api.Infrastructure;
using FreshMarket.Api.Realtime;
using FreshMarket.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FreshMarket.Api.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Policy = Policies.ShopAdmin)]
public class AdminSettingsController(AppDbContext db, IStoreNotifier notifier, IImageStorage storage) : ControllerBase
{
    [HttpGet("settings")]
    public async Task<ShopSettingsDto> Get()
    {
        var shopId = User.GetShopId();
        var shop = await db.Shops.AsNoTracking().FirstOrDefaultAsync(s => s.Id == shopId) ?? throw ApiException.NotFound("Shop");
        return shop.ToSettingsDto();
    }

    [HttpPut("settings")]
    public async Task<ShopSettingsDto> Update(UpdateShopSettingsRequest req)
    {
        var shopId = User.GetShopId();
        var shop = await db.Shops.FirstOrDefaultAsync(s => s.Id == shopId) ?? throw ApiException.NotFound("Shop");

        var errors = new Dictionary<string, string>();
        if (req.AcceptsUpi && string.IsNullOrWhiteSpace(req.UpiId)) errors["upiId"] = "Enter your UPI ID to accept UPI payments.";
        if (!req.AcceptsUpi && !req.AcceptsCod) errors["acceptsCod"] = "Enable at least one payment method.";
        if (!req.DeliveryEnabled && !req.PickupEnabled) errors["deliveryEnabled"] = "Enable delivery, pickup, or both.";
        var email = req.Email.Trim().ToLowerInvariant();
        if (await db.Shops.AnyAsync(s => s.Email == email && s.Id != shopId)) errors["email"] = "Another shop already uses this email.";
        var license = string.IsNullOrWhiteSpace(req.LicenseNumber) ? null : req.LicenseNumber.Trim().ToUpperInvariant();
        if (license is not null && await db.Shops.AnyAsync(s => s.LicenseNumber == license && s.Id != shopId)) errors["licenseNumber"] = "This licence number is already registered to another shop.";
        if (errors.Count > 0) throw new ApiException(400, "Please fix the highlighted fields.", "validation", errors);

        shop.Name = req.Name.Trim();
        shop.Tagline = req.Tagline?.Trim();
        shop.LogoUrl = string.IsNullOrWhiteSpace(req.LogoUrl) ? null : req.LogoUrl;
        shop.OwnerName = req.OwnerName.Trim();
        shop.Email = email;
        shop.Phone = req.Phone;
        shop.LicenseNumber = license;
        shop.GstNumber = string.IsNullOrWhiteSpace(req.GstNumber) ? null : req.GstNumber.Trim().ToUpperInvariant();
        shop.AddressLine = req.AddressLine.Trim();
        shop.City = req.City.Trim();
        shop.Pincode = req.Pincode;

        var s = shop.Settings;
        s.ContactPhone = req.ContactPhone;
        s.IsOpen = req.IsOpen;
        s.AcceptsUpi = req.AcceptsUpi;
        s.UpiId = string.IsNullOrWhiteSpace(req.UpiId) ? null : req.UpiId.Trim();
        s.UpiPayeeName = string.IsNullOrWhiteSpace(req.UpiPayeeName) ? null : req.UpiPayeeName.Trim();
        s.UpiQrUrl = string.IsNullOrWhiteSpace(req.UpiQrUrl) ? null : req.UpiQrUrl;
        s.AcceptsCod = req.AcceptsCod;
        s.DeliveryEnabled = req.DeliveryEnabled;
        s.PickupEnabled = req.PickupEnabled;
        s.DeliveryFee = req.DeliveryFee;
        s.FreeDeliveryAbove = req.FreeDeliveryAbove is > 0 ? req.FreeDeliveryAbove : null;
        s.MinOrderAmount = req.MinOrderAmount;
        s.DeliveryEta = req.DeliveryEta.Trim();
        await db.SaveChangesAsync();

        await notifier.ShopChanged(shop.ToPublicDto());
        return shop.ToSettingsDto();
    }

    [HttpPost("uploads")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<UploadResult> Upload(IFormFile file, [FromQuery] string folder = "products") =>
        new(await storage.SaveAsync(file, folder, HttpContext.RequestAborted));
}

[ApiController]
[Route("api/platform")]
[Authorize(Policy = Policies.SuperAdmin)]
public class PlatformController(AppDbContext db) : ControllerBase
{
    [HttpGet("overview")]
    public async Task<PlatformOverviewDto> Overview() => new(
        await db.Shops.CountAsync(),
        await db.Shops.CountAsync(s => s.IsActive),
        await db.Customers.CountAsync(),
        await db.Orders.CountAsync(),
        await db.Orders.Where(o => o.Status != Domain.OrderStatus.Cancelled).SumAsync(o => (decimal?)o.Total) ?? 0);

    [HttpGet("shops")]
    public Task<List<PlatformShopDto>> Shops() =>
        db.Shops.AsNoTracking().OrderByDescending(s => s.CreatedAt)
            .Select(s => new PlatformShopDto(s.Id, s.Name, s.Slug, s.OwnerName, s.Email, s.Phone, s.LicenseNumber, s.City, s.IsActive, s.Settings.IsOpen,
                s.Products.Count,
                db.Orders.Count(o => o.ShopId == s.Id),
                db.Orders.Where(o => o.ShopId == s.Id && o.Status != Domain.OrderStatus.Cancelled).Sum(o => (decimal?)o.Total) ?? 0,
                s.CreatedAt))
            .ToListAsync();

    [HttpPatch("shops/{id:int}/status")]
    public async Task<IActionResult> SetStatus(int id, ToggleRequest req)
    {
        var shop = await db.Shops.FirstOrDefaultAsync(s => s.Id == id) ?? throw ApiException.NotFound("Shop");
        shop.IsActive = req.Value;
        await db.SaveChangesAsync();
        if (!req.Value)
        {
            var adminIds = await db.AdminUsers.Where(a => a.ShopId == id).Select(a => a.Id).ToListAsync();
            await db.RefreshTokens.Where(t => t.SubjectType == Domain.TokenSubject.Admin && adminIds.Contains(t.SubjectId) && t.RevokedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, DateTime.UtcNow));
        }
        return NoContent();
    }
}
