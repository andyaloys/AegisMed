namespace AegisMed.Core.Entities;

/// <summary>
/// Application role defining access level and permissions in the NursQI system.
/// Hierarchy: PSQO(1) → Kanit(2) → KadeptNQ(3) → NQCorp(4)
/// </summary>
public class AppRole
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;         // "PSQO", "Kanit", "KadeptNQ", "NQCorp", "QRUnit", "QRCorp", "Admin"
    public string DisplayName { get; set; } = string.Empty;  // "PSQO / PJ Shift", "Kepala Unit", etc.
    public string Scope { get; set; } = string.Empty;        // "Unit", "Hospital", "Corporate"
    public int Level { get; set; }                            // 1=PSQO, 2=Kanit, 3=KadeptNQ, 4=NQCorp (approval chain order)
    
    /// <summary>
    /// JSON string of permission flags, e.g.:
    /// {"canInputAudit":true,"canApprove":true,"canCreatePdsa":false,...}
    /// </summary>
    public string PermissionsJson { get; set; } = "{}";
    
    // Navigation
    public ICollection<AppUser> Users { get; set; } = new List<AppUser>();
}
