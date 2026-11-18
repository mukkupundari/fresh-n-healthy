using FreshMarket.Api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace FreshMarket.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Shop> Shops => Set<Shop>();
    public DbSet<AdminUser> AdminUsers => Set<AdminUser>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<OtpCode> OtpCodes => Set<OtpCode>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<OrderStatusHistory> OrderStatusHistory => Set<OrderStatusHistory>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();
    public DbSet<StoredFile> StoredFiles => Set<StoredFile>();

    protected override void ConfigureConventions(ModelConfigurationBuilder builder)
    {
        builder.Properties<decimal>().HavePrecision(12, 3);
        builder.Properties<decimal?>().HavePrecision(12, 3);
        // Usernames, emails, vegetable names and searches are matched without regard to letter case.
        builder.Properties<string>().HaveColumnType("citext");
        // Postgres timestamptz only accepts UTC values; everything is stored as UTC so clients receive it with a "Z".
        builder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
        builder.Properties<DateTime?>().HaveConversion<UtcDateTimeConverter>();
    }

    private sealed class UtcDateTimeConverter() : ValueConverter<DateTime, DateTime>(
        v => v.Kind == DateTimeKind.Local ? v.ToUniversalTime() : DateTime.SpecifyKind(v, DateTimeKind.Utc),
        v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.HasPostgresExtension("citext");

        b.Entity<StoredFile>(e =>
        {
            e.HasKey(x => x.Path);
            e.Property(x => x.Data).HasColumnType("bytea");
        });

        b.Entity<Shop>(e =>
        {
            e.HasIndex(x => x.Slug).IsUnique();
            e.HasIndex(x => x.Email).IsUnique();
            e.HasIndex(x => x.LicenseNumber).IsUnique();
            e.OwnsOne(x => x.Settings, s =>
            {
                s.Property(p => p.DeliveryFee).HasPrecision(10, 2);
                s.Property(p => p.FreeDeliveryAbove).HasPrecision(10, 2);
                s.Property(p => p.MinOrderAmount).HasPrecision(10, 2);
            });
        });

        b.Entity<AdminUser>(e =>
        {
            e.HasIndex(x => x.Username).IsUnique();
            e.HasOne(x => x.Shop).WithMany(s => s.Admins).HasForeignKey(x => x.ShopId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Customer>().HasIndex(x => x.Phone).IsUnique();
        b.Entity<OtpCode>().HasIndex(x => new { x.Phone, x.CreatedAt });
        b.Entity<RefreshToken>().HasIndex(x => x.TokenHash).IsUnique();
        b.Entity<Category>().HasIndex(x => x.Slug).IsUnique();

        b.Entity<Product>(e =>
        {
            e.ToTable(t => t.HasCheckConstraint("CK_Products_Stock_NonNegative", "\"StockQuantity\" >= 0"));
            e.HasIndex(x => new { x.ShopId, x.Name }).IsUnique();
            e.Property(x => x.Price).HasPrecision(10, 2);
            e.HasOne(x => x.Shop).WithMany(s => s.Products).HasForeignKey(x => x.ShopId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Category).WithMany().HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Order>(e =>
        {
            e.HasIndex(x => x.OrderNumber).IsUnique();
            e.HasIndex(x => new { x.CustomerId, x.IdempotencyKey }).IsUnique();
            e.HasIndex(x => new { x.ShopId, x.CreatedAt });
            e.Property(x => x.Subtotal).HasPrecision(10, 2);
            e.Property(x => x.DeliveryFee).HasPrecision(10, 2);
            e.Property(x => x.Total).HasPrecision(10, 2);
            e.HasOne(x => x.Shop).WithMany().HasForeignKey(x => x.ShopId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
            e.HasMany(x => x.Items).WithOne(i => i.Order).HasForeignKey(i => i.OrderId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.History).WithOne().HasForeignKey(h => h.OrderId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<OrderItem>(e =>
        {
            e.Property(x => x.UnitPrice).HasPrecision(10, 2);
            e.Property(x => x.LineTotal).HasPrecision(10, 2);
            e.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<StockMovement>(e =>
        {
            e.HasIndex(x => new { x.ProductId, x.CreatedAt });
            e.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
