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
public class CapaActionsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public CapaActionsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetCapas([FromQuery] Guid? siteId)
    {
        var query = _context.CapaActions.Include(c => c.HospitalSite).AsQueryable();

        if (siteId.HasValue)
        {
            query = query.Where(c => c.HospitalSiteId == siteId.Value);
        }

        var list = await query.OrderByDescending(c => c.CreatedDate).ToListAsync();
        
        var result = list.Select(c => new {
            c.Id,
            c.Title,
            c.Description,
            Status = c.Status.ToString(),
            Severity = c.Severity.ToString(),
            c.CreatedDate,
            c.DueDate,
            c.ResolvedDate,
            c.AssignedTo,
            c.HospitalSiteId,
            SiteName = c.HospitalSite != null ? c.HospitalSite.Name : "N/A",
            c.RootCause,
            c.CorrectiveAction,
            c.PreventiveAction,
            c.ActionPlan
        });

        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> CreateCapa([FromBody] CreateCapaDto dto)
    {
        var siteExists = await _context.HospitalSites.AnyAsync(s => s.Id == dto.HospitalSiteId);
        if (!siteExists)
        {
            return BadRequest("Rumah sakit (site) tidak valid.");
        }

        var capa = new CapaAction
        {
            Title = dto.Title,
            Description = dto.Description,
            Status = (CapaStatus)Enum.Parse(typeof(CapaStatus), dto.Status, true),
            Severity = (CapaSeverity)Enum.Parse(typeof(CapaSeverity), dto.Severity, true),
            CreatedDate = DateTime.UtcNow,
            DueDate = dto.DueDate,
            AssignedTo = dto.AssignedTo ?? string.Empty,
            HospitalSiteId = dto.HospitalSiteId,
            RootCause = dto.RootCause ?? string.Empty,
            CorrectiveAction = dto.CorrectiveAction ?? string.Empty,
            PreventiveAction = dto.PreventiveAction ?? string.Empty,
            ActionPlan = dto.ActionPlan ?? string.Empty
        };

        _context.CapaActions.Add(capa);
        await _context.SaveChangesAsync();

        return Ok(capa);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateCapa(Guid id, [FromBody] CreateCapaDto dto)
    {
        var capa = await _context.CapaActions.FindAsync(id);
        if (capa == null)
        {
            return NotFound("Tindakan CAPA tidak ditemukan.");
        }

        var siteExists = await _context.HospitalSites.AnyAsync(s => s.Id == dto.HospitalSiteId);
        if (!siteExists)
        {
            return BadRequest("Rumah sakit (site) tidak valid.");
        }

        capa.Title = dto.Title;
        capa.Description = dto.Description;
        
        var oldStatus = capa.Status;
        var newStatus = (CapaStatus)Enum.Parse(typeof(CapaStatus), dto.Status, true);
        capa.Status = newStatus;
        capa.Severity = (CapaSeverity)Enum.Parse(typeof(CapaSeverity), dto.Severity, true);
        capa.DueDate = dto.DueDate;
        capa.AssignedTo = dto.AssignedTo ?? string.Empty;
        capa.HospitalSiteId = dto.HospitalSiteId;
        
        // Update CAPA clinical process fields
        capa.RootCause = dto.RootCause ?? string.Empty;
        capa.CorrectiveAction = dto.CorrectiveAction ?? string.Empty;
        capa.PreventiveAction = dto.PreventiveAction ?? string.Empty;
        capa.ActionPlan = dto.ActionPlan ?? string.Empty;

        if (newStatus == CapaStatus.Resolved)
        {
            if (oldStatus != CapaStatus.Resolved)
            {
                capa.ResolvedDate = DateTime.UtcNow;
            }
        }
        else
        {
            capa.ResolvedDate = null;
        }

        await _context.SaveChangesAsync();
        return Ok(capa);
    }

    [HttpPost("generate")]
    public async Task<IActionResult> GenerateCapas([FromBody] GenerateCapaRequest request)
    {
        var siteExists = await _context.HospitalSites.AnyAsync(s => s.Id == request.HospitalSiteId);
        if (!siteExists)
        {
            return BadRequest("Rumah sakit (site) tidak valid.");
        }

        if (string.IsNullOrEmpty(request.Month))
        {
            return BadRequest("Bulan (Month) wajib diisi (Format: YYYY-MM).");
        }

        // 1. Ambil semua indikator UGD
        var indicators = await _context.EdIndicators.ToListAsync();
        
        // 2. Ambil semua submissions untuk site & month terpilih
        var submissions = await _context.EdCaseSubmissions
            .Where(s => s.HospitalSiteId == request.HospitalSiteId && s.SubmissionMonth == request.Month)
            .ToListAsync();

        int generatedCount = 0;

        foreach (var indicator in indicators)
        {
            var indicatorSubmissions = submissions.Where(s => s.EdIndicatorId == indicator.Id).ToList();
            if (!indicatorSubmissions.Any())
            {
                continue; // Skip jika tidak ada data sama sekali untuk indikator ini
            }

            var total = indicatorSubmissions.Count;
            var compliant = indicatorSubmissions.Count(s => s.IsCompliant);
            var rate = ((double)compliant / total) * 100;

            // Jika Kepatuhan di bawah 90%
            if (rate < 90.0)
            {
                string capaTitle = $"CAPA: {indicator.Name} - {request.Month}";
                var exists = await _context.CapaActions.AnyAsync(c => 
                    c.HospitalSiteId == request.HospitalSiteId && 
                    c.Title == capaTitle);

                if (!exists)
                {
                    var capa = new CapaAction
                    {
                        Title = capaTitle,
                        Description = $"Kepatuhan untuk indikator {indicator.Name} di bawah 90% (Kepatuhan: {rate:F1}%, Kasus: {compliant}/{total}). Silakan isi analisis akar masalah, tindakan perbaikan, dan pencegahan.",
                        Status = CapaStatus.Open,
                        Severity = CapaSeverity.High,
                        CreatedDate = DateTime.UtcNow,
                        DueDate = DateTime.UtcNow.AddDays(14),
                        AssignedTo = "Komite Mutu / Kepala Unit",
                        HospitalSiteId = request.HospitalSiteId,
                        RootCause = string.Empty,
                        CorrectiveAction = string.Empty,
                        PreventiveAction = string.Empty,
                        ActionPlan = string.Empty
                    };
                    _context.CapaActions.Add(capa);
                    generatedCount++;
                }
            }
        }

        // 3. Kunci / Close semua data submissions indikator UGD untuk site & month terpilih
        foreach (var sub in submissions)
        {
            sub.IsClosed = true;
        }

        await _context.SaveChangesAsync();

        return Ok(new { 
            message = $"CAPA berhasil digenerate. {generatedCount} tindakan CAPA baru dibuat. Semua data kasus untuk periode {request.Month} di site terpilih sekarang berstatus LOCKED (Tutup).",
            generatedCount 
        });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteCapa(Guid id)
    {
        var capa = await _context.CapaActions.FindAsync(id);
        if (capa == null)
        {
            return NotFound("Tindakan CAPA tidak ditemukan.");
        }

        _context.CapaActions.Remove(capa);
        await _context.SaveChangesAsync();
        return Ok(new { message = "CAPA berhasil dihapus." });
    }
}

public class CreateCapaDto
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Status { get; set; } = "Open";
    public string Severity { get; set; } = "Low";
    public DateTime DueDate { get; set; }
    public string? AssignedTo { get; set; }
    public Guid HospitalSiteId { get; set; }
    public string? RootCause { get; set; }
    public string? CorrectiveAction { get; set; }
    public string? PreventiveAction { get; set; }
    public string? ActionPlan { get; set; }
}

public class GenerateCapaRequest
{
    public Guid HospitalSiteId { get; set; }
    public string Month { get; set; } = string.Empty; // Format: YYYY-MM
}
