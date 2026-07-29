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
        var capaQuery = _context.CapaActions.Include(c => c.HospitalSite).AsQueryable();
        var edSubmissionQuery = _context.EdCaseSubmissions.Include(e => e.HospitalSite).AsQueryable();

        if (siteId.HasValue)
        {
            capaQuery = capaQuery.Where(c => c.HospitalSiteId == siteId.Value);
            edSubmissionQuery = edSubmissionQuery.Where(e => e.HospitalSiteId == siteId.Value);
        }

        if (startDate.HasValue)
        {
            var start = startDate.Value.Date;
            var startMonthStr = startDate.Value.ToString("yyyy-MM");
            capaQuery = capaQuery.Where(c => 
                (!string.IsNullOrEmpty(c.SubmissionMonth) && string.Compare(c.SubmissionMonth, startMonthStr) >= 0) ||
                (string.IsNullOrEmpty(c.SubmissionMonth) && c.CreatedDate >= start)
            );
            edSubmissionQuery = edSubmissionQuery.Where(e => e.DoorTime >= start);
        }

        if (endDate.HasValue)
        {
            var end = new System.DateTime(endDate.Value.Year, endDate.Value.Month, 1).AddMonths(1).AddTicks(-1);
            var endMonthStr = endDate.Value.ToString("yyyy-MM");
            capaQuery = capaQuery.Where(c => 
                (!string.IsNullOrEmpty(c.SubmissionMonth) && string.Compare(c.SubmissionMonth, endMonthStr) <= 0) ||
                (string.IsNullOrEmpty(c.SubmissionMonth) && c.CreatedDate <= end)
            );
            edSubmissionQuery = edSubmissionQuery.Where(e => e.DoorTime <= end);
        }

        var capas = await capaQuery.ToListAsync();
        var edSubmissions = await edSubmissionQuery.ToListAsync();
        var sites = await _context.HospitalSites.ToListAsync();

        var dashboard = new DashboardDto();

        // 1. Summary Metrics
        dashboard.Summary = new SummaryMetrics
        {
            TotalAudits = edSubmissions.Count,
            AverageAuditScore = edSubmissions.Any() ? Math.Round(((double)edSubmissions.Count(e => e.IsCompliant) / edSubmissions.Count) * 100, 1) : 100.0,
            TotalCapa = capas.Count,
            OpenCapa = capas.Count(c => c.Status == CapaStatus.Open),
            InProgressCapa = capas.Count(c => c.Status == CapaStatus.InProgress),
            OverdueCapa = capas.Count(c => c.Status == CapaStatus.Overdue),
            ResolvedCapa = capas.Count(c => c.Status == CapaStatus.Resolved),
            CriticalIssues = capas.Count(c => c.Severity == CapaSeverity.Critical && c.Status != CapaStatus.Resolved)
        };

        // 2. Site Compliance (calculated from UGD Cases/EdCaseSubmissions compliance rate)
        foreach (var site in sites)
        {
            var siteSubmissions = edSubmissions.Where(e => e.HospitalSiteId == site.Id).ToList();
            var siteCapas = capas.Where(c => c.HospitalSiteId == site.Id).ToList();

            var complianceRate = siteSubmissions.Any() 
                ? Math.Round(((double)siteSubmissions.Count(e => e.IsCompliant) / siteSubmissions.Count) * 100, 1) 
                : 100.0;
            
            dashboard.SiteCompliance.Add(new SiteComplianceDto
            {
                SiteId = site.Id,
                SiteName = site.Name,
                SiteCode = site.Code,
                AverageScore = complianceRate,
                AuditsCount = siteSubmissions.Count,
                OpenCapaCount = siteCapas.Count(c => c.Status != CapaStatus.Resolved),
                ComplianceRate = complianceRate
            });
        }

        // 3. Recent CAPAs (Top 5)
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

        // 4. ED Indicators Compliance (Golden Hour Initiative)
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

        // 5. Dynamic UGD Indicators List DTO
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
