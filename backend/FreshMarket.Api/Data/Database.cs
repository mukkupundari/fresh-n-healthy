using Npgsql;

namespace FreshMarket.Api.Data;

public static class Database
{
    /// <summary>
    /// Reads the Postgres connection string from ConnectionStrings:Default, DATABASE_URL or POSTGRES_URL.
    /// Accepts both Npgsql key/value strings and the postgres://user:pass@host/db URLs that Neon and Vercel hand out.
    /// </summary>
    public static string? ResolveConnectionString(IConfiguration config)
    {
        var raw = new[] { config.GetConnectionString("Default"), config["DATABASE_URL"], config["POSTGRES_URL"] }
            .FirstOrDefault(v => !string.IsNullOrWhiteSpace(v));
        if (raw is null) return null;
        if (!raw.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) && !raw.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
            return raw;

        var uri = new Uri(raw);
        var userInfo = uri.UserInfo.Split(':', 2);
        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.IsDefaultPort ? 5432 : uri.Port,
            Database = uri.AbsolutePath.TrimStart('/'),
            Username = Uri.UnescapeDataString(userInfo[0]),
            Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : null,
            SslMode = SslMode.Require,
        };
        foreach (var pair in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var kv = pair.Split('=', 2);
            if (kv[0].Equals("sslmode", StringComparison.OrdinalIgnoreCase) && kv.Length == 2 && Enum.TryParse<SslMode>(kv[1], true, out var mode))
                builder.SslMode = mode;
        }
        return builder.ConnectionString;
    }
}
