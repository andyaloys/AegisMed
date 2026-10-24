namespace AegisMed.Core.Entities;

public enum AuditStatus
{
    Draft,
    Submitted,
    ApprovedL1,   // PSQO/PJ Shift approved
    ApprovedL2,   // Kepala Unit approved
    ApprovedL3,   // Kadept NQ approved
    Verified,     // NQ Corporate verified
    Rejected
}

/// <summary>
/// An NSI audit submission for a specific indicator in a specific unit/month.
/// Contains multiple NsiAuditItems (individual patient audits).
/// </summary>
public class NsiAuditSubmission
{
    public Guid Id { get; set; }
    
    public Guid HospitalUnitId { get; set; }
    public HospitalUnit? HospitalUnit { get; set; }
    
    public Guid NsiIndicatorId { get; set; }
    public NsiIndicator? NsiIndicator { get; set; }
    
    public string SubmissionMonth { get; set; } = string.Empty;  // Format: "YYYY-MM"
    public DateTime AuditDate { get; set; }
    
    // Calculated fields
    public int Denominator { get; set; }      // Total items (Ya + Tidak)
    public int Numerator { get; set; }        // Total "Ya" items
    public double AchievementRate { get; set; } // Numerator / Denominator * 100
    
    // Workflow
    public AuditStatus Status { get; set; } = AuditStatus.Draft;
    
    public Guid? SubmittedById { get; set; }
    public AppUser? SubmittedBy { get; set; }
    public DateTime? SubmittedDate { get; set; }
    
    public Guid? ApprovedById { get; set; }
    public AppUser? ApprovedBy { get; set; }
    public DateTime? ApprovedDate { get; set; }
    public string? RejectionNotes { get; set; }
    
    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    
    // Navigation
    public ICollection<NsiAuditItem> Items { get; set; } = new List<NsiAuditItem>();
}
