namespace AegisMed.Core.Entities;

public class HospitalSite
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Region { get; set; } = string.Empty;
    
    // Navigation properties
    public ICollection<QualityAudit> Audits { get; set; } = new List<QualityAudit>();
    public ICollection<CapaAction> CapaActions { get; set; } = new List<CapaAction>();
    public ICollection<QualityIndicator> QualityIndicators { get; set; } = new List<QualityIndicator>();
}
