namespace AegisMed.Core.Entities;

/// <summary>
/// Individual audit item within an NSI audit submission.
/// Each item represents one patient record being audited.
/// </summary>
public class NsiAuditItem
{
    public Guid Id { get; set; }
    
    public Guid SubmissionId { get; set; }
    public NsiAuditSubmission? Submission { get; set; }
    
    public int ItemNumber { get; set; }                            // Sequential number
    public string PatientIdentifier { get; set; } = string.Empty;  // EMR number or patient initials
    public bool IsCompliant { get; set; }                          // Ya = true, Tidak = false
    public string Notes { get; set; } = string.Empty;
    
    // Optional fields for TimeBased indicators (reusable for Project Improvement IGD)
    public DateTime? DoorTime { get; set; }
    public DateTime? EventTime { get; set; }
    public double? MinutesElapsed { get; set; }
    
    /// <summary>Additional custom fields as JSON</summary>
    public string CustomFieldsJson { get; set; } = "{}";
}
