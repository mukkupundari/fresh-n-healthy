namespace FreshMarket.Api.Infrastructure;

public class JwtOptions
{
    public string Issuer { get; set; } = "FreshMarket";
    public string Audience { get; set; } = "FreshMarket";
    public string SigningKey { get; set; } = "";
    public int AccessTokenMinutes { get; set; } = 30;
    public int AdminRefreshDays { get; set; } = 7;
    public int CustomerRefreshDays { get; set; } = 90;
}

public class OtpOptions
{
    /// <summary>When true the OTP is returned in the API response so it can be shown in the UI. Never enable in production.</summary>
    public bool DevMode { get; set; }
    public int ExpiryMinutes { get; set; } = 5;
    public int MaxAttempts { get; set; } = 5;
    public string Pepper { get; set; } = "";
}

public class SmsOptions
{
    /// <summary>"Log" (development: messages go to the API log), "Fast2Sms" or "Twilio".</summary>
    public string Provider { get; set; } = "Log";
    public Fast2SmsOptions Fast2Sms { get; set; } = new();
    public TwilioOptions Twilio { get; set; } = new();
}

public class Fast2SmsOptions
{
    public string ApiKey { get; set; } = "";
    public string Route { get; set; } = "q";
}

public class TwilioOptions
{
    public string AccountSid { get; set; } = "";
    public string AuthToken { get; set; } = "";
    /// <summary>Twilio sender number in E.164 format, e.g. +15005550006.</summary>
    public string FromNumber { get; set; } = "";
}

public class AppOptions
{
    /// <summary>Public URL of the web app, used for links inside SMS messages. Leave empty to omit links.</summary>
    public string PublicUrl { get; set; } = "";
}

public class StorageOptions
{
    public string Provider { get; set; } = "Local";
    public string LocalRoot { get; set; } = "wwwroot/uploads";
    public string PublicBasePath { get; set; } = "/uploads";
    public long MaxBytes { get; set; } = 5 * 1024 * 1024;
}
