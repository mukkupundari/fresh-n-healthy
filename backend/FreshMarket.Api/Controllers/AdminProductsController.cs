using FreshMarket.Api.Auth;
using FreshMarket.Api.Contracts;
using FreshMarket.Api.Data;
using FreshMarket.Api.Domain;
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
public class AdminProductsController(AppDbContext db, OrderService orders, IStoreNotifier notifier) : ControllerBase
{
    [HttpGet("products")]
    public async Task<List<ProductDto>> List([FromQuery] string? search, [FromQuery] int? categoryId, [FromQuery] string? status)
    {
        var shopId = User.GetShopId();
        var q = db.Products.AsNoTracking().Where(p => p.ShopId == shopId);
        if (!string.IsNullOrWhiteSpace(search)) q = q.Where(p => p.Name.Contains(search.Trim()));
        if (categoryId is > 0) q = q.Where(p => p.CategoryId == categoryId);
        q = status switch
        {
            "available" => q.Where(p => p.IsActive && p.StockQuantity > 0),
            "low" => q.Where(p => p.IsActive && p.StockQuantity > 0 && p.StockQuantity <= p.LowStockThreshold),
            "soldout" => q.Where(p => p.IsActive && p.StockQuantity <= 0),
            "inactive" => q.Where(p => !p.IsActive),
            "featured" => q.Where(p => p.IsFeatured),
            _ => q,
        };
        return await q.OrderBy(p => p.SortOrder).ThenBy(p => p.Name).Select(Mapping.ProductProjection).ToListAsync();
    }

    [HttpGet("products/{id:int}")]
    public async Task<ProductDto> Get(int id) => await Find(id);

    [HttpPost("products")]
    public async Task<ProductDto> Create(SaveProductRequest req)
    {
        var shopId = User.GetShopId();
        await ValidateProduct(req, shopId, null);
        var stock = Math.Round(req.StockQuantity ?? 0, 3);
        var product = new Product
        {
            ShopId = shopId,
            SortOrder = (await db.Products.Where(p => p.ShopId == shopId).MaxAsync(p => (int?)p.SortOrder) ?? 0) + 1,
            StockQuantity = stock,
        };
        Apply(product, req);
        db.Products.Add(product);
        await db.SaveChangesAsync();
        if (stock > 0)
        {
            db.StockMovements.Add(new StockMovement { ProductId = product.Id, Change = stock, BalanceAfter = stock, Reason = StockMovementReason.Initial, CreatedBy = User.GetDisplayName(), Note = "Opening stock" });
            await db.SaveChangesAsync();
        }
        await orders.BroadcastProducts(shopId, [product.Id]);
        return await Find(product.Id);
    }

    [HttpPost("products/bulk")]
    public async Task<BulkCreateProductsResult> CreateMany(BulkCreateProductsRequest req)
    {
        var shopId = User.GetShopId();
        var names = req.Items.Select(i => i.Name.Trim()).ToList();
        var taken = (await db.Products.Where(p => p.ShopId == shopId && names.Contains(p.Name)).Select(p => p.Name).ToListAsync())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var categories = (await db.Categories.Select(c => c.Id).ToListAsync()).ToHashSet();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        var errors = new Dictionary<string, string>();
        for (var i = 0; i < req.Items.Count; i++)
        {
            var item = req.Items[i];
            var name = names[i];
            var problem = taken.Contains(name) ? $"You already sell {name}."
                : !seen.Add(name) ? $"{name} is listed twice."
                : !categories.Contains(item.CategoryId) ? "Choose a valid category."
                : ItemProblems(item).Select(p => p.Message).FirstOrDefault();
            if (problem is not null) errors[i.ToString()] = problem;
        }
        if (errors.Count > 0) throw new ApiException(400, "Some vegetables need a fix before adding.", "validation", errors);

        var sort = await db.Products.Where(p => p.ShopId == shopId).MaxAsync(p => (int?)p.SortOrder) ?? 0;
        var products = req.Items.Select(item =>
        {
            var p = new Product { ShopId = shopId, SortOrder = ++sort, StockQuantity = Math.Round(item.StockQuantity ?? 0, 3) };
            Apply(p, item);
            return p;
        }).ToList();
        db.Products.AddRange(products);
        await db.SaveChangesAsync();

        var by = User.GetDisplayName();
        db.StockMovements.AddRange(products.Where(p => p.StockQuantity > 0).Select(p => new StockMovement
        {
            ProductId = p.Id, Change = p.StockQuantity, BalanceAfter = p.StockQuantity, Reason = StockMovementReason.Initial, CreatedBy = by, Note = "Opening stock",
        }));
        await db.SaveChangesAsync();
        await orders.BroadcastProducts(shopId, products.Select(p => p.Id).ToList());
        return new BulkCreateProductsResult(products.Count);
    }

    [HttpPut("products/{id:int}")]
    public async Task<ProductDto> Update(int id, SaveProductRequest req)
    {
        var shopId = User.GetShopId();
        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == id && p.ShopId == shopId) ?? throw ApiException.NotFound("Product");
        await ValidateProduct(req, shopId, id);
        Apply(product, req);
        product.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        if (req.StockQuantity is decimal target && Math.Round(target, 3) != product.StockQuantity)
            await AdjustStock(product.Id, shopId, StockAdjustMode.Set, target, "Updated from product form");

        await orders.BroadcastProducts(shopId, [id]);
        return await Find(id);
    }

    [HttpPatch("products/{id:int}/status")]
    public Task<ProductDto> SetActive(int id, ToggleRequest req) => Toggle(id, p => p.IsActive = req.Value);

    [HttpPatch("products/{id:int}/featured")]
    public Task<ProductDto> SetFeatured(int id, ToggleRequest req) => Toggle(id, p => p.IsFeatured = req.Value);

    [HttpPost("products/{id:int}/stock")]
    public async Task<ProductDto> Stock(int id, StockAdjustRequest req)
    {
        var shopId = User.GetShopId();
        await AdjustStock(id, shopId, req.Mode, req.Quantity, req.Note);
        await orders.BroadcastProducts(shopId, [id]);
        return await Find(id);
    }

    [HttpDelete("products/{id:int}")]
    public async Task<object> Delete(int id)
    {
        var shopId = User.GetShopId();
        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == id && p.ShopId == shopId) ?? throw ApiException.NotFound("Product");
        if (await db.OrderItems.AnyAsync(i => i.ProductId == id))
        {
            product.IsActive = false;
            product.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            await orders.BroadcastProducts(shopId, [id]);
            return new { deleted = false, deactivated = true, message = "This product has past orders, so it was hidden from customers instead of deleted." };
        }
        db.Products.Remove(product);
        await db.SaveChangesAsync();
        await notifier.ProductRemoved(shopId, id);
        return new { deleted = true, deactivated = false, message = "Product deleted." };
    }

    [HttpGet("inventory/movements")]
    public Task<List<StockMovementDto>> Movements([FromQuery] int? productId, [FromQuery] int take = 100)
    {
        var shopId = User.GetShopId();
        var q = db.StockMovements.AsNoTracking().Where(m => m.Product!.ShopId == shopId);
        if (productId is > 0) q = q.Where(m => m.ProductId == productId);
        return q.OrderByDescending(m => m.CreatedAt).ThenByDescending(m => m.Id).Take(Math.Clamp(take, 1, 500))
            .Select(m => new StockMovementDto(m.Id, m.ProductId, m.Product!.Name, m.Change, m.BalanceAfter, m.Reason,
                db.Orders.Where(o => o.Id == m.OrderId).Select(o => o.OrderNumber).FirstOrDefault(), m.Note, m.CreatedBy, m.CreatedAt))
            .ToListAsync();
    }

    private async Task AdjustStock(int productId, int shopId, StockAdjustMode mode, decimal quantity, string? note)
    {
        quantity = Math.Round(quantity, 3);
        var now = DateTime.UtcNow;
        var current = await db.Products.Where(p => p.Id == productId && p.ShopId == shopId).Select(p => (decimal?)p.StockQuantity).FirstOrDefaultAsync()
                      ?? throw ApiException.NotFound("Product");
        int rows;
        decimal change;
        switch (mode)
        {
            case StockAdjustMode.Add:
                if (quantity <= 0) throw ApiException.BadRequest("Enter a quantity greater than 0.");
                rows = await db.Products.Where(p => p.Id == productId).ExecuteUpdateAsync(s => s
                    .SetProperty(p => p.StockQuantity, p => p.StockQuantity + quantity).SetProperty(p => p.UpdatedAt, now));
                change = quantity;
                break;
            case StockAdjustMode.Remove:
                if (quantity <= 0) throw ApiException.BadRequest("Enter a quantity greater than 0.");
                rows = await db.Products.Where(p => p.Id == productId && p.StockQuantity >= quantity).ExecuteUpdateAsync(s => s
                    .SetProperty(p => p.StockQuantity, p => p.StockQuantity - quantity).SetProperty(p => p.UpdatedAt, now));
                if (rows == 0) throw ApiException.Conflict($"Only {current:0.###} is in stock, so {quantity:0.###} cannot be removed.");
                change = -quantity;
                break;
            default:
                rows = await db.Products.Where(p => p.Id == productId).ExecuteUpdateAsync(s => s
                    .SetProperty(p => p.StockQuantity, quantity).SetProperty(p => p.UpdatedAt, now));
                change = quantity - current;
                break;
        }
        var balance = await db.Products.Where(p => p.Id == productId).Select(p => p.StockQuantity).FirstAsync();
        db.StockMovements.Add(new StockMovement
        {
            ProductId = productId, Change = change, BalanceAfter = balance,
            Reason = mode == StockAdjustMode.Add ? StockMovementReason.Restock : StockMovementReason.Correction,
            Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim(), CreatedBy = User.GetDisplayName(),
        });
        await db.SaveChangesAsync();
    }

    private async Task<ProductDto> Toggle(int id, Action<Product> change)
    {
        var shopId = User.GetShopId();
        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == id && p.ShopId == shopId) ?? throw ApiException.NotFound("Product");
        change(product);
        product.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        await orders.BroadcastProducts(shopId, [id]);
        return await Find(id);
    }

    private async Task<ProductDto> Find(int id)
    {
        var shopId = User.GetShopId();
        return await db.Products.AsNoTracking().Where(p => p.Id == id && p.ShopId == shopId).Select(Mapping.ProductProjection).FirstOrDefaultAsync()
               ?? throw ApiException.NotFound("Product");
    }

    private async Task ValidateProduct(SaveProductRequest req, int shopId, int? id)
    {
        var errors = new Dictionary<string, string>();
        var name = req.Name.Trim();
        if (await db.Products.AnyAsync(p => p.ShopId == shopId && p.Name == name && p.Id != id)) errors["name"] = "You already have a product with this name.";
        if (!await db.Categories.AnyAsync(c => c.Id == req.CategoryId)) errors["categoryId"] = "Choose a valid category.";
        foreach (var (key, message) in ItemProblems(req)) errors[key] = message;
        if (errors.Count > 0) throw new ApiException(400, "Please fix the highlighted fields.", "validation", errors);
    }

    private static IEnumerable<(string Key, string Message)> ItemProblems(SaveProductRequest req)
    {
        if (!(req.ImageUrl.StartsWith("/images/") || req.ImageUrl.StartsWith("/uploads/") || req.ImageUrl.StartsWith("https://")))
            yield return ("imageUrl", "Upload a product photo.");
        if (req.MinOrderQuantity < req.StepQuantity) yield return ("minOrderQuantity", "Minimum order cannot be smaller than the step size.");
        if (req.Unit != ProductUnit.Kg && (req.StepQuantity % 1 != 0 || req.MinOrderQuantity % 1 != 0))
            yield return ("stepQuantity", "Pieces, bunches and packs must be ordered in whole numbers.");
    }

    private static void Apply(Product p, SaveProductRequest req)
    {
        p.Name = req.Name.Trim();
        p.LocalName = string.IsNullOrWhiteSpace(req.LocalName) ? null : req.LocalName.Trim();
        p.Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim();
        p.CategoryId = req.CategoryId;
        p.ImageUrl = req.ImageUrl.Trim();
        p.Unit = req.Unit;
        p.Price = Math.Round(req.Price, 2);
        p.MinOrderQuantity = req.MinOrderQuantity;
        p.StepQuantity = req.StepQuantity;
        p.LowStockThreshold = req.LowStockThreshold;
        p.IsActive = req.IsActive;
        p.IsFeatured = req.IsFeatured;
    }
}
