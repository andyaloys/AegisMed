namespace AegisMed.Core.Entities;

/// <summary>
/// Category grouping for NSI indicators.
/// E.g., "Kelengkapan Rekam Medis", "Kepatuhan Edukasi", etc.
/// </summary>
public class NsiIndicatorCategory
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    
    // Navigation
    public ICollection<NsiIndicator> Indicators { get; set; } = new List<NsiIndicator>();
}
