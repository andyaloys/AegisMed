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
    public async Task<IActionResult> GetSubmissions(
        [FromQuery] Guid? siteId, 
        [FromQuery] string? month, 
        [FromQuery] Guid? indicatorId,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate)
    {
        var query = _context.EdCaseSubmissions.Include(e => e.HospitalSite).AsQueryable();

        if (siteId.HasValue)
            query = query.Where(e => e.HospitalSiteId == siteId.Value);

        if (startDate.HasValue)
            query = query.Where(e => e.DoorTime >= startDate.Value.Date);

        if (endDate.HasValue)
            query = query.Where(e => e.DoorTime <= endDate.Value.Date.AddDays(1).AddTicks(-1));

        if (!startDate.HasValue && !endDate.HasValue && !string.IsNullOrEmpty(month))
            query = query.Where(e => e.SubmissionMonth == month);

        if (indicatorId.HasValue)
            query = query.Where(e => e.EdIndicatorId == indicatorId.Value);

        var list = await query.OrderByDescending(e => e.DoorTime).ToListAsync();
        return Ok(list);
    }

    [HttpPost]
    public async Task<IActionResult> CreateSubmission([FromBody] CreateEdSubmissionDto dto)
    {
        var isLocked = await _context.EdCaseSubmissions.AnyAsync(s => s.HospitalSiteId == dto.HospitalSiteId && s.SubmissionMonth == dto.SubmissionMonth && s.IsClosed);
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
            CreatedBy = "UGD Staff"
        };

        _context.EdCaseSubmissions.Add(submission);
        await _context.SaveChangesAsync();
        return Ok(submission);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateSubmission(Guid id, [FromBody] CreateEdSubmissionDto dto)
    {
        var submission = await _context.EdCaseSubmissions.FindAsync(id);
        if (submission == null)
            return NotFound("Data tidak ditemukan.");

        if (submission.IsClosed)
            return BadRequest("Data ini sudah ditutup (locked) karena CAPA untuk periode ini sudah digenerate. Data tidak dapat diubah.");

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

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteSubmission(Guid id)
    {
        var submission = await _context.EdCaseSubmissions.FindAsync(id);
        if (submission == null)
            return NotFound("Data tidak ditemukan.");

        if (submission.IsClosed)
            return BadRequest("Data ini sudah ditutup (locked) karena CAPA untuk periode ini sudah digenerate. Data tidak dapat dihapus.");

        _context.EdCaseSubmissions.Remove(submission);
        await _context.SaveChangesAsync();
        return Ok(new { message = "Data berhasil dihapus." });
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
}
