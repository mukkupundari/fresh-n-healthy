using System.Text.RegularExpressions;
using FreshMarket.Api.Auth;
using FreshMarket.Api.Contracts;
using FreshMarket.Api.Data;
using FreshMarket.Api.Domain;
using FreshMarket.Api.Infrastructure;
using FreshMarket.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace FreshMarket.Api.Controllers;

[ApiController]
[Route("api/admin/auth")]
public partial class AdminAuthController(AppDbContext db, TokenService tokens, IPasswordHasher<AdminUser> hasher, IImageStorage storage) : ControllerBase
{
    private const string QrUploadPrefix = "/uploads/qr/";

    /// <summary>Lets a shop upload its UPI QR before it has an account; only images are accepted and the endpoint is rate limited.</summary>
    [HttpPost("register/qr")]
    [EnableRateLimiting("login")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<UploadResult> UploadQr(IFormFile file) =>
        new(await storage.SaveAsync(file, "qr", HttpContext.RequestAborted));

    /// <summary>Step 1 of registration: validates shop and owner details before asking for credentials.</summary>
    [HttpPost("register/check")]
    [EnableRateLimiting("login")]
    public async Task<RegistrationCheckResult> Check(ShopRegistrationDetails shop)
    {
        var errors = await CheckShopUniqueness(shop);
        return new RegistrationCheckResult(errors.Count == 0, errors);
    }

    [HttpGet("username-available")]
    public async Task<object> UsernameAvailable([FromQuery] string username) =>
        new { available = UsernameRegex().IsMatch(username ?? "") && !await db.AdminUsers.AnyAsync(a => a.Username == username) };

    [HttpPost("register")]
    [EnableRateLimiting("login")]
    public async Task<RegisterShopResult> Register(RegisterShopRequest req)
    {
        var errors = await CheckShopUniqueness(req.Shop);
        if (await db.AdminUsers.AnyAsync(a => a.Username == req.Username)) errors["username"] = "This username is already taken.";
        var pwError = PasswordProblem(req.Password, req.Username);
        if (pwError is not null) errors["password"] = pwError;
        var pay = req.Payment;
        if (pay.AcceptsUpi)
        {
            if (string.IsNullOrWhiteSpace(pay.UpiId)) errors["upiId"] = "Enter your UPI ID to accept UPI payments.";
            if (string.IsNullOrWhiteSpace(pay.UpiQrUrl)) errors["upiQrUrl"] = "Upload your UPI QR code so customers can scan and pay.";
            else if (!pay.UpiQrUrl.StartsWith(QrUploadPrefix, StringComparison.Ordinal)) errors["upiQrUrl"] = "Please upload the QR image again.";
        }
        if (!pay.AcceptsUpi && !pay.AcceptsCod) errors["acceptsCod"] = "Enable at least one payment method.";
        if (errors.Count > 0) throw new ApiException(400, "Please fix the highlighted fields.", "validation", errors);

        var s = req.Shop;
        var shop = new Shop
        {
            Name = s.ShopName.Trim(),
            Slug = await UniqueSlug(s.ShopName),
            OwnerName = s.OwnerName.Trim(),
            Email = s.Email.Trim().ToLowerInvariant(),
            Phone = s.Phone,
            LicenseNumber = NormaliseLicense(s.LicenseNumber),
            GstNumber = string.IsNullOrWhiteSpace(s.GstNumber) ? null : s.GstNumber.Trim().ToUpperInvariant(),
            AddressLine = s.AddressLine.Trim(),
            City = s.City.Trim(),
            Pincode = s.Pincode,
            Tagline = "Fresh vegetables, delivered daily",
            Settings = new ShopSettings
            {
                ContactPhone = s.Phone, DeliveryFee = 20, FreeDeliveryAbove = 299,
                AcceptsCod = pay.AcceptsCod,
                AcceptsUpi = pay.AcceptsUpi,
                UpiId = pay.AcceptsUpi ? pay.UpiId!.Trim() : null,
                UpiPayeeName = pay.AcceptsUpi ? (string.IsNullOrWhiteSpace(pay.UpiPayeeName) ? s.ShopName.Trim() : pay.UpiPayeeName.Trim()) : null,
                UpiQrUrl = pay.AcceptsUpi ? pay.UpiQrUrl : null,
            },
        };
        var admin = new AdminUser
        {
            Shop = shop,
            Role = AdminRole.ShopAdmin,
            FullName = s.OwnerName.Trim(),
            Username = req.Username.Trim(),
            Email = shop.Email,
            Phone = s.Phone,
        };
        admin.PasswordHash = hasher.HashPassword(admin, req.Password);
        db.AdminUsers.Add(admin);
        await db.SaveChangesAsync();
        return new RegisterShopResult(shop.Id, shop.Name, admin.Username);
    }

    [HttpPost("login")]
    [EnableRateLimiting("login")]
    public async Task<AdminAuthResult> Login(AdminLoginRequest req)
    {
        var admin = await db.AdminUsers.Include(a => a.Shop).FirstOrDefaultAsync(a => a.Username == req.Username.Trim());
        var result = admin is null ? PasswordVerificationResult.Failed : hasher.VerifyHashedPassword(admin, admin.PasswordHash, req.Password);
        if (admin is null || result == PasswordVerificationResult.Failed)
            throw new ApiException(401, "Invalid username or password.", "invalid_credentials");
        if (!admin.IsActive) throw new ApiException(403, "This account has been disabled. Please contact support.", "account_disabled");
        if (admin.Shop is { IsActive: false }) throw new ApiException(403, "This shop has been suspended. Please contact support.", "shop_suspended");

        if (result == PasswordVerificationResult.SuccessRehashNeeded) admin.PasswordHash = hasher.HashPassword(admin, req.Password);
        admin.LastLoginAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return await IssueAsync(admin);
    }

    [HttpPost("refresh")]
    public async Task<AdminAuthResult> Refresh()
    {
        var id = await tokens.RenewRefreshTokenAsync(HttpContext, TokenSubject.Admin) ?? throw new ApiException(401, "Session expired. Please sign in again.", "session_expired");
        var admin = await db.AdminUsers.AsNoTracking().Include(a => a.Shop).FirstOrDefaultAsync(a => a.Id == id);
        if (admin is null || !admin.IsActive || admin.Shop is { IsActive: false })
            throw new ApiException(401, "Session expired. Please sign in again.", "session_expired");
        var (token, expires) = tokens.CreateAccessToken(TokenService.ClaimsFor(admin));
        return new AdminAuthResult(token, expires, admin.ToDto());
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await tokens.RevokeAsync(HttpContext, TokenSubject.Admin);
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize(Roles = $"{Roles.ShopAdmin},{Roles.SuperAdmin}")]
    public async Task<AdminDto> Me()
    {
        var id = User.GetUserId();
        var admin = await db.AdminUsers.AsNoTracking().Include(a => a.Shop).FirstOrDefaultAsync(a => a.Id == id) ?? throw ApiException.NotFound("Account");
        return admin.ToDto();
    }

    private async Task<AdminAuthResult> IssueAsync(AdminUser admin)
    {
        var (token, expires) = tokens.CreateAccessToken(TokenService.ClaimsFor(admin));
        await tokens.IssueRefreshTokenAsync(Response, TokenSubject.Admin, admin.Id);
        return new AdminAuthResult(token, expires, admin.ToDto());
    }

    private async Task<Dictionary<string, string>> CheckShopUniqueness(ShopRegistrationDetails s)
    {
        var errors = new Dictionary<string, string>();
        var email = s.Email.Trim().ToLowerInvariant();
        var license = NormaliseLicense(s.LicenseNumber);
        var name = s.ShopName.Trim();
        if (await db.Shops.AnyAsync(x => x.Email == email)) errors["email"] = "A shop is already registered with this email.";
        if (license is not null && await db.Shops.AnyAsync(x => x.LicenseNumber == license)) errors["licenseNumber"] = "This licence number is already registered.";
        if (await db.Shops.AnyAsync(x => x.Name == name && x.City == s.City.Trim())) errors["shopName"] = "A shop with this name already exists in this city.";
        return errors;
    }

    private static string? NormaliseLicense(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToUpperInvariant();

    private async Task<string> UniqueSlug(string name)
    {
        var baseSlug = SlugRegex().Replace(name.Trim().ToLowerInvariant(), "-").Trim('-');
        if (baseSlug.Length == 0) baseSlug = "shop";
        if (baseSlug.Length > 120) baseSlug = baseSlug[..120];
        var slug = baseSlug;
        for (var i = 2; await db.Shops.AnyAsync(x => x.Slug == slug); i++) slug = $"{baseSlug}-{i}";
        return slug;
    }

    public static string? PasswordProblem(string password, string username)
    {
        if (password.Length < 8) return "Password must be at least 8 characters.";
        if (!password.Any(char.IsUpper) || !password.Any(char.IsLower) || !password.Any(char.IsDigit))
            return "Password must include an uppercase letter, a lowercase letter and a number.";
        if (password.Contains(username, StringComparison.OrdinalIgnoreCase)) return "Password must not contain your username.";
        return null;
    }

    [GeneratedRegex("[^a-z0-9]+")] private static partial Regex SlugRegex();
    [GeneratedRegex(Patterns.Username)] private static partial Regex UsernameRegex();
}
