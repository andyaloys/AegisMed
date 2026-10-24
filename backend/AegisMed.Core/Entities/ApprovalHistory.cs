namespace AegisMed.Core.Entities;

/// <summary>
/// Tracks every approval/rejection action for audit trail purposes.
/// Polymorphic: can track NsiAudit or PdsaAction approval history.
/// </summary>
public class ApprovalHistory
{
    public Guid Id { get; set; }
    
    /// <summary>"NsiAudit" or "PdsaAction"</summary>
    public string EntityType { get; set; } = string.Empty;
    public Guid EntityId { get; set; }
    
    public string FromStatus { get; set; } = string.Empty;
    public string ToStatus { get; set; } = string.Empty;
    
    public Guid ActionById { get; set; }
    public AppUser? ActionBy { get; set; }
    public DateTime ActionDate { get; set; } = DateTime.UtcNow;
    public string Notes { get; set; } = string.Empty;
}
