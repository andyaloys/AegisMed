using AegisMed.Core.Interfaces;
using AegisMed.Infrastructure.Data;
using AegisMed.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();

// Configure CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Configure PostgreSQL Connection
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? "Host=localhost;Database=aegismed_qms_pg;Username=postgres;Password=P@ssw0rd;";

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(
        connectionString,
        b => b.MigrationsAssembly("AegisMed.API")
    ));

// Register Services
builder.Services.AddScoped<IDashboardService, DashboardService>();

// Configure JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"] ?? "AegisMedNursQISecretKeyForJwtTokenAuth2026_SecureLongKey!";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "AegisMedAPI";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "AegisMedClients";

builder.Services.AddAuthentication(Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(jwtKey))
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

// Auto-migrate / auto-create database on startup
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<ApplicationDbContext>();
        context.Database.EnsureCreated();
        context.Database.ExecuteSqlRaw(@"
            ALTER TABLE ""EdCaseSubmissions"" ADD COLUMN IF NOT EXISTS ""Status"" integer NOT NULL DEFAULT 1;
            ALTER TABLE ""EdCaseSubmissions"" ADD COLUMN IF NOT EXISTS ""SubmittedById"" uuid NULL;
            ALTER TABLE ""EdCaseSubmissions"" ADD COLUMN IF NOT EXISTS ""SubmittedDate"" timestamp with time zone NULL;
            ALTER TABLE ""EdCaseSubmissions"" ADD COLUMN IF NOT EXISTS ""ApprovedById"" uuid NULL;
            ALTER TABLE ""EdCaseSubmissions"" ADD COLUMN IF NOT EXISTS ""ApprovedDate"" timestamp with time zone NULL;
            ALTER TABLE ""EdCaseSubmissions"" ADD COLUMN IF NOT EXISTS ""RejectionNotes"" text NULL;
        ");
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "An error occurred creating the DB.");
    }
}

// Configure the HTTP request pipeline.
app.UseCors("AllowAll");

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
