namespace AegisMed.Core.Entities;

public class QualityIndicator
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty; // e.g. Clinical, Patient Safety, Service
    public string Month { get; set; } = string.Empty; // e.g. "2026-05", "2026-06"
    public double Value { get; set; }
    public double Target { get; set; }
    public string Unit { get; set; } = string.Empty; // e.g. "%", "Minutes", "Cases"
    
    public Guid HospitalSiteId { get; set; }
    public HospitalSite? HospitalSite { get; set; }
}
