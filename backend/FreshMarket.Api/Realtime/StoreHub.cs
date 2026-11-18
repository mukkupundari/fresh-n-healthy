using FreshMarket.Api.Auth;
using FreshMarket.Api.Contracts;
using Microsoft.AspNetCore.SignalR;

namespace FreshMarket.Api.Realtime;

public class StoreHub : Hub
{
    public static string ShopGroup(int shopId) => $"shop:{shopId}";
    public static string AdminGroup(int shopId) => $"admin:{shopId}";

    public override async Task OnConnectedAsync()
    {
        var user = Context.User;
        if (user?.IsInRole(Roles.ShopAdmin) == true && int.TryParse(user.FindFirst(AppClaims.ShopId)?.Value, out var shopId))
            await Groups.AddToGroupAsync(Context.ConnectionId, AdminGroup(shopId));
        await base.OnConnectedAsync();
    }

    public Task JoinShop(int shopId) => Groups.AddToGroupAsync(Context.ConnectionId, ShopGroup(shopId));
    public Task LeaveShop(int shopId) => Groups.RemoveFromGroupAsync(Context.ConnectionId, ShopGroup(shopId));
}

public interface IStoreNotifier
{
    Task ProductsChanged(int shopId, IEnumerable<ProductDto> products);
    Task ProductRemoved(int shopId, int productId);
    Task ShopChanged(ShopPublicDto shop);
    Task OrderChanged(int shopId, string orderNumber, string status);
}

public class SignalRStoreNotifier(IHubContext<StoreHub> hub, ILogger<SignalRStoreNotifier> logger) : IStoreNotifier
{
    public Task ProductsChanged(int shopId, IEnumerable<ProductDto> products) =>
        Safe(() => hub.Clients.Groups(StoreHub.ShopGroup(shopId), StoreHub.AdminGroup(shopId)).SendAsync("productsChanged", products.ToList()));

    public Task ProductRemoved(int shopId, int productId) =>
        Safe(() => hub.Clients.Groups(StoreHub.ShopGroup(shopId), StoreHub.AdminGroup(shopId)).SendAsync("productRemoved", productId));

    public Task ShopChanged(ShopPublicDto shop) =>
        Safe(() => hub.Clients.Group(StoreHub.ShopGroup(shop.Id)).SendAsync("shopChanged", shop));

    public Task OrderChanged(int shopId, string orderNumber, string status) =>
        Safe(() => hub.Clients.Group(StoreHub.AdminGroup(shopId)).SendAsync("orderChanged", new { orderNumber, status }));

    private async Task Safe(Func<Task> send)
    {
        try { await send(); }
        catch (Exception ex) { logger.LogWarning(ex, "Realtime notification failed"); }
    }
}
