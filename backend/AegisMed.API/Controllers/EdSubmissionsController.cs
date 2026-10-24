using AegisMed.Core.Entities;
using AegisMed.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace AegisMed.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EdSubmissionsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public EdSubmissionsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetSubmissions(
        [FromQuery] string? siteId, 
        [FromQuery] string? month, 
        [FromQuery] Guid? indicatorId,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate)
    {
        Guid? parsedSiteId = null;
        if (!string.IsNullOrWhiteSpace(siteId) && Guid.TryParse(siteId, out var g))
        {
            parsedSiteId = g;
        }

        var query = _context.EdCaseSubmissions
            .Include(e => e.HospitalSite)
            .Include(e => e.SubmittedBy)
            .Include(e => e.ApprovedBy)
            .AsQueryable();

        if (parsedSiteId.HasValue)
            query = query.Where(e => e.HospitalSiteId == parsedSiteId.Value);

        if (startDate.HasValue)
            query = query.Where(e => e.DoorTime >= startDate.Value.Date);

        if (endDate.HasValue)
        {
            var end = new System.DateTime(endDate.Value.Year, endDate.Value.Month, 1).AddMonths(1).AddTicks(-1);
            query = query.Where(e => e.DoorTime <= end);
        }

        if (!startDate.HasValue && !endDate.HasValue && !string.IsNullOrEmpty(month))
            query = query.Where(e => e.SubmissionMonth == month);

        if (indicatorId.HasValue)
            query = query.Where(e => e.EdIndicatorId == indicatorId.Value);

        var list = await query.OrderByDescending(e => e.DoorTime).ToListAsync();
        
        // Fetch closed periods to determine locking status on the fly
        var distinctClosedPeriods = await _context.ClosedPeriods
            .Select(cp => new { cp.HospitalSiteId, cp.Month })
            .Distinct()
            .ToListAsync();

        var submissionIds = list.Select(x => x.Id).ToList();
        var allHistories = await _context.ApprovalHistories
            .Include(h => h.ActionBy)
            .Where(h => h.EntityType == "EdCase" && submissionIds.Contains(h.EntityId))
            .OrderBy(h => h.ActionDate)
            .Select(h => new
            {
                h.Id,
                h.EntityId,
                h.FromStatus,
                h.ToStatus,
                h.ActionById,
                ActionByName = h.ActionBy != null ? h.ActionBy.FullName : "",
                h.ActionDate,
                h.Notes
            })
            .ToListAsync();

        var result = list.Select(e => new {
            e.Id,
            e.EmrNumber,
            e.PatientInitials,
            e.SubmissionMonth,
            e.EdIndicatorId,
            e.DoorTime,
            e.EventTime,
            e.MinutesElapsed,
            e.IsCompliant,
            e.ClinicalNotes,
            e.CustomFieldsJson,
            e.HospitalSiteId,
            HospitalSiteName = e.HospitalSite?.Name ?? "",
            HospitalSiteCode = e.HospitalSite?.Code ?? "",
            Status = (int)e.Status,
            StatusText = e.Status.ToString(),
            e.SubmittedById,
            SubmittedByName = e.SubmittedBy != null ? e.SubmittedBy.FullName : e.CreatedBy,
            e.SubmittedDate,
            e.ApprovedById,
            ApprovedByName = e.ApprovedBy != null ? e.ApprovedBy.FullName : "",
            e.ApprovedDate,
            e.RejectionNotes,
            History = allHistories.Where(h => h.EntityId == e.Id).ToList(),
            IsClosed = distinctClosedPeriods.Any(cp => cp.HospitalSiteId == e.HospitalSiteId && cp.Month == e.SubmissionMonth)
        });

        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetSubmissionById(Guid id)
    {
        var submission = await _context.EdCaseSubmissions
            .Include(e => e.HospitalSite)
            .Include(e => e.EdIndicator)
            .Include(e => e.SubmittedBy)
            .Include(e => e.ApprovedBy)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (submission == null)
            return NotFound("Data kasus UGD tidak ditemukan.");

        var isLocked = await _context.ClosedPeriods.AnyAsync(cp => 
            cp.HospitalSiteId == submission.HospitalSiteId && 
            cp.Month == submission.SubmissionMonth);

        var history = await _context.ApprovalHistories
            .Include(h => h.ActionBy)
            .Where(h => h.EntityType == "EdCase" && h.EntityId == id)
            .OrderBy(h => h.ActionDate)
            .Select(h => new
            {
                h.Id,
                h.FromStatus,
                h.ToStatus,
                h.ActionById,
                ActionByName = h.ActionBy != null ? h.ActionBy.FullName : "",
                h.ActionDate,
                h.Notes
            })
            .ToListAsync();

        return Ok(new {
            submission.Id,
            submission.EmrNumber,
            submission.PatientInitials,
            submission.SubmissionMonth,
            submission.EdIndicatorId,
            submission.DoorTime,
            submission.EventTime,
            submission.MinutesElapsed,
            submission.IsCompliant,
            submission.ClinicalNotes,
            submission.CustomFieldsJson,
            submission.HospitalSiteId,
            HospitalSiteName = submission.HospitalSite?.Name ?? "",
            HospitalSiteCode = submission.HospitalSite?.Code ?? "",
            Status = (int)submission.Status,
            StatusText = submission.Status.ToString(),
            submission.SubmittedById,
            SubmittedByName = submission.SubmittedBy != null ? submission.SubmittedBy.FullName : submission.CreatedBy,
            submission.SubmittedDate,
            submission.ApprovedById,
            ApprovedByName = submission.ApprovedBy != null ? submission.ApprovedBy.FullName : "",
            submission.ApprovedDate,
            submission.RejectionNotes,
            History = history,
            IsClosed = isLocked
        });
    }

    [HttpPost]
    public async Task<IActionResult> CreateSubmission([FromBody] CreateEdSubmissionDto dto)
    {
        var isLocked = await _context.ClosedPeriods.AnyAsync(cp => 
            cp.HospitalSiteId == dto.HospitalSiteId && 
            cp.Month == dto.SubmissionMonth);

        if (isLocked)
        {
            return BadRequest("Periode penginputan untuk bulan ini di site terpilih sudah DITUTUP (locked) karena CAPA sudah digenerate.");
        }

        if (dto.EventTime < dto.DoorTime)
            return BadRequest("Waktu tindakan tidak boleh lebih awal dari waktu kedatangan (Door Time).");

        var siteExists = await _context.HospitalSites.AnyAsync(s => s.Id == dto.HospitalSiteId);
        if (!siteExists)
            return BadRequest("Rumah sakit (site) tidak valid.");

        var indicator = await _context.EdIndicators.FindAsync(dto.EdIndicatorId);
        if (indicator == null)
            return BadRequest("Indikator tidak valid.");

        double minutes = Math.Round((dto.EventTime - dto.DoorTime).TotalMinutes, 1);
        bool isCompliant = minutes <= indicator.TargetMinutes;

        var submission = new EdCaseSubmission
        {
            EmrNumber = dto.EmrNumber,
            PatientInitials = dto.PatientInitials,
            SubmissionMonth = dto.SubmissionMonth,
            EdIndicatorId = dto.EdIndicatorId,
            DoorTime = dto.DoorTime,
            EventTime = dto.EventTime,
            MinutesElapsed = minutes,
            IsCompliant = isCompliant,
            ClinicalNotes = dto.ClinicalNotes ?? string.Empty,
            CustomFieldsJson = dto.CustomFieldsJson ?? "{}",
            HospitalSiteId = dto.HospitalSiteId,
            CreatedDate = DateTime.UtcNow,
            CreatedBy = "UGD Staff",
            Status = AuditStatus.Submitted,
            SubmittedById = dto.SubmittedById,
            SubmittedDate = DateTime.UtcNow
        };

        _context.EdCaseSubmissions.Add(submission);

        if (dto.SubmittedById.HasValue && dto.SubmittedById.Value != Guid.Empty)
        {
            _context.ApprovalHistories.Add(new ApprovalHistory
            {
                Id = Guid.NewGuid(),
                EntityType = "EdCase",
                EntityId = submission.Id,
                FromStatus = "Draft",
                ToStatus = "Submitted",
                ActionById = dto.SubmittedById.Value,
                ActionDate = DateTime.UtcNow,
                Notes = "Data kasus UGD diinput dan diajukan ke antrean validasi"
            });
        }

        await _context.SaveChangesAsync();
        return Ok(submission);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateSubmission(Guid id, [FromBody] CreateEdSubmissionDto dto)
    {
        var submission = await _context.EdCaseSubmissions.FindAsync(id);
        if (submission == null)
            return NotFound("Data tidak ditemukan.");

        var isLocked = await _context.ClosedPeriods.AnyAsync(cp => 
            cp.HospitalSiteId == submission.HospitalSiteId && 
            cp.Month == submission.SubmissionMonth);

        if (isLocked)
        {
            return BadRequest("Data ini sudah ditutup (locked) karena CAPA untuk periode ini sudah digenerate. Data tidak dapat diubah.");
        }

        if (dto.EventTime < dto.DoorTime)
            return BadRequest("Waktu tindakan tidak boleh lebih awal dari waktu kedatangan.");

        var indicator = await _context.EdIndicators.FindAsync(submission.EdIndicatorId);
        if (indicator == null)
            return BadRequest("Indikator tidak valid.");

        double minutes = Math.Round((dto.EventTime - dto.DoorTime).TotalMinutes, 1);
        bool isCompliant = minutes <= indicator.TargetMinutes;

        submission.EmrNumber = dto.EmrNumber;
        submission.PatientInitials = dto.PatientInitials;
        submission.DoorTime = dto.DoorTime;
        submission.EventTime = dto.EventTime;
        submission.MinutesElapsed = minutes;
        submission.IsCompliant = isCompliant;
        submission.ClinicalNotes = dto.ClinicalNotes ?? string.Empty;
        submission.CustomFieldsJson = dto.CustomFieldsJson ?? "{}";
        submission.HospitalSiteId = dto.HospitalSiteId;

        await _context.SaveChangesAsync();
        return Ok(submission);
    }

    [HttpPost("{id}/workflow")]
    public async Task<IActionResult> ExecuteWorkflow(Guid id, [FromBody] EdWorkflowActionDto dto)
    {
        var submission = await _context.EdCaseSubmissions.FindAsync(id);
        if (submission == null) return NotFound(new { message = "Data kasus UGD tidak ditemukan." });

        var fromStatus = submission.Status;
        AuditStatus toStatus;
        var act = dto.Action.ToLower().Trim();

        // Validate user role permissions if ActionById is provided
        if (dto.ActionById != Guid.Empty)
        {
            var actingUser = await _context.AppUsers.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == dto.ActionById);
            if (actingUser != null && actingUser.Role != null)
            {
                var role = actingUser.Role.Name;
                bool isAdmin = role == "Admin";

                if (!isAdmin)
                {
                    if (act == "approve_l1" && role != "PSQO")
                    {
                        return StatusCode(403, new { message = $"Akses Ditolak: Hanya role PSQO yang berwenang melakukan Validasi L1. Role Anda saat ini adalah '{role}'." });
                    }
                    if (act == "approve_l2" && role != "Kanit")
                    {
                        return StatusCode(403, new { message = $"Akses Ditolak: Hanya role Kanit (Kepala Unit) yang berwenang melakukan Approval L2. Role Anda saat ini adalah '{role}'." });
                    }
                    if ((act == "approve_l3" || act == "verify") && role != "KadeptNQ")
                    {
                        return StatusCode(403, new { message = $"Akses Ditolak: Hanya role Kadept NQ yang berwenang melakukan Verifikasi Final. Role Anda saat ini adalah '{role}'." });
                    }
                }
            }
        }

        switch (act)
        {
            case "submit":
                toStatus = AuditStatus.Submitted;
                submission.SubmittedById = dto.ActionById;
                submission.SubmittedDate = DateTime.UtcNow;
                break;
            case "approve_l1":
                toStatus = AuditStatus.ApprovedL1;
                submission.ApprovedById = dto.ActionById;
                submission.ApprovedDate = DateTime.UtcNow;
                break;
            case "approve_l2":
                toStatus = AuditStatus.ApprovedL2;
                submission.ApprovedById = dto.ActionById;
                submission.ApprovedDate = DateTime.UtcNow;
                break;
            case "approve_l3":
            case "verify":
                toStatus = AuditStatus.Verified;
                submission.ApprovedById = dto.ActionById;
                submission.ApprovedDate = DateTime.UtcNow;
                break;
            case "reject":
                toStatus = AuditStatus.Rejected;
                submission.RejectionNotes = dto.Notes;
                break;
            case "reset":
                toStatus = AuditStatus.Submitted;
                submission.ApprovedById = null;
                submission.ApprovedDate = null;
                break;
            default:
                return BadRequest(new { message = $"Aksi workflow '{dto.Action}' tidak dikenali." });
        }

        submission.Status = toStatus;

        _context.ApprovalHistories.Add(new ApprovalHistory
        {
            Id = Guid.NewGuid(),
            EntityType = "EdCase",
            EntityId = id,
            FromStatus = fromStatus.ToString(),
            ToStatus = toStatus.ToString(),
            ActionById = dto.ActionById,
            ActionDate = DateTime.UtcNow,
            Notes = dto.Notes ?? $"Aksi workflow kasus UGD: {dto.Action}"
        });

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = $"Status kasus UGD berhasil diperbarui menjadi {toStatus}.",
            newStatus = toStatus,
            newStatusText = toStatus.ToString()
        });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteSubmission(Guid id, [FromQuery] Guid? actionById)
    {
        var submission = await _context.EdCaseSubmissions.FindAsync(id);
        if (submission == null)
            return NotFound(new { message = "Data kasus UGD tidak ditemukan." });

        if (actionById.HasValue && actionById.Value != Guid.Empty)
        {
            var actingUser = await _context.AppUsers.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == actionById.Value);
            if (actingUser != null && actingUser.Role != null)
            {
                var role = actingUser.Role.Name;
                bool isAuthorized = role == "Admin" || role == "KadeptNQ" || role == "NQCorp" || role == "Kanit";
                if (!isAuthorized)
                {
                    return StatusCode(403, new { message = $"Akses Ditolak: Hanya Kepala Unit (Kanit), Kadept NQ, atau Administrator yang berwenang menghapus data kasus UGD. Role Anda saat ini adalah '{role}'." });
                }
            }
        }

        var isLocked = await _context.ClosedPeriods.AnyAsync(cp => 
            cp.HospitalSiteId == submission.HospitalSiteId && 
            cp.Month == submission.SubmissionMonth);

        if (isLocked)
        {
            return BadRequest(new { message = "Data ini sudah ditutup (locked) karena CAPA untuk periode ini sudah digenerate. Data tidak dapat dihapus." });
        }

        var histories = await _context.ApprovalHistories
            .Where(h => h.EntityType == "EdCase" && h.EntityId == id)
            .ToListAsync();
        if (histories.Any())
        {
            _context.ApprovalHistories.RemoveRange(histories);
        }

        _context.EdCaseSubmissions.Remove(submission);
        await _context.SaveChangesAsync();
        return Ok(new { message = "Data kasus UGD berhasil dihapus." });
    }

    [HttpGet("dashboard")]
    public async Task<IActionResult> GetEdDashboard(
        [FromQuery] string? siteId,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate)
    {
        Guid? parsedSiteId = null;
        if (!string.IsNullOrWhiteSpace(siteId) && Guid.TryParse(siteId, out var g))
        {
            parsedSiteId = g;
        }

        var query = _context.EdCaseSubmissions
            .Include(e => e.HospitalSite)
            .Include(e => e.EdIndicator)
            .AsQueryable();

        if (parsedSiteId.HasValue)
            query = query.Where(e => e.HospitalSiteId == parsedSiteId.Value);

        if (startDate.HasValue)
            query = query.Where(e => e.DoorTime >= startDate.Value.Date);

        if (endDate.HasValue)
        {
            var end = new DateTime(endDate.Value.Year, endDate.Value.Month, 1).AddMonths(1).AddTicks(-1);
            query = query.Where(e => e.DoorTime <= end);
        }

        var allSites = await _context.HospitalSites.ToListAsync();
        var allIndicators = await _context.EdIndicators.ToListAsync();

        var dateQuery = _context.EdCaseSubmissions
            .Include(e => e.HospitalSite)
            .Include(e => e.EdIndicator)
            .AsQueryable();

        if (startDate.HasValue)
            dateQuery = dateQuery.Where(e => e.DoorTime >= startDate.Value.Date);

        if (endDate.HasValue)
        {
            var end = new DateTime(endDate.Value.Year, endDate.Value.Month, 1).AddMonths(1).AddTicks(-1);
            dateQuery = dateQuery.Where(e => e.DoorTime <= end);
        }

        var allDateCases = await dateQuery.ToListAsync();

        // Cases filtered by selected site if specified
        var cases = parsedSiteId.HasValue 
            ? allDateCases.Where(e => e.HospitalSiteId == parsedSiteId.Value).ToList() 
            : allDateCases;

        int totalCases = cases.Count;
        int compliantCases = cases.Count(c => c.IsCompliant);
        int overdueCases = totalCases - compliantCases;
        double complianceRate = totalCases > 0 ? Math.Round((double)compliantCases * 100.0 / totalCases, 1) : 0.0;
        double avgMinutes = cases.Any() ? Math.Round(cases.Average(c => c.MinutesElapsed), 1) : 0.0;
        double fastestMinutes = cases.Any() ? Math.Round(cases.Min(c => c.MinutesElapsed), 1) : 0.0;
        double slowestMinutes = cases.Any() ? Math.Round(cases.Max(c => c.MinutesElapsed), 1) : 0.0;

        var indicatorBreakdown = allIndicators.Select(ind =>
        {
            var matched = cases.Where(c => c.EdIndicatorId == ind.Id).ToList();
            int indTotal = matched.Count;
            int indCompliant = matched.Count(c => c.IsCompliant);
            int indOverdue = indTotal - indCompliant;
            double indRate = indTotal > 0 ? Math.Round((double)indCompliant * 100.0 / indTotal, 1) : 0.0;
            double indAvg = matched.Any() ? Math.Round(matched.Average(c => c.MinutesElapsed), 1) : 0.0;
            double indFastest = matched.Any() ? Math.Round(matched.Min(c => c.MinutesElapsed), 1) : 0.0;
            double indSlowest = matched.Any() ? Math.Round(matched.Max(c => c.MinutesElapsed), 1) : 0.0;

            return new
            {
                IndicatorId = ind.Id,
                IndicatorName = ind.Name,
                TargetMinutes = ind.TargetMinutes,
                TargetDescription = ind.TargetDescription,
                TotalCases = indTotal,
                CompliantCases = indCompliant,
                OverdueCases = indOverdue,
                ComplianceRate = indRate,
                AverageMinutes = indAvg,
                FastestMinutes = indFastest,
                SlowestMinutes = indSlowest,
                IsTargetMet = indTotal > 0 && indRate >= 90.0
            };
        }).ToList();

        var approvalBreakdown = new
        {
            Submitted = cases.Count(c => c.Status == AuditStatus.Submitted),
            ApprovedL1 = cases.Count(c => c.Status == AuditStatus.ApprovedL1),
            ApprovedL2 = cases.Count(c => c.Status == AuditStatus.ApprovedL2),
            Verified = cases.Count(c => c.Status == AuditStatus.Verified),
            Rejected = cases.Count(c => c.Status == AuditStatus.Rejected)
        };

        var siteRankings = allSites.Select(site =>
        {
            var siteCases = allDateCases.Where(c => c.HospitalSiteId == site.Id).ToList();
            int sTotal = siteCases.Count;
            int sCompliant = siteCases.Count(c => c.IsCompliant);
            double sRate = sTotal > 0 ? Math.Round((double)sCompliant * 100.0 / sTotal, 1) : 0.0;
            double sAvg = siteCases.Any() ? Math.Round(siteCases.Average(c => c.MinutesElapsed), 1) : 0.0;
            return new
            {
                SiteId = site.Id,
                SiteName = site.Name,
                SiteCode = site.Code,
                TotalCases = sTotal,
                CompliantCases = sCompliant,
                ComplianceRate = sRate,
                AverageMinutes = sAvg,
                IsTargetMet = sTotal > 0 && sRate >= 90.0
            };
        })
        .OrderByDescending(s => s.ComplianceRate)
        .ThenByDescending(s => s.TotalCases)
        .ToList();

        var monthlyGroups = cases
            .GroupBy(c => c.SubmissionMonth)
            .OrderBy(g => g.Key)
            .Select(g =>
            {
                int mTotal = g.Count();
                int mComp = g.Count(c => c.IsCompliant);
                return new
                {
                    Month = g.Key,
                    TotalCases = mTotal,
                    CompliantCases = mComp,
                    ComplianceRate = mTotal > 0 ? Math.Round((double)mComp * 100.0 / mTotal, 1) : 100.0,
                    AverageMinutes = g.Any() ? Math.Round(g.Average(c => c.MinutesElapsed), 1) : 0.0
                };
            })
            .ToList();

        return Ok(new
        {
            TotalCases = totalCases,
            CompliantCases = compliantCases,
            OverdueCases = overdueCases,
            ComplianceRate = complianceRate,
            AverageMinutes = avgMinutes,
            FastestMinutes = fastestMinutes,
            SlowestMinutes = slowestMinutes,
            ApprovalBreakdown = approvalBreakdown,
            Indicators = indicatorBreakdown,
            SiteRankings = siteRankings,
            MonthlyTrends = monthlyGroups
        });
    }
}

public class CreateEdSubmissionDto
{
    public Guid HospitalSiteId { get; set; }
    public string EmrNumber { get; set; } = string.Empty;
    public string PatientInitials { get; set; } = string.Empty;
    public string SubmissionMonth { get; set; } = string.Empty;
    public Guid EdIndicatorId { get; set; }
    public DateTime DoorTime { get; set; }
    public DateTime EventTime { get; set; }
    public string? ClinicalNotes { get; set; }
    public string? CustomFieldsJson { get; set; }
    public Guid? SubmittedById { get; set; }
}

public class EdWorkflowActionDto
{
    public string Action { get; set; } = string.Empty; // "submit", "approve_l1", "approve_l2", "approve_l3", "verify", "reset", "reject"
    public Guid ActionById { get; set; }
    public string? Notes { get; set; }
}
