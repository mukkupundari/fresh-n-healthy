using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace FreshMarket.Api.Infrastructure;

public class ApiException(int status, string message, string code = "error", object? details = null) : Exception(message)
{
    public int Status { get; } = status;
    public string Code { get; } = code;
    public object? Details { get; } = details;

    public static ApiException NotFound(string what) => new(404, $"{what} not found.", "not_found");
    public static ApiException BadRequest(string message, string code = "bad_request") => new(400, message, code);
    public static ApiException Conflict(string message, string code = "conflict", object? details = null) => new(409, message, code, details);
    public static ApiException Forbidden(string message = "You do not have access to this resource.") => new(403, message, "forbidden");
}

public class ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task Invoke(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (ApiException ex)
        {
            await Write(context, ex.Status, ex.Message, ex.Code, ex.Details);
        }
        catch (DbUpdateConcurrencyException)
        {
            await Write(context, 409, "This record was changed by someone else. Please refresh and try again.", "concurrency");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled error for {Path}", context.Request.Path);
            await Write(context, 500, "Something went wrong on our side. Please try again.", "server_error");
        }
    }

    private static async Task Write(HttpContext context, int status, string title, string code, object? details = null)
    {
        if (context.Response.HasStarted) return;
        context.Response.Clear();
        context.Response.StatusCode = status;
        context.Response.ContentType = "application/problem+json";
        await context.Response.WriteAsync(JsonSerializer.Serialize(new { status, title, code, details }, Json));
    }
}
