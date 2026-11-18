using FreshMarket.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FreshMarket.Api.Controllers;

/// <summary>Serves images saved by <see cref="Services.DatabaseImageStorage"/>. File names are random GUIDs, so the content never changes.</summary>
[ApiController]
public class UploadsController(AppDbContext db) : ControllerBase
{
    [HttpGet("uploads/{folder}/{name}")]
    [ResponseCache(Duration = 31536000, Location = ResponseCacheLocation.Any)]
    public async Task<IActionResult> Get(string folder, string name)
    {
        var path = $"{folder}/{name}";
        var file = await db.StoredFiles.AsNoTracking().Where(f => f.Path == path)
            .Select(f => new { f.ContentType, f.Data }).FirstOrDefaultAsync();
        return file is null ? NotFound() : File(file.Data, file.ContentType);
    }
}
