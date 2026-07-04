using AegisMed.Core.DTOs;

namespace AegisMed.Core.Interfaces;

public interface IDashboardService
{
    Task<DashboardDto> GetDashboardDataAsync(Guid? siteId, DateTime? startDate, DateTime? endDate);
}
