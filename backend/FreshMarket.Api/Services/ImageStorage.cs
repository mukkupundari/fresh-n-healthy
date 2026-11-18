using FreshMarket.Api.Infrastructure;
using Microsoft.Extensions.Options;

namespace FreshMarket.Api.Services;

public interface IImageStorage
{
    Task<string> SaveAsync(IFormFile file, string folder, CancellationToken ct = default);
}

/// <summary>Stores images on local disk under wwwroot. Replace with a blob-storage implementation for multi-server deployments.</summary>
public class LocalImageStorage(IOptions<StorageOptions> options, IWebHostEnvironment env) : IImageStorage
{
    private static readonly string[] AllowedFolders = ["products", "logos", "qr"];
    private readonly StorageOptions _opt = options.Value;

    public async Task<string> SaveAsync(IFormFile file, string folder, CancellationToken ct = default)
    {
        if (!AllowedFolders.Contains(folder)) throw ApiException.BadRequest("Unknown upload folder.");
        if (file.Length == 0) throw ApiException.BadRequest("The file is empty.");
        if (file.Length > _opt.MaxBytes) throw ApiException.BadRequest($"Images must be smaller than {_opt.MaxBytes / 1024 / 1024} MB.");

        await using var stream = file.OpenReadStream();
        var header = new byte[12];
        var read = await stream.ReadAsync(header, ct);
        var ext = DetectExtension(header.AsSpan(0, read)) ?? throw ApiException.BadRequest("Only JPEG, PNG or WebP images are allowed.");
        stream.Position = 0;

        var root = Path.IsPathRooted(_opt.LocalRoot) ? _opt.LocalRoot : Path.Combine(env.ContentRootPath, _opt.LocalRoot);
        var dir = Path.Combine(root, folder);
        Directory.CreateDirectory(dir);
        var name = $"{Guid.NewGuid():N}{ext}";
        await using (var target = File.Create(Path.Combine(dir, name)))
            await stream.CopyToAsync(target, ct);

        return $"{_opt.PublicBasePath.TrimEnd('/')}/{folder}/{name}";
    }

    private static string? DetectExtension(ReadOnlySpan<byte> h)
    {
        if (h.Length >= 3 && h[0] == 0xFF && h[1] == 0xD8 && h[2] == 0xFF) return ".jpg";
        if (h.Length >= 8 && h[0] == 0x89 && h[1] == 0x50 && h[2] == 0x4E && h[3] == 0x47) return ".png";
        if (h.Length >= 12 && h[0] == 0x52 && h[1] == 0x49 && h[2] == 0x46 && h[3] == 0x46 && h[8] == 0x57 && h[9] == 0x45 && h[10] == 0x42 && h[11] == 0x50) return ".webp";
        return null;
    }
}
