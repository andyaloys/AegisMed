namespace AegisMed.Core.Entities;

/// <summary>
/// Represents a hospital unit within a hospital site (e.g., IGD, ICU, Rawat Inap).
/// Standard units are shared across all MH sites.
/// </summary>
public class HospitalUnit
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;    // "IGD", "ICU", "Rawat Inap", etc.
    public string Code { get; set; } = string.Empty;    // "IGD", "ICU", "RI"
    
    public Guid HospitalSiteId { get; set; }
    public HospitalSite? HospitalSite { get; set; }
    
    public bool IsActive { get; set; } = true;
    
    // Navigation properties
    public ICollection<NsiAuditSubmission> AuditSubmissions { get; set; } = new List<NsiAuditSubmission>();
}
