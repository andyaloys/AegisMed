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
    public async Task<IActionResult> GetDashboardData([FromQuery] Guid? siteId, [FromQuery] System.DateTime? startDate, [FromQuery] System.DateTime? endDate)
    {
        var data = await _dashboardService.GetDashboardDataAsync(siteId, startDate, endDate);
        return Ok(data);
    }
}
