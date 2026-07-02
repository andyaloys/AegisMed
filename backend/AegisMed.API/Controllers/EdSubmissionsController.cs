using AegisMed.Core.Entities;
using AegisMed.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
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
    public async Task<IActionResult> GetSubmissions([FromQuery] Guid? siteId, [FromQuery] string? month, [FromQuery] Guid? indicatorId)
    {
        var query = _context.EdCaseSubmissions.Include(e => e.HospitalSite).AsQueryable();

        if (siteId.HasValue)
        {
            query = query.Where(e => e.HospitalSiteId == siteId.Value);
        }

        if (!string.IsNullOrEmpty(month))
        {
            query = query.Where(e => e.SubmissionMonth == month);
        }

        if (indicatorId.HasValue)
        {
            query = query.Where(e => e.EdIndicatorId == indicatorId.Value);
        }

        var list = await query.OrderByDescending(e => e.CreatedDate).ToListAsync();
        return Ok(list);
    }

    [HttpPost]
    public async Task<IActionResult> CreateSubmission([FromBody] CreateEdSubmissionDto dto)
    {
        if (dto.EventTime < dto.DoorTime)
        {
            return BadRequest("Waktu tindakan tidak boleh lebih awal dari waktu kedatangan (Door Time).");
        }

        var siteExists = await _context.HospitalSites.AnyAsync(s => s.Id == dto.HospitalSiteId);
        if (!siteExists)
        {
            return BadRequest("Rumah sakit (site) tidak valid.");
        }

        var indicator = await _context.EdIndicators.FindAsync(dto.EdIndicatorId);
        if (indicator == null)
        {
            return BadRequest("Indikator tidak valid.");
        }

        // Calculate minutes elapsed
        double minutes = (dto.EventTime - dto.DoorTime).TotalMinutes;
        minutes = Math.Round(minutes, 1);

        // Determine compliance status based on database target minutes dynamically
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
            CreatedBy = "UGD Staff"
        };

        _context.EdCaseSubmissions.Add(submission);
        await _context.SaveChangesAsync();

        return Ok(submission);
    }
}

public class CreateEdSubmissionDto
{
    public Guid HospitalSiteId { get; set; }
    public string EmrNumber { get; set; } = string.Empty;
    public string PatientInitials { get; set; } = string.Empty;
    public string SubmissionMonth { get; set; } = string.Empty; // Format: "YYYY-MM"
    public Guid EdIndicatorId { get; set; }
    public DateTime DoorTime { get; set; }
    public DateTime EventTime { get; set; }
    public string? ClinicalNotes { get; set; }
    public string? CustomFieldsJson { get; set; }
}
