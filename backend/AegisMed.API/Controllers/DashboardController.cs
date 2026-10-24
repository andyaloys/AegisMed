using AegisMed.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace AegisMed.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DashboardController : ControllerBase
{
    private readonly IDashboardService _dashboardService;

    public DashboardController(IDashboardService dashboardService)
    {
        _dashboardService = dashboardService;
    }

    [HttpGet]
    public async Task<IActionResult> GetDashboardData([FromQuery] string? siteId, [FromQuery] System.DateTime? startDate, [FromQuery] System.DateTime? endDate)
    {
        Guid? parsedSiteId = null;
        if (!string.IsNullOrWhiteSpace(siteId) && Guid.TryParse(siteId, out var g))
        {
            parsedSiteId = g;
        }

        var data = await _dashboardService.GetDashboardDataAsync(parsedSiteId, startDate, endDate);
        return Ok(data);
    }
}
