# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy csproj files and restore dependencies
COPY ["AegisMed.API/AegisMed.API.csproj", "AegisMed.API/"]
COPY ["AegisMed.Core/AegisMed.Core.csproj", "AegisMed.Core/"]
COPY ["AegisMed.Infrastructure/AegisMed.Infrastructure.csproj", "AegisMed.Infrastructure/"]
RUN dotnet restore "AegisMed.API/AegisMed.API.csproj"

# Copy all source files
COPY . .
WORKDIR "/src/AegisMed.API"
RUN dotnet build "AegisMed.API.csproj" -c Release -o /app/build

# Stage 2: Publish
FROM build AS publish
RUN dotnet publish "AegisMed.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 3: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
COPY --from=publish /app/publish .

# Render default port forwarding uses PORT env, but .NET 9 default is 8080
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "AegisMed.API.dll"]
