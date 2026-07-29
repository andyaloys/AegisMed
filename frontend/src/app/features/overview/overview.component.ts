import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { combineLatest, Subscription } from 'rxjs';
import { DashboardService, DashboardData } from '../../core/services/dashboard.service';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './overview.component.html',
  styleUrls: []
})
export class OverviewComponent implements OnInit, OnDestroy {
  data: DashboardData | null = null;
  loading = true;
  error = false;
  errorMessage = '';

  // Current filter values
  selectedSiteId: string | undefined = undefined;
  filterStartMonth = '2026-01';
  filterEndMonth = '2026-06';

  private filterSub: Subscription | null = null;

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    // Combine filter sources reactively
    this.filterSub = combineLatest([
      this.dashboardService.selectedSiteId$,
      this.dashboardService.dateFilter$
    ]).subscribe(([siteId, dates]) => {
      this.selectedSiteId = siteId;
      this.filterStartMonth = dates.start;
      this.filterEndMonth = dates.end;
      this.loadOverviewData();
    });
  }

  ngOnDestroy(): void {
    if (this.filterSub) {
      this.filterSub.unsubscribe();
    }
  }

  loadOverviewData(): void {
    this.loading = true;
    this.dashboardService.getDashboardData(
      this.selectedSiteId,
      this.filterStartMonth,
      this.filterEndMonth
    ).subscribe({
      next: (res) => {
        this.data = res;
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.error = true;
        this.errorMessage = 'Gagal memuat data overview dashboard.';
        this.loading = false;
      }
    });
  }

  onDashboardDateFilterChange(): void {
    this.dashboardService.setDateFilters(this.filterStartMonth, this.filterEndMonth);
  }

  getSelectedSiteName(): string {
    if (!this.selectedSiteId || !this.data || !this.data.siteCompliance) {
      return 'Semua Rumah Sakit';
    }
    const site = this.data.siteCompliance.find(s => s.siteId === this.selectedSiteId);
    return site ? site.siteName : 'Semua Rumah Sakit';
  }

  getSelectedPeriodLabel(): string {
    const sParts = this.filterStartMonth.split('-');
    const eParts = this.filterEndMonth.split('-');
    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
    const startLabel = `${monthsShort[parseInt(sParts[1]) - 1]} ${sParts[0]}`;
    const endLabel = `${monthsShort[parseInt(eParts[1]) - 1]} ${eParts[0]}`;
    return `${startLabel} - ${endLabel}`;
  }

  getFilteredSiteCompliance(): any[] {
    if (!this.data || !this.data.siteCompliance) return [];
    if (this.selectedSiteId) {
      return this.data.siteCompliance.filter(s => s.siteId === this.selectedSiteId);
    }
    return this.data.siteCompliance;
  }

  getEdComplianceClass(rate: number): string {
    if (rate >= 90) return 'success';
    if (rate >= 80) return 'warning';
    return 'danger';
  }

  getScoreClass(score: number): string {
    if (score >= 90) return 'score-green';
    if (score >= 80) return 'score-amber';
    return 'score-red';
  }

  getResolutionRate(): number {
    if (!this.data || !this.data.summary || this.data.summary.totalCapa === 0) return 0;
    return Math.round((this.data.summary.resolvedCapa / this.data.summary.totalCapa) * 100);
  }
}
