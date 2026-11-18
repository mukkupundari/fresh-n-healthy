FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY FreshMarket.Api/FreshMarket.Api.csproj FreshMarket.Api/
RUN dotnet restore FreshMarket.Api/FreshMarket.Api.csproj
COPY FreshMarket.Api/ FreshMarket.Api/
RUN dotnet publish FreshMarket.Api/FreshMarket.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "FreshMarket.Api.dll"]
