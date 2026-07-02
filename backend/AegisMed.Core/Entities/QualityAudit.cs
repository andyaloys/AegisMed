namespace AegisMed.Core.Entities;

public enum AuditStatus
{
    Scheduled,
    InProgress,
    Completed,
    Cancelled
}

public class QualityAudit
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty; // e.g. Clinical, Facility, Safety
    public DateTime AuditDate { get; set; }
    public string Auditor { get; set; } = string.Empty;
    public double Score { get; set; } // Percentage e.g. 85.5
    public AuditStatus Status { get; set; }
    
    public Guid HospitalSiteId { get; set; }
    public HospitalSite? HospitalSite { get; set; }
}
