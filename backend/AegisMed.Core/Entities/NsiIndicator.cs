namespace AegisMed.Core.Entities;

/// <summary>
/// Nursing Sensitive Indicator definition.
/// Supports two measurement types: YesNo (checklist) and TimeBased (golden hour).
/// </summary>
public class NsiIndicator
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;           // e.g., "NSI-NCP", "NSI-SSC"
    
    public Guid CategoryId { get; set; }
    public NsiIndicatorCategory? Category { get; set; }
    
    /// <summary>"NSI" for nursing sensitive indicators, "ProjectImprovement" for ED time-based</summary>
    public string AuditType { get; set; } = "NSI";
    
    /// <summary>"YesNo" for checklist-based, "TimeBased" for golden hour indicators</summary>
    public string MeasurementType { get; set; } = "YesNo";
    
    /// <summary>Only for TimeBased indicators (e.g., 10 min for Door-to-ECG)</summary>
    public double? TargetMinutes { get; set; }
    
    /// <summary>Target compliance percentage (default 100%)</summary>
    public double TargetPercentage { get; set; } = 100.0;
    
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    
    // Navigation
    public ICollection<NsiAuditSubmission> AuditSubmissions { get; set; } = new List<NsiAuditSubmission>();
}
