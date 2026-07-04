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
            SiteName = c.HospitalSite != null ? c.HospitalSite.Name : "N/A"
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
            HospitalSiteId = dto.HospitalSiteId
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
}
