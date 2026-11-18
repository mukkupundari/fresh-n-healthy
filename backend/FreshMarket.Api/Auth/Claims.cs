using System.Security.Claims;
using FreshMarket.Api.Infrastructure;

namespace FreshMarket.Api.Auth;

public static class Roles
{
    public const string Customer = "Customer";
    public const string ShopAdmin = "ShopAdmin";
    public const string SuperAdmin = "SuperAdmin";
}

public static class Policies
{
    public const string Customer = "Customer";
    public const string ShopAdmin = "ShopAdmin";
    public const string SuperAdmin = "SuperAdmin";
}

public static class AppClaims
{
    public const string Subject = "sub";
    public const string Role = "role";
    public const string Name = "name";
    public const string ShopId = "shop_id";
    public const string Username = "username";
    public const string Phone = "phone";
}

public static class ClaimsPrincipalExtensions
{
    public static int GetUserId(this ClaimsPrincipal user) =>
        int.TryParse(user.FindFirstValue(AppClaims.Subject), out var id) ? id : throw new ApiException(401, "Not signed in.", "unauthorized");

    public static int GetShopId(this ClaimsPrincipal user) =>
        int.TryParse(user.FindFirstValue(AppClaims.ShopId), out var id) ? id : throw ApiException.Forbidden("This account is not linked to a shop.");

    public static string GetDisplayName(this ClaimsPrincipal user) => user.FindFirstValue(AppClaims.Name) ?? "System";
}
