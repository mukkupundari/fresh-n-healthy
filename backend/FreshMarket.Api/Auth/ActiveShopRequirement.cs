using FreshMarket.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace FreshMarket.Api.Auth;

/// <summary>Rejects shop-admin tokens once their shop has been suspended, without waiting for the access token to expire.</summary>
public class ActiveShopRequirement : IAuthorizationRequirement;

public class ActiveShopHandler(IServiceScopeFactory scopes, IMemoryCache cache) : AuthorizationHandler<ActiveShopRequirement>
{
    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, ActiveShopRequirement requirement)
    {
        if (!int.TryParse(context.User.FindFirst(AppClaims.ShopId)?.Value, out var shopId)) return;
        var active = await cache.GetOrCreateAsync($"shop-active:{shopId}", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(30);
            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            return await db.Shops.AnyAsync(s => s.Id == shopId && s.IsActive);
        });
        if (active) context.Succeed(requirement);
    }
}
