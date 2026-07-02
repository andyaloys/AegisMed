namespace AegisMed.Core.Entities;

public enum CapaStatus
{
    Open,
    InProgress,
    Resolved,
    Overdue
}

public enum CapaSeverity
{
    Low,
    Medium,
    High,
    Critical
}

public class CapaAction
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public CapaStatus Status { get; set; }
    public CapaSeverity Severity { get; set; }
    public DateTime CreatedDate { get; set; }
    public DateTime DueDate { get; set; }
    public DateTime? ResolvedDate { get; set; }
    public string AssignedTo { get; set; } = string.Empty;
    
    public Guid HospitalSiteId { get; set; }
    public HospitalSite? HospitalSite { get; set; }
}
