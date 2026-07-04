using System;

namespace AegisMed.Core.Entities;

public class EdCaseSubmission
{
    public Guid Id { get; set; }
    public string EmrNumber { get; set; } = string.Empty;
    public string PatientInitials { get; set; } = string.Empty;
    public string SubmissionMonth { get; set; } = string.Empty; // Format: "YYYY-MM"
    
    public Guid EdIndicatorId { get; set; }
    public EdIndicator? EdIndicator { get; set; }
    
    public DateTime DoorTime { get; set; } // Arrival time
    public DateTime EventTime { get; set; } // Action completion time
    
    public double MinutesElapsed { get; set; } // Auto-calculated
    public bool IsCompliant { get; set; } // Auto-calculated
    
    public string ClinicalNotes { get; set; } = string.Empty;
    public string CustomFieldsJson { get; set; } = "{}";
    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    public string CreatedBy { get; set; } = "System";

    public Guid HospitalSiteId { get; set; }
    public HospitalSite? HospitalSite { get; set; }

    public bool IsClosed { get; set; } = false;
}
