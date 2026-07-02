using AegisMed.Core.Entities;
using System;
using System.Collections.Generic;

namespace AegisMed.Core.DTOs;

public class DashboardDto
{
    public SummaryMetrics Summary { get; set; } = new();
    public List<SiteComplianceDto> SiteCompliance { get; set; } = new();
    public List<CapaStatusBreakdown> CapaBreakdown { get; set; } = new();
    public List<RecentAuditDto> RecentAudits { get; set; } = new();
    public List<RecentCapaDto> RecentCapas { get; set; } = new();
    public List<IndicatorSummaryDto> KeyIndicators { get; set; } = new();
    public List<EdIndicatorComplianceDto> EdCompliance { get; set; } = new();
    public List<EdIndicatorDto> EdIndicators { get; set; } = new();
}

public class EdIndicatorDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string TargetDescription { get; set; } = string.Empty;
    public double TargetMinutes { get; set; }
}

public class EdIndicatorComplianceDto
{
    public string IndicatorName { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public int TotalCases { get; set; }
    public int CompliantCases { get; set; }
    public double ComplianceRate { get; set; }
    public string TargetDescription { get; set; } = string.Empty;
}

public class SummaryMetrics
{
    public int TotalAudits { get; set; }
    public double AverageAuditScore { get; set; }
    public int TotalCapa { get; set; }
    public int OpenCapa { get; set; }
    public int OverdueCapa { get; set; }
    public int InProgressCapa { get; set; }
    public int ResolvedCapa { get; set; }
    public int CriticalIssues { get; set; } // CAPAs with Critical severity that are not resolved
}

public class SiteComplianceDto
{
    public Guid SiteId { get; set; }
    public string SiteName { get; set; } = string.Empty;
    public string SiteCode { get; set; } = string.Empty;
    public double AverageScore { get; set; }
    public int AuditsCount { get; set; }
    public int OpenCapaCount { get; set; }
    public double ComplianceRate { get; set; } // Percentage of audits completed successfully
}

public class CapaStatusBreakdown
{
    public string Status { get; set; } = string.Empty;
    public int Count { get; set; }
    public string Severity { get; set; } = string.Empty;
}

public class RecentAuditDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string SiteName { get; set; } = string.Empty;
    public DateTime AuditDate { get; set; }
    public double Score { get; set; }
    public string Status { get; set; } = string.Empty;
}

public class RecentCapaDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string SiteName { get; set; } = string.Empty;
    public DateTime DueDate { get; set; }
    public string Severity { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
}

public class IndicatorSummaryDto
{
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public double CurrentValue { get; set; }
    public double Target { get; set; }
    public string Unit { get; set; } = string.Empty;
    public string PerformanceStatus { get; set; } = string.Empty; // e.g. "On Target", "Below Target"
}
