using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using FreshMarket.Api.Data;
using FreshMarket.Api.Domain;
using FreshMarket.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace FreshMarket.Api.Auth;

public class TokenService(IOptions<JwtOptions> options, AppDbContext db)
{
    public const string AdminCookie = "fh_admin_rt";
    public const string CustomerCookie = "fh_customer_rt";

    private readonly JwtOptions _opt = options.Value;

    public (string Token, DateTime ExpiresAt) CreateAccessToken(IEnumerable<Claim> claims)
    {
        var expires = DateTime.UtcNow.AddMinutes(_opt.AccessTokenMinutes);
        var creds = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_opt.SigningKey)), SecurityAlgorithms.HmacSha256);
        var jwt = new JwtSecurityToken(_opt.Issuer, _opt.Audience, claims, DateTime.UtcNow, expires, creds);
        return (new JwtSecurityTokenHandler().WriteToken(jwt), expires);
    }

    public static IEnumerable<Claim> ClaimsFor(AdminUser admin)
    {
        var claims = new List<Claim>
        {
            new(AppClaims.Subject, admin.Id.ToString()),
            new(AppClaims.Role, admin.Role == AdminRole.SuperAdmin ? Roles.SuperAdmin : Roles.ShopAdmin),
            new(AppClaims.Name, admin.FullName),
            new(AppClaims.Username, admin.Username),
        };
        if (admin.ShopId is int shopId) claims.Add(new Claim(AppClaims.ShopId, shopId.ToString()));
        return claims;
    }

    public static IEnumerable<Claim> ClaimsFor(Customer customer) =>
    [
        new(AppClaims.Subject, customer.Id.ToString()),
        new(AppClaims.Role, Roles.Customer),
        new(AppClaims.Name, customer.Name),
        new(AppClaims.Phone, customer.Phone),
    ];

    public async Task IssueRefreshTokenAsync(HttpResponse response, TokenSubject subject, int subjectId)
    {
        var raw = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
        var expires = DateTime.UtcNow.AddDays(RefreshDays(subject));
        db.RefreshTokens.Add(new RefreshToken { SubjectType = subject, SubjectId = subjectId, TokenHash = Hash(raw), ExpiresAt = expires });
        await db.SaveChangesAsync();
        AppendCookie(response, subject, raw, expires);
    }

    /// <summary>
    /// Validates the refresh token from the cookie and slides its expiry forward, so a device stays signed in
    /// until it goes unused for the whole refresh window. The token is deliberately not rotated: rotation logs
    /// people out whenever two tabs refresh at once or a response is lost on a flaky mobile connection.
    /// </summary>
    public async Task<int?> RenewRefreshTokenAsync(HttpContext context, TokenSubject subject)
    {
        if (!context.Request.Cookies.TryGetValue(CookieName(subject), out var raw) || string.IsNullOrEmpty(raw)) return null;
        var hash = Hash(raw);
        var token = await db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash && t.SubjectType == subject);
        if (token is null || token.RevokedAt is not null || token.ExpiresAt < DateTime.UtcNow) return null;
        token.ExpiresAt = DateTime.UtcNow.AddDays(RefreshDays(subject));
        await db.SaveChangesAsync();
        AppendCookie(context.Response, subject, raw, token.ExpiresAt);
        return token.SubjectId;
    }

    private int RefreshDays(TokenSubject subject) => subject == TokenSubject.Admin ? _opt.AdminRefreshDays : _opt.CustomerRefreshDays;

    private static void AppendCookie(HttpResponse response, TokenSubject subject, string raw, DateTime expires) =>
        response.Cookies.Append(CookieName(subject), raw, new CookieOptions
        {
            HttpOnly = true,
            Secure = response.HttpContext.Request.IsHttps,
            SameSite = SameSiteMode.Strict,
            Path = "/api",
            Expires = expires,
        });

    public async Task RevokeAsync(HttpContext context, TokenSubject subject)
    {
        var name = CookieName(subject);
        if (context.Request.Cookies.TryGetValue(name, out var raw) && !string.IsNullOrEmpty(raw))
        {
            var hash = Hash(raw);
            await db.RefreshTokens.Where(t => t.TokenHash == hash).ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, DateTime.UtcNow));
        }
        context.Response.Cookies.Delete(name, new CookieOptions { Path = "/api" });
    }

    private static string CookieName(TokenSubject subject) => subject == TokenSubject.Admin ? AdminCookie : CustomerCookie;

    public static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
}
