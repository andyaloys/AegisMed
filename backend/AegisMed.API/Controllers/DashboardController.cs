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
    public async Task<IActionResult> GetDashboardData([FromQuery] Guid? siteId)
    {
        var data = await _dashboardService.GetDashboardDataAsync(siteId);
        return Ok(data);
    }
}
