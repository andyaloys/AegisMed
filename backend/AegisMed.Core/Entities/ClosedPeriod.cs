using System;

namespace AegisMed.Core.Entities;

public class ClosedPeriod
{
    public Guid Id { get; set; }
    public Guid HospitalSiteId { get; set; }
    public HospitalSite? HospitalSite { get; set; }
    public string Month { get; set; } = string.Empty; // Format: "YYYY-MM"
    public DateTime ClosedDate { get; set; } = DateTime.UtcNow;
    public string ClosedBy { get; set; } = "System";
}
