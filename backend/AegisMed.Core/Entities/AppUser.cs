namespace AegisMed.Core.Entities;

/// <summary>
/// Application user for NursQI system with role-based access.
/// Users are bound to a HospitalSite, and optionally to a HospitalUnit.
/// </summary>
public class AppUser
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;  // BCrypt hashed
    
    public Guid RoleId { get; set; }
    public AppRole? Role { get; set; }
    
    public Guid HospitalSiteId { get; set; }
    public HospitalSite? HospitalSite { get; set; }
    
    /// <summary>
    /// Nullable — only for unit-level roles (PSQO, Kanit).
    /// Corporate roles (NQCorp, QRCorp) leave this null.
    /// </summary>
    public Guid? HospitalUnitId { get; set; }
    public HospitalUnit? HospitalUnit { get; set; }
    
    public bool IsActive { get; set; } = true;
    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginDate { get; set; }
}
