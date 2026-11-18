using FreshMarket.Api.Contracts;
using FreshMarket.Api.Data;
using FreshMarket.Api.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FreshMarket.Api.Controllers;

[ApiController]
[Route("api")]
public class PublicController(AppDbContext db) : ControllerBase
{
    [HttpGet("categories")]
    public Task<List<CategoryDto>> Categories() =>
        db.Categories.AsNoTracking().OrderBy(c => c.SortOrder).Select(c => new CategoryDto(c.Id, c.Name, c.Slug)).ToListAsync();

    [HttpGet("shops")]
    public Task<List<ShopSummaryDto>> Shops() =>
        db.Shops.AsNoTracking().Where(s => s.IsActive && s.Products.Any(p => p.IsActive)).OrderBy(s => s.Name)
            .Select(s => new ShopSummaryDto(s.Id, s.Name, s.Slug, s.Tagline, s.LogoUrl, s.City, s.Settings.IsOpen, s.Settings.DeliveryEta,
                s.Products.Count(p => p.IsActive)))
            .ToListAsync();

    [HttpGet("shops/{slug}")]
    public async Task<ShopPublicDto> Shop(string slug)
    {
        var shop = await db.Shops.AsNoTracking().FirstOrDefaultAsync(s => s.Slug == slug && s.IsActive) ?? throw ApiException.NotFound("Shop");
        return shop.ToPublicDto();
    }

    /// <summary>All active products for a shop, including sold-out ones (they stay visible in grayscale).</summary>
    [HttpGet("shops/{slug}/products")]
    public async Task<List<ProductDto>> Products(string slug)
    {
        var shopId = await db.Shops.Where(s => s.Slug == slug && s.IsActive).Select(s => (int?)s.Id).FirstOrDefaultAsync()
                     ?? throw ApiException.NotFound("Shop");
        return await db.Products.AsNoTracking()
            .Where(p => p.ShopId == shopId && p.IsActive)
            .OrderByDescending(p => p.IsFeatured).ThenBy(p => p.SortOrder).ThenBy(p => p.Name)
            .Select(Mapping.ProductProjection)
            .ToListAsync();
    }
}
