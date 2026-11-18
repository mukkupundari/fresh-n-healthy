using System.Net.Http.Headers;
using System.Text;
using System.Threading.Channels;
using FreshMarket.Api.Infrastructure;
using Microsoft.Extensions.Options;

namespace FreshMarket.Api.Services;

public interface ISmsSender
{
    /// <param name="phone">10-digit Indian mobile number without the country code.</param>
    Task SendAsync(string phone, string message, CancellationToken ct = default);
}

/// <summary>Development sender that writes messages to the log.</summary>
public class LoggingSmsSender(ILogger<LoggingSmsSender> logger) : ISmsSender
{
    public Task SendAsync(string phone, string message, CancellationToken ct = default)
    {
        logger.LogInformation("SMS to {Phone}:\n{Message}", phone, message);
        return Task.CompletedTask;
    }
}

/// <summary>Fast2SMS "Quick SMS" API (India). Needs Sms:Fast2Sms:ApiKey from the Fast2SMS dashboard.</summary>
public class Fast2SmsSender(HttpClient http, IOptions<SmsOptions> options) : ISmsSender
{
    public async Task SendAsync(string phone, string message, CancellationToken ct = default)
    {
        var opt = options.Value.Fast2Sms;
        using var req = new HttpRequestMessage(HttpMethod.Post, "https://www.fast2sms.com/dev/bulkV2")
        {
            Content = JsonContent.Create(new { route = opt.Route, message, language = "english", flash = 0, numbers = phone }),
        };
        req.Headers.TryAddWithoutValidation("authorization", opt.ApiKey);
        using var res = await http.SendAsync(req, ct);
        if (!res.IsSuccessStatusCode)
            throw new HttpRequestException($"Fast2SMS returned {(int)res.StatusCode}: {await res.Content.ReadAsStringAsync(ct)}");
    }
}

/// <summary>Twilio Programmable Messaging. Needs Sms:Twilio:AccountSid, AuthToken and FromNumber.</summary>
public class TwilioSmsSender(HttpClient http, IOptions<SmsOptions> options) : ISmsSender
{
    public async Task SendAsync(string phone, string message, CancellationToken ct = default)
    {
        var opt = options.Value.Twilio;
        using var req = new HttpRequestMessage(HttpMethod.Post, $"https://api.twilio.com/2010-04-01/Accounts/{opt.AccountSid}/Messages.json")
        {
            Content = new FormUrlEncodedContent(new Dictionary<string, string> { ["To"] = "+91" + phone, ["From"] = opt.FromNumber, ["Body"] = message }),
        };
        req.Headers.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(Encoding.ASCII.GetBytes($"{opt.AccountSid}:{opt.AuthToken}")));
        using var res = await http.SendAsync(req, ct);
        if (!res.IsSuccessStatusCode)
            throw new HttpRequestException($"Twilio returned {(int)res.StatusCode}: {await res.Content.ReadAsStringAsync(ct)}");
    }
}

public static class SmsRegistration
{
    public static IServiceCollection AddSms(this IServiceCollection services, IConfiguration config)
    {
        services.Configure<SmsOptions>(config.GetSection("Sms"));
        var provider = config.GetValue("Sms:Provider", "Log")!;
        switch (provider.ToLowerInvariant())
        {
            case "fast2sms":
                services.AddHttpClient<ISmsSender, Fast2SmsSender>(c => c.Timeout = TimeSpan.FromSeconds(15));
                break;
            case "twilio":
                services.AddHttpClient<ISmsSender, TwilioSmsSender>(c => c.Timeout = TimeSpan.FromSeconds(15));
                break;
            case "log":
                services.AddSingleton<ISmsSender, LoggingSmsSender>();
                break;
            default:
                throw new InvalidOperationException($"Unknown Sms:Provider '{provider}'. Use Log, Fast2Sms or Twilio.");
        }
        services.AddSingleton<SmsQueue>();
        services.AddHostedService<SmsDispatcher>();
        return services;
    }
}

/// <summary>Messages that should not hold up the request that triggered them (invoices, notifications).</summary>
public class SmsQueue
{
    private readonly Channel<(string Phone, string Message)> _channel = Channel.CreateBounded<(string, string)>(
        new BoundedChannelOptions(1000) { FullMode = BoundedChannelFullMode.DropOldest });

    public void Enqueue(string phone, string message) => _channel.Writer.TryWrite((phone, message));
    public IAsyncEnumerable<(string Phone, string Message)> ReadAllAsync(CancellationToken ct) => _channel.Reader.ReadAllAsync(ct);
}

public class SmsDispatcher(SmsQueue queue, IServiceScopeFactory scopes, ILogger<SmsDispatcher> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var (phone, message) in queue.ReadAllAsync(stoppingToken))
        {
            for (var attempt = 1; attempt <= 3; attempt++)
            {
                try
                {
                    using var scope = scopes.CreateScope();
                    await scope.ServiceProvider.GetRequiredService<ISmsSender>().SendAsync(phone, message, stoppingToken);
                    break;
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    logger.LogWarning(ex, "SMS to {Phone} failed (attempt {Attempt}/3)", phone, attempt);
                    if (attempt < 3) await Task.Delay(TimeSpan.FromSeconds(5 * attempt), stoppingToken);
                }
            }
        }
    }
}
