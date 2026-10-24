namespace AegisMed.Core.Entities;

public class HospitalSite
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Region { get; set; } = string.Empty;
    
    // Navigation properties
    public ICollection<CapaAction> CapaActions { get; set; } = new List<CapaAction>();
    public ICollection<HospitalUnit> Units { get; set; } = new List<HospitalUnit>();
    public ICollection<AppUser> Users { get; set; } = new List<AppUser>();
}
