using AegisMed.Core.DTOs;
using AegisMed.Core.Entities;
using AegisMed.Core.Interfaces;
using AegisMed.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace AegisMed.Infrastructure.Services;

public class DashboardService : IDashboardService
{
    private readonly ApplicationDbContext _context;

    public DashboardService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<DashboardDto> GetDashboardDataAsync(Guid? siteId, System.DateTime? startDate, System.DateTime? endDate)
    {
        var auditQuery = _context.QualityAudits.Include(a => a.HospitalSite).AsQueryable();
        var capaQuery = _context.CapaActions.Include(c => c.HospitalSite).AsQueryable();
        var indicatorQuery = _context.QualityIndicators.Include(i => i.HospitalSite).AsQueryable();
        var edSubmissionQuery = _context.EdCaseSubmissions.Include(e => e.HospitalSite).AsQueryable();

        if (siteId.HasValue)
        {
            auditQuery = auditQuery.Where(a => a.HospitalSiteId == siteId.Value);
            capaQuery = capaQuery.Where(c => c.HospitalSiteId == siteId.Value);
            indicatorQuery = indicatorQuery.Where(i => i.HospitalSiteId == siteId.Value);
            edSubmissionQuery = edSubmissionQuery.Where(e => e.HospitalSiteId == siteId.Value);
        }

        if (startDate.HasValue)
        {
            var start = startDate.Value.Date;
            auditQuery = auditQuery.Where(a => a.AuditDate >= start);
            capaQuery = capaQuery.Where(c => c.CreatedDate >= start);
            edSubmissionQuery = edSubmissionQuery.Where(e => e.DoorTime >= start);
            
            var startMonthStr = start.ToString("yyyy-MM");
            indicatorQuery = indicatorQuery.Where(i => string.Compare(i.Month, startMonthStr) >= 0);
        }

        if (endDate.HasValue)
        {
            var end = endDate.Value.Date.AddDays(1).AddTicks(-1);
            auditQuery = auditQuery.Where(a => a.AuditDate <= end);
            capaQuery = capaQuery.Where(c => c.CreatedDate <= end);
            edSubmissionQuery = edSubmissionQuery.Where(e => e.DoorTime <= end);

            var endMonthStr = end.ToString("yyyy-MM");
            indicatorQuery = indicatorQuery.Where(i => string.Compare(i.Month, endMonthStr) <= 0);
        }

        var audits = await auditQuery.ToListAsync();
        var capas = await capaQuery.ToListAsync();
        var indicators = await indicatorQuery.ToListAsync();
        var edSubmissions = await edSubmissionQuery.ToListAsync();
        var sites = await _context.HospitalSites.ToListAsync();

        var dashboard = new DashboardDto();

        // 1. Summary Metrics
        var completedAudits = audits.Where(a => a.Status == AuditStatus.Completed).ToList();
        dashboard.Summary = new SummaryMetrics
        {
            TotalAudits = audits.Count,
            AverageAuditScore = completedAudits.Any() ? Math.Round(completedAudits.Average(a => a.Score), 1) : 0,
            TotalCapa = capas.Count,
            OpenCapa = capas.Count(c => c.Status == CapaStatus.Open),
            InProgressCapa = capas.Count(c => c.Status == CapaStatus.InProgress),
            OverdueCapa = capas.Count(c => c.Status == CapaStatus.Overdue),
            ResolvedCapa = capas.Count(c => c.Status == CapaStatus.Resolved),
            CriticalIssues = capas.Count(c => c.Severity == CapaSeverity.Critical && c.Status != CapaStatus.Resolved)
        };

        // 2. Site Compliance
        foreach (var site in sites)
        {
            var siteAudits = audits.Where(a => a.HospitalSiteId == site.Id).ToList();
            var siteCompletedAudits = siteAudits.Where(a => a.Status == AuditStatus.Completed).ToList();
            var siteCapas = capas.Where(c => c.HospitalSiteId == site.Id).ToList();

            var avgScore = siteCompletedAudits.Any() ? Math.Round(siteCompletedAudits.Average(a => a.Score), 1) : 0;
            
            dashboard.SiteCompliance.Add(new SiteComplianceDto
            {
                SiteId = site.Id,
                SiteName = site.Name,
                SiteCode = site.Code,
                AverageScore = avgScore,
                AuditsCount = siteAudits.Count,
                OpenCapaCount = siteCapas.Count(c => c.Status != CapaStatus.Resolved),
                ComplianceRate = avgScore // Using average score as compliance rate for simplicity
            });
        }

        // 3. CAPA Breakdown by Status
        var statusGroups = capas.GroupBy(c => c.Status);
        foreach (var group in statusGroups)
        {
            dashboard.CapaBreakdown.Add(new CapaStatusBreakdown
            {
                Status = group.Key.ToString(),
                Count = group.Count()
            });
        }

        // 4. Recent Audits (Top 5)
        dashboard.RecentAudits = audits
            .OrderByDescending(a => a.AuditDate)
            .Take(5)
            .Select(a => new RecentAuditDto
            {
                Id = a.Id,
                Title = a.Title,
                SiteName = a.HospitalSite?.Name ?? "Unknown",
                AuditDate = a.AuditDate,
                Score = a.Score,
                Status = a.Status.ToString()
            })
            .ToList();

        // 5. Recent CAPAs (Top 5)
        dashboard.RecentCapas = capas
            .OrderByDescending(c => c.CreatedDate)
            .Take(5)
            .Select(c => new RecentCapaDto
            {
                Id = c.Id,
                Title = c.Title,
                SiteName = c.HospitalSite?.Name ?? "Unknown",
                DueDate = c.DueDate,
                Severity = c.Severity.ToString(),
                Status = c.Status.ToString()
            })
            .ToList();

        // 6. Key Indicators
        dashboard.KeyIndicators = indicators
            .Select(i => {
                string status = "On Target";
                
                // For safety metrics (like Infection Rate, Fall Incidents), lower than target is good.
                // For positive compliance (like Hand Hygiene), higher than target is good.
                if (i.Name.Contains("Infection") || i.Name.Contains("Fall") || i.Name.Contains("Errors"))
                {
                    status = i.Value <= i.Target ? "On Target" : "Below Target";
                }
                else
                {
                    status = i.Value >= i.Target ? "On Target" : "Below Target";
                }

                return new IndicatorSummaryDto
                {
                    Name = i.Name,
                    Category = i.Category,
                    CurrentValue = i.Value,
                    Target = i.Target,
                    Unit = i.Unit,
                    PerformanceStatus = status
                };
            })
            .ToList();

        // 7. ED Indicators Compliance (Golden Hour Initiative)
        var edIndicators = await _context.EdIndicators.ToListAsync();
        foreach (var indicator in edIndicators)
        {
            var typeSubmissions = edSubmissions.Where(e => e.EdIndicatorId == indicator.Id).ToList();
            var total = typeSubmissions.Count;
            var compliant = typeSubmissions.Count(e => e.IsCompliant);
            var rate = total > 0 ? Math.Round(((double)compliant / total) * 100, 1) : 100.0;

            dashboard.EdCompliance.Add(new EdIndicatorComplianceDto
            {
                IndicatorName = indicator.Name,
                Category = indicator.Category,
                TotalCases = total,
                CompliantCases = compliant,
                ComplianceRate = rate,
                TargetDescription = indicator.TargetDescription
            });
        }

        // 8. Dynamic UGD Indicators List DTO
        dashboard.EdIndicators = edIndicators.Select(i => new EdIndicatorDto
        {
            Id = i.Id,
            Name = i.Name,
            TargetDescription = i.TargetDescription,
            TargetMinutes = i.TargetMinutes
        }).ToList();

        return dashboard;
    }
}
