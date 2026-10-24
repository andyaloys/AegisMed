using AegisMed.Core.Entities;
using AegisMed.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AegisMed.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public UsersController(ApplicationDbContext context)
    {
        _context = context;
    }

    public class CreateUserDto
    {
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public Guid RoleId { get; set; }
        public Guid HospitalSiteId { get; set; }
        public Guid? HospitalUnitId { get; set; }
    }

    public class UpdateUserDto
    {
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public Guid RoleId { get; set; }
        public Guid HospitalSiteId { get; set; }
        public Guid? HospitalUnitId { get; set; }
        public bool IsActive { get; set; } = true;
    }

    public class ResetPasswordDto
    {
        public string NewPassword { get; set; } = string.Empty;
    }

    [HttpGet]
    public async Task<IActionResult> GetUsers([FromQuery] Guid? siteId, [FromQuery] Guid? roleId, [FromQuery] string? search)
    {
        var query = _context.AppUsers
            .Include(u => u.Role)
            .Include(u => u.HospitalSite)
            .Include(u => u.HospitalUnit)
            .AsQueryable();

        if (siteId.HasValue) query = query.Where(u => u.HospitalSiteId == siteId.Value);
        if (roleId.HasValue) query = query.Where(u => u.RoleId == roleId.Value);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(u => u.FullName.ToLower().Contains(s) || u.Username.ToLower().Contains(s) || u.Email.ToLower().Contains(s));
        }

        var users = await query
            .OrderBy(u => u.FullName)
            .Select(u => new
            {
                u.Id,
                u.FullName,
                u.Email,
                u.Username,
                u.RoleId,
                RoleName = u.Role != null ? u.Role.Name : "",
                RoleDisplayName = u.Role != null ? u.Role.DisplayName : "",
                RoleScope = u.Role != null ? u.Role.Scope : "",
                RoleLevel = u.Role != null ? u.Role.Level : 0,
                u.HospitalSiteId,
                HospitalSiteName = u.HospitalSite != null ? u.HospitalSite.Name : "",
                HospitalSiteCode = u.HospitalSite != null ? u.HospitalSite.Code : "",
                u.HospitalUnitId,
                HospitalUnitName = u.HospitalUnit != null ? u.HospitalUnit.Name : null,
                HospitalUnitCode = u.HospitalUnit != null ? u.HospitalUnit.Code : null,
                u.IsActive,
                u.CreatedDate,
                u.LastLoginDate
            })
            .ToListAsync();

        return Ok(users);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetUserById(Guid id)
    {
        var u = await _context.AppUsers
            .Include(u => u.Role)
            .Include(u => u.HospitalSite)
            .Include(u => u.HospitalUnit)
            .FirstOrDefaultAsync(u => u.Id == id);

        if (u == null) return NotFound(new { message = "User tidak ditemukan" });

        return Ok(new
        {
            u.Id,
            u.FullName,
            u.Email,
            u.Username,
            u.RoleId,
            RoleName = u.Role?.Name,
            RoleDisplayName = u.Role?.DisplayName,
            u.HospitalSiteId,
            HospitalSiteName = u.HospitalSite?.Name,
            u.HospitalUnitId,
            HospitalUnitName = u.HospitalUnit?.Name,
            u.IsActive,
            u.CreatedDate,
            u.LastLoginDate
        });
    }

    [HttpPost]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Username) || string.IsNullOrWhiteSpace(dto.Password))
            return BadRequest(new { message = "Username dan password wajib diisi." });

        if (await _context.AppUsers.AnyAsync(u => u.Username.ToLower() == dto.Username.Trim().ToLower()))
            return BadRequest(new { message = "Username sudah digunakan." });

        if (await _context.AppUsers.AnyAsync(u => u.Email.ToLower() == dto.Email.Trim().ToLower()))
            return BadRequest(new { message = "Email sudah digunakan." });

        var passwordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);

        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            FullName = dto.FullName.Trim(),
            Email = dto.Email.Trim(),
            Username = dto.Username.Trim(),
            PasswordHash = passwordHash,
            RoleId = dto.RoleId,
            HospitalSiteId = dto.HospitalSiteId,
            HospitalUnitId = dto.HospitalUnitId,
            IsActive = true,
            CreatedDate = DateTime.UtcNow
        };

        _context.AppUsers.Add(user);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetUserById), new { id = user.Id }, new { message = "User berhasil dibuat.", id = user.Id });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateUser(Guid id, [FromBody] UpdateUserDto dto)
    {
        var user = await _context.AppUsers.FindAsync(id);
        if (user == null) return NotFound(new { message = "User tidak ditemukan" });

        if (await _context.AppUsers.AnyAsync(u => u.Email.ToLower() == dto.Email.Trim().ToLower() && u.Id != id))
            return BadRequest(new { message = "Email sudah digunakan oleh user lain." });

        user.FullName = dto.FullName.Trim();
        user.Email = dto.Email.Trim();
        user.RoleId = dto.RoleId;
        user.HospitalSiteId = dto.HospitalSiteId;
        user.HospitalUnitId = dto.HospitalUnitId;
        user.IsActive = dto.IsActive;

        await _context.SaveChangesAsync();
        return Ok(new { message = "Data user berhasil diperbarui." });
    }

    [HttpPut("{id}/toggle-active")]
    public async Task<IActionResult> ToggleActive(Guid id)
    {
        var user = await _context.AppUsers.FindAsync(id);
        if (user == null) return NotFound(new { message = "User tidak ditemukan" });

        user.IsActive = !user.IsActive;
        await _context.SaveChangesAsync();

        return Ok(new { message = $"Status user berhasil diubah menjadi {(user.IsActive ? "Aktif" : "Non-Aktif")}.", isActive = user.IsActive });
    }

    [HttpPost("{id}/reset-password")]
    public async Task<IActionResult> ResetPassword(Guid id, [FromBody] ResetPasswordDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.NewPassword) || dto.NewPassword.Length < 6)
            return BadRequest(new { message = "Password minimal 6 karakter." });

        var user = await _context.AppUsers.FindAsync(id);
        if (user == null) return NotFound(new { message = "User tidak ditemukan" });

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Password user berhasil direset." });
    }

    [HttpGet("roles")]
    public async Task<IActionResult> GetRoles()
    {
        var roles = await _context.AppRoles
            .OrderBy(r => r.Level)
            .Select(r => new
            {
                r.Id,
                r.Name,
                r.DisplayName,
                r.Scope,
                r.Level,
                r.PermissionsJson
            })
            .ToListAsync();
        return Ok(roles);
    }

    [HttpGet("sites")]
    public async Task<IActionResult> GetSites()
    {
        var sites = await _context.HospitalSites
            .OrderBy(s => s.Name)
            .Select(s => new
            {
                s.Id,
                s.Name,
                s.Code,
                s.Region
            })
            .ToListAsync();
        return Ok(sites);
    }

    [HttpGet("units")]
    public async Task<IActionResult> GetUnits([FromQuery] Guid? siteId)
    {
        var query = _context.HospitalUnits.Where(u => u.IsActive);
        if (siteId.HasValue) query = query.Where(u => u.HospitalSiteId == siteId.Value);

        var units = await query
            .OrderBy(u => u.Name)
            .Select(u => new
            {
                u.Id,
                u.Name,
                u.Code,
                u.HospitalSiteId
            })
            .ToListAsync();
        return Ok(units);
    }
}
