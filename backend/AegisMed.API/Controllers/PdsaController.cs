using AegisMed.Core.Entities;
using AegisMed.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AegisMed.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PdsaController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public PdsaController(ApplicationDbContext context)
    {
        _context = context;
    }

    public class CreatePdsaDto
    {
        public Guid HospitalUnitId { get; set; }
        public Guid NsiIndicatorId { get; set; }
        public string Month { get; set; } = string.Empty; // "2026-10"
        public double AchievementRate { get; set; }
        public int Numerator { get; set; }
        public int Denominator { get; set; }
        public string RootCauseAnalysis { get; set; } = string.Empty;
        public string ImprovementPlan { get; set; } = string.Empty;
        public string PIC { get; set; } = string.Empty;
        public DateTime? TargetDate { get; set; }
        public Guid CreatedById { get; set; }
    }

    public class UpdatePdsaDto
    {
        public string RootCauseAnalysis { get; set; } = string.Empty;
        public string ImprovementPlan { get; set; } = string.Empty;
        public string PIC { get; set; } = string.Empty;
        public DateTime? TargetDate { get; set; }
        public string? RevisionNotes { get; set; }
    }

    public class PdsaWorkflowDto
    {
        public string Action { get; set; } = string.Empty; // "submit", "verify", "revise"
        public Guid ActionById { get; set; }
        public string? Notes { get; set; }
    }

    [HttpGet]
    public async Task<IActionResult> GetPdsaActions(
        [FromQuery] Guid? siteId,
        [FromQuery] Guid? unitId,
        [FromQuery] string? month,
        [FromQuery] PdsaStatus? status)
    {
        var query = _context.PdsaActions
            .Include(p => p.HospitalUnit)
                .ThenInclude(u => u!.HospitalSite)
            .Include(p => p.NsiIndicator)
            .Include(p => p.CreatedBy)
            .Include(p => p.VerifiedBy)
            .AsQueryable();

        if (siteId.HasValue) query = query.Where(p => p.HospitalUnit != null && p.HospitalUnit.HospitalSiteId == siteId.Value);
        if (unitId.HasValue) query = query.Where(p => p.HospitalUnitId == unitId.Value);
        if (!string.IsNullOrWhiteSpace(month)) query = query.Where(p => p.Month == month);
        if (status.HasValue) query = query.Where(p => p.Status == status.Value);

        var list = await query
            .OrderByDescending(p => p.CreatedDate)
            .Select(p => new
            {
                p.Id,
                p.HospitalUnitId,
                HospitalUnitName = p.HospitalUnit != null ? p.HospitalUnit.Name : "",
                HospitalUnitCode = p.HospitalUnit != null ? p.HospitalUnit.Code : "",
                HospitalSiteId = p.HospitalUnit != null ? p.HospitalUnit.HospitalSiteId : Guid.Empty,
                HospitalSiteName = p.HospitalUnit != null && p.HospitalUnit.HospitalSite != null ? p.HospitalUnit.HospitalSite.Name : "",
                p.NsiIndicatorId,
                IndicatorName = p.NsiIndicator != null ? p.NsiIndicator.Name : "",
                IndicatorCode = p.NsiIndicator != null ? p.NsiIndicator.Code : "",
                p.Month,
                p.AchievementRate,
                p.Numerator,
                p.Denominator,
                p.RootCauseAnalysis,
                p.ImprovementPlan,
                p.PIC,
                p.TargetDate,
                p.Status,
                StatusText = p.Status.ToString(),
                p.CreatedById,
                CreatedByName = p.CreatedBy != null ? p.CreatedBy.FullName : "",
                p.CreatedDate,
                p.VerifiedById,
                VerifiedByName = p.VerifiedBy != null ? p.VerifiedBy.FullName : "",
                p.VerifiedDate,
                p.RevisionNotes
            })
            .ToListAsync();

        return Ok(list);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetPdsaById(Guid id)
    {
        var p = await _context.PdsaActions
            .Include(x => x.HospitalUnit)
                .ThenInclude(u => u!.HospitalSite)
            .Include(x => x.NsiIndicator)
            .Include(x => x.CreatedBy)
            .Include(x => x.VerifiedBy)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (p == null) return NotFound(new { message = "Data PDSA tidak ditemukan" });

        var history = await _context.ApprovalHistories
            .Include(h => h.ActionBy)
            .Where(h => h.EntityType == "PdsaAction" && h.EntityId == id)
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

        return Ok(new
        {
            p.Id,
            p.HospitalUnitId,
            HospitalUnitName = p.HospitalUnit?.Name,
            HospitalSiteId = p.HospitalUnit?.HospitalSiteId,
            HospitalSiteName = p.HospitalUnit?.HospitalSite?.Name,
            p.NsiIndicatorId,
            IndicatorName = p.NsiIndicator?.Name,
            IndicatorCode = p.NsiIndicator?.Code,
            p.Month,
            p.AchievementRate,
            p.Numerator,
            p.Denominator,
            p.RootCauseAnalysis,
            p.ImprovementPlan,
            p.PIC,
            p.TargetDate,
            p.Status,
            StatusText = p.Status.ToString(),
            p.CreatedById,
            CreatedByName = p.CreatedBy?.FullName,
            p.CreatedDate,
            p.VerifiedById,
            VerifiedByName = p.VerifiedBy?.FullName,
            p.VerifiedDate,
            p.RevisionNotes,
            History = history
        });
    }

    [HttpPost]
    public async Task<IActionResult> CreatePdsa([FromBody] CreatePdsaDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.RootCauseAnalysis) || string.IsNullOrWhiteSpace(dto.ImprovementPlan))
            return BadRequest(new { message = "Analisa penyebab dan rencana perbaikan wajib diisi." });

        var pdsa = new PdsaAction
        {
            Id = Guid.NewGuid(),
            HospitalUnitId = dto.HospitalUnitId,
            NsiIndicatorId = dto.NsiIndicatorId,
            Month = string.IsNullOrWhiteSpace(dto.Month) ? DateTime.UtcNow.ToString("yyyy-MM") : dto.Month,
            AchievementRate = dto.AchievementRate,
            Numerator = dto.Numerator,
            Denominator = dto.Denominator,
            RootCauseAnalysis = dto.RootCauseAnalysis.Trim(),
            ImprovementPlan = dto.ImprovementPlan.Trim(),
            PIC = dto.PIC.Trim(),
            TargetDate = dto.TargetDate,
            Status = PdsaStatus.Submitted,
            CreatedById = dto.CreatedById,
            CreatedDate = DateTime.UtcNow
        };

        _context.ApprovalHistories.Add(new ApprovalHistory
        {
            Id = Guid.NewGuid(),
            EntityType = "PdsaAction",
            EntityId = pdsa.Id,
            FromStatus = PdsaStatus.Draft.ToString(),
            ToStatus = PdsaStatus.Submitted.ToString(),
            ActionById = dto.CreatedById,
            ActionDate = DateTime.UtcNow,
            Notes = "PDSA dibuat dan diajukan oleh Kepala Unit"
        });

        _context.PdsaActions.Add(pdsa);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetPdsaById), new { id = pdsa.Id }, new { message = "PDSA berhasil dibuat & diajukan.", id = pdsa.Id });
    }

    [HttpPost("{id}/workflow")]
    public async Task<IActionResult> ExecuteWorkflow(Guid id, [FromBody] PdsaWorkflowDto dto)
    {
        var pdsa = await _context.PdsaActions.FindAsync(id);
        if (pdsa == null) return NotFound(new { message = "Data PDSA tidak ditemukan" });

        var fromStatus = pdsa.Status;
        PdsaStatus toStatus;

        switch (dto.Action.ToLower().Trim())
        {
            case "submit":
                toStatus = PdsaStatus.Submitted;
                break;
            case "verify":
            case "approve":
                toStatus = PdsaStatus.Verified;
                pdsa.VerifiedById = dto.ActionById;
                pdsa.VerifiedDate = DateTime.UtcNow;
                break;
            case "revise":
            case "reject":
                toStatus = PdsaStatus.Revised;
                pdsa.RevisionNotes = dto.Notes;
                break;
            default:
                return BadRequest(new { message = $"Aksi workflow '{dto.Action}' tidak dikenali." });
        }

        pdsa.Status = toStatus;

        _context.ApprovalHistories.Add(new ApprovalHistory
        {
            Id = Guid.NewGuid(),
            EntityType = "PdsaAction",
            EntityId = id,
            FromStatus = fromStatus.ToString(),
            ToStatus = toStatus.ToString(),
            ActionById = dto.ActionById,
            ActionDate = DateTime.UtcNow,
            Notes = dto.Notes ?? $"Aksi workflow PDSA: {dto.Action}"
        });

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = $"Status PDSA berhasil diperbarui menjadi {toStatus}.",
            newStatus = toStatus,
            newStatusText = toStatus.ToString()
        });
    }
}
