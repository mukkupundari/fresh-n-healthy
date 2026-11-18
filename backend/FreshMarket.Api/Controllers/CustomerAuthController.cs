using System.Security.Cryptography;
using System.Text;
using FreshMarket.Api.Auth;
using FreshMarket.Api.Contracts;
using FreshMarket.Api.Data;
using FreshMarket.Api.Domain;
using FreshMarket.Api.Infrastructure;
using FreshMarket.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FreshMarket.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class CustomerAuthController(AppDbContext db, TokenService tokens, ISmsSender sms, IOptions<OtpOptions> otpOptions) : ControllerBase
{
    private readonly OtpOptions _otp = otpOptions.Value;

    [HttpPost("otp/request")]
    [EnableRateLimiting("otp")]
    public async Task<OtpRequestResult> RequestOtp(OtpRequest req)
    {
        var since = DateTime.UtcNow.AddMinutes(-15);
        var recent = await db.OtpCodes.CountAsync(o => o.Phone == req.Phone && o.CreatedAt > since);
        if (recent >= 5) throw new ApiException(429, "Too many codes requested. Please wait a few minutes and try again.", "otp_throttled");

        await db.OtpCodes.Where(o => o.Phone == req.Phone && o.ConsumedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(o => o.ConsumedAt, DateTime.UtcNow));

        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        db.OtpCodes.Add(new OtpCode { Phone = req.Phone, CodeHash = HashCode(req.Phone, code), ExpiresAt = DateTime.UtcNow.AddMinutes(_otp.ExpiryMinutes) });
        await db.SaveChangesAsync();
        await sms.SendAsync(req.Phone, $"{code} is your Fresh n Healthy login code. It expires in {_otp.ExpiryMinutes} minutes.");

        var exists = await db.Customers.AnyAsync(c => c.Phone == req.Phone);
        return new OtpRequestResult(_otp.ExpiryMinutes * 60, !exists, _otp.DevMode ? code : null);
    }

    [HttpPost("otp/verify")]
    [EnableRateLimiting("otp")]
    public async Task<CustomerAuthResult> VerifyOtp(OtpVerifyRequest req)
    {
        var otp = await db.OtpCodes.Where(o => o.Phone == req.Phone && o.ConsumedAt == null && o.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(o => o.CreatedAt).FirstOrDefaultAsync()
            ?? throw ApiException.BadRequest("This code has expired. Please request a new one.", "otp_expired");

        otp.Attempts++;
        var ok = CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(otp.CodeHash), Encoding.UTF8.GetBytes(HashCode(req.Phone, req.Code)));
        if (!ok)
        {
            if (otp.Attempts >= _otp.MaxAttempts) otp.ConsumedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            throw ApiException.BadRequest(otp.ConsumedAt is null ? "Incorrect code. Please try again." : "Too many incorrect attempts. Please request a new code.", "otp_invalid");
        }
        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Phone == req.Phone);
        if (customer is null)
        {
            if (string.IsNullOrWhiteSpace(req.Name) || req.Name.Trim().Length < 2)
            {
                await db.SaveChangesAsync();
                throw ApiException.BadRequest("Please tell us your name to create your account.", "name_required");
            }
            customer = new Customer { Phone = req.Phone, Name = req.Name.Trim() };
            db.Customers.Add(customer);
        }
        otp.ConsumedAt = DateTime.UtcNow;
        customer.LastLoginAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return await IssueAsync(customer);
    }

    [HttpPost("refresh")]
    public async Task<CustomerAuthResult> Refresh()
    {
        var id = await tokens.RenewRefreshTokenAsync(HttpContext, TokenSubject.Customer) ?? throw new ApiException(401, "Session expired. Please sign in again.", "session_expired");
        var customer = await db.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id) ?? throw new ApiException(401, "Session expired. Please sign in again.", "session_expired");
        var (token, expires) = tokens.CreateAccessToken(TokenService.ClaimsFor(customer));
        return new CustomerAuthResult(token, expires, customer.ToDto());
    }

    [HttpPost("logout")]
    [AllowAnonymous]
    public async Task<IActionResult> Logout()
    {
        await tokens.RevokeAsync(HttpContext, TokenSubject.Customer);
        return NoContent();
    }

    private async Task<CustomerAuthResult> IssueAsync(Customer customer)
    {
        var (token, expires) = tokens.CreateAccessToken(TokenService.ClaimsFor(customer));
        await tokens.IssueRefreshTokenAsync(Response, TokenSubject.Customer, customer.Id);
        return new CustomerAuthResult(token, expires, customer.ToDto());
    }

    private string HashCode(string phone, string code) => TokenService.Hash($"{phone}:{code}:{_otp.Pepper}");
}

[ApiController]
[Route("api/me")]
[Authorize(Policy = Policies.Customer)]
public class MeController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<CustomerDto> Get()
    {
        var id = User.GetUserId();
        var c = await db.Customers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id) ?? throw ApiException.NotFound("Customer");
        return c.ToDto();
    }

    [HttpPut]
    public async Task<CustomerDto> Update(UpdateProfileRequest req)
    {
        var id = User.GetUserId();
        var c = await db.Customers.FirstOrDefaultAsync(x => x.Id == id) ?? throw ApiException.NotFound("Customer");
        c.Name = req.Name.Trim();
        c.Email = string.IsNullOrWhiteSpace(req.Email) ? null : req.Email.Trim();
        c.AddressLine = req.AddressLine?.Trim();
        c.Landmark = req.Landmark?.Trim();
        c.City = req.City?.Trim();
        c.Pincode = req.Pincode?.Trim();
        await db.SaveChangesAsync();
        return c.ToDto();
    }
}
