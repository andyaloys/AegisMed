namespace AegisMed.Core.Entities;

public enum PdsaStatus
{
    Draft,
    Submitted,
    Verified,
    Revised
}

/// <summary>
/// PDSA (Plan-Do-Study-Act) action for monthly analysis and follow-up
/// when an indicator does not meet the target.
/// Created by Kepala Unit, verified by Kadept NQ.
/// </summary>
public class PdsaAction
{
    public Guid Id { get; set; }
    
    public Guid HospitalUnitId { get; set; }
    public HospitalUnit? HospitalUnit { get; set; }
    
    public Guid NsiIndicatorId { get; set; }
    public NsiIndicator? NsiIndicator { get; set; }
    
    public string Month { get; set; } = string.Empty;  // Format: "YYYY-MM"
    
    // Achievement data
    public double AchievementRate { get; set; }
    public int Numerator { get; set; }
    public int Denominator { get; set; }
    
    // PDSA fields
    public string RootCauseAnalysis { get; set; } = string.Empty;   // Analisa penyebab ketidaktercapaian
    public string ImprovementPlan { get; set; } = string.Empty;     // Rencana perbaikan
    public string PIC { get; set; } = string.Empty;                 // Penanggung jawab
    public DateTime? TargetDate { get; set; }                       // Target waktu penyelesaian
    
    // Workflow
    public PdsaStatus Status { get; set; } = PdsaStatus.Draft;
    
    public Guid? CreatedById { get; set; }
    public AppUser? CreatedBy { get; set; }
    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    
    public Guid? VerifiedById { get; set; }
    public AppUser? VerifiedBy { get; set; }
    public DateTime? VerifiedDate { get; set; }
    public string? RevisionNotes { get; set; }
}
