using FreshMarket.Api.Data;
using FreshMarket.Api.Domain;
using FreshMarket.Api.Infrastructure;
using Microsoft.Extensions.Options;

namespace FreshMarket.Api.Services;

public interface IImageStorage
{
    Task<string> SaveAsync(IFormFile file, string folder, CancellationToken ct = default);
}

internal static class ImageUpload
{
    private static readonly string[] AllowedFolders = ["products", "logos", "qr"];

    /// <summary>Validates the upload and returns its bytes, file extension and content type.</summary>
    public static async Task<(byte[] Data, string Ext, string ContentType)> ReadAsync(IFormFile file, string folder, long maxBytes, CancellationToken ct)
    {
        if (!AllowedFolders.Contains(folder)) throw ApiException.BadRequest("Unknown upload folder.");
        if (file.Length == 0) throw ApiException.BadRequest("The file is empty.");
        if (file.Length > maxBytes) throw ApiException.BadRequest($"Images must be smaller than {maxBytes / 1024 / 1024} MB.");

        using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer, ct);
        var data = buffer.ToArray();
        var (ext, type) = Detect(data) ?? throw ApiException.BadRequest("Only JPEG, PNG or WebP images are allowed.");
        return (data, ext, type);
    }

    private static (string Ext, string ContentType)? Detect(ReadOnlySpan<byte> h)
    {
        if (h.Length >= 3 && h[0] == 0xFF && h[1] == 0xD8 && h[2] == 0xFF) return (".jpg", "image/jpeg");
        if (h.Length >= 8 && h[0] == 0x89 && h[1] == 0x50 && h[2] == 0x4E && h[3] == 0x47) return (".png", "image/png");
        if (h.Length >= 12 && h[0] == 0x52 && h[1] == 0x49 && h[2] == 0x46 && h[3] == 0x46 && h[8] == 0x57 && h[9] == 0x45 && h[10] == 0x42 && h[11] == 0x50) return (".webp", "image/webp");
        return null;
    }
}

/// <summary>Stores images in the database and serves them from /uploads (see <c>UploadsController</c>). Works on hosts whose disk is wiped on redeploy.</summary>
public class DatabaseImageStorage(AppDbContext db, IOptions<StorageOptions> options) : IImageStorage
{
    public async Task<string> SaveAsync(IFormFile file, string folder, CancellationToken ct = default)
    {
        var (data, ext, type) = await ImageUpload.ReadAsync(file, folder, options.Value.MaxBytes, ct);
        var path = $"{folder}/{Guid.NewGuid():N}{ext}";
        db.StoredFiles.Add(new StoredFile { Path = path, ContentType = type, Data = data });
        await db.SaveChangesAsync(ct);
        return $"/uploads/{path}";
    }
}

/// <summary>Stores images on local disk under wwwroot.</summary>
public class LocalImageStorage(IOptions<StorageOptions> options, IWebHostEnvironment env) : IImageStorage
{
    private readonly StorageOptions _opt = options.Value;

    public async Task<string> SaveAsync(IFormFile file, string folder, CancellationToken ct = default)
    {
        var (data, ext, _) = await ImageUpload.ReadAsync(file, folder, _opt.MaxBytes, ct);
        var root = Path.IsPathRooted(_opt.LocalRoot) ? _opt.LocalRoot : Path.Combine(env.ContentRootPath, _opt.LocalRoot);
        var dir = Path.Combine(root, folder);
        Directory.CreateDirectory(dir);
        var name = $"{Guid.NewGuid():N}{ext}";
        await File.WriteAllBytesAsync(Path.Combine(dir, name), data, ct);
        return $"{_opt.PublicBasePath.TrimEnd('/')}/{folder}/{name}";
    }
}
