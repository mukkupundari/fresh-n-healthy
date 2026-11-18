using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using FreshMarket.Api.Auth;
using FreshMarket.Api.Data;
using FreshMarket.Api.Domain;
using FreshMarket.Api.Infrastructure;
using FreshMarket.Api.Realtime;
using FreshMarket.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;

var jwt = config.GetSection("Jwt").Get<JwtOptions>() ?? new JwtOptions();
if (Encoding.UTF8.GetByteCount(jwt.SigningKey) < 32)
    throw new InvalidOperationException("Jwt:SigningKey must be at least 32 bytes. Set it via configuration or the Jwt__SigningKey environment variable.");

builder.Services.Configure<JwtOptions>(config.GetSection("Jwt"));
builder.Services.Configure<OtpOptions>(config.GetSection("Otp"));
builder.Services.Configure<StorageOptions>(config.GetSection("Storage"));

var connectionString = Database.ResolveConnectionString(config)
    ?? throw new InvalidOperationException("Set ConnectionStrings__Default (or DATABASE_URL) to a Postgres connection string.");
builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(connectionString));
builder.Services.AddMemoryCache();
builder.Services.AddScoped<TokenService>();
builder.Services.AddScoped<OrderService>();
builder.Services.AddScoped<IPasswordHasher<AdminUser>, PasswordHasher<AdminUser>>();
if (string.Equals(config["Storage:Provider"], "Local", StringComparison.OrdinalIgnoreCase))
    builder.Services.AddSingleton<IImageStorage, LocalImageStorage>();
else
    builder.Services.AddScoped<IImageStorage, DatabaseImageStorage>();

// Behind Render's proxy (and Vercel's rewrite in front of it) the client IP and scheme arrive in X-Forwarded-* headers.
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.ForwardLimit = config.GetValue("ForwardedHeaders:ForwardLimit", 2);
    o.KnownNetworks.Clear();
    o.KnownProxies.Clear();
});
builder.Services.AddSms(config);
builder.Services.AddSingleton<IStoreNotifier, SignalRStoreNotifier>();
builder.Services.AddSingleton<IAuthorizationHandler, ActiveShopHandler>();

builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()))
    .ConfigureApiBehaviorOptions(o => o.InvalidModelStateResponseFactory = ctx =>
    {
        var errors = ctx.ModelState.Where(kv => kv.Value?.Errors.Count > 0)
            .ToDictionary(kv => ToCamel(kv.Key), kv => kv.Value!.Errors.First().ErrorMessage is { Length: > 0 } m ? m : "Invalid value.");
        return new ObjectResult(new { status = 400, title = errors.Values.FirstOrDefault() ?? "Please check the form.", code = "validation", details = errors })
        { StatusCode = 400, ContentTypes = { "application/problem+json" } };
    });

builder.Services.AddSignalR().AddJsonProtocol(o => o.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
{
    o.MapInboundClaims = false;
    o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidIssuer = jwt.Issuer,
        ValidAudience = jwt.Audience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey)),
        ValidateIssuerSigningKey = true,
        ClockSkew = TimeSpan.FromSeconds(30),
        NameClaimType = AppClaims.Name,
        RoleClaimType = AppClaims.Role,
    };
    o.Events = new JwtBearerEvents
    {
        OnMessageReceived = ctx =>
        {
            var token = ctx.Request.Query["access_token"];
            if (!string.IsNullOrEmpty(token) && ctx.HttpContext.Request.Path.StartsWithSegments("/hubs")) ctx.Token = token;
            return Task.CompletedTask;
        },
    };
});

builder.Services.AddAuthorizationBuilder()
    .AddPolicy(Policies.Customer, p => p.RequireRole(Roles.Customer))
    .AddPolicy(Policies.ShopAdmin, p => p.RequireRole(Roles.ShopAdmin).AddRequirements(new ActiveShopRequirement()))
    .AddPolicy(Policies.SuperAdmin, p => p.RequireRole(Roles.SuperAdmin));

builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.OnRejected = async (ctx, ct) =>
    {
        ctx.HttpContext.Response.ContentType = "application/problem+json";
        await ctx.HttpContext.Response.WriteAsync("{\"status\":429,\"title\":\"Too many attempts. Please wait a minute and try again.\",\"code\":\"rate_limited\"}", ct);
    };
    var otpLimit = config.GetValue("RateLimits:OtpPerMinute", 10);
    var loginLimit = config.GetValue("RateLimits:LoginPerMinute", 15);
    o.AddPolicy("otp", ctx => RateLimitPartition.GetFixedWindowLimiter(ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = otpLimit, Window = TimeSpan.FromMinutes(1) }));
    o.AddPolicy("login", ctx => RateLimitPartition.GetFixedWindowLimiter(ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = loginLimit, Window = TimeSpan.FromMinutes(1) }));
});

var origins = config.GetSection("Cors:Origins").Get<string[]>() ?? [];
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(o =>
{
    o.AddSecurityDefinition("Bearer", new() { Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http, Scheme = "bearer", BearerFormat = "JWT" });
    o.AddSecurityRequirement(new()
    {
        [new Microsoft.OpenApi.Models.OpenApiSecurityScheme { Reference = new() { Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme, Id = "Bearer" } }] = [],
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
    if (config.GetValue("Seed:Enabled", true))
        await SeedData.SeedAsync(db, scope.ServiceProvider.GetRequiredService<IPasswordHasher<AdminUser>>());
}

app.UseForwardedHeaders();
app.UseMiddleware<ErrorHandlingMiddleware>();
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<StoreHub>("/hubs/store");
app.MapGet("/healthz", () => Results.Ok(new { status = "ok" }));
app.MapFallbackToFile("index.html");

app.Run();

static string ToCamel(string key)
{
    var last = key.Split('.').Last().TrimStart('$');
    return last.Length == 0 ? key : char.ToLowerInvariant(last[0]) + last[1..];
}
