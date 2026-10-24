import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { combineLatest, Subscription } from 'rxjs';
import * as XLSX from 'xlsx';
import { DashboardService, DashboardData } from '../../core/services/dashboard.service';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
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
  filterEndMonth = '2026-12';
  quickSearchText = '';
  activePeriodKey: 'sem1' | 'sem2' | 'full' = 'full';

  private filterSub: Subscription | null = null;

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    // Combine filter sources reactively
    this.filterSub = combineLatest([
      this.dashboardService.selectedSiteId$,
      this.dashboardService.dateFilter$
    ]).subscribe(([siteId, dates]) => {
      this.selectedSiteId = (!siteId || siteId === 'undefined' || siteId === 'null') ? undefined : siteId;
      this.filterStartMonth = dates.start;
      this.filterEndMonth = dates.end;

      if (dates.start === '2026-01' && dates.end === '2026-06') {
        this.activePeriodKey = 'sem1';
      } else if (dates.start === '2026-07' && dates.end === '2026-12') {
        this.activePeriodKey = 'sem2';
      } else {
        this.activePeriodKey = 'full';
      }

      this.loadOverviewData();
    });
  }

  ngOnDestroy(): void {
    if (this.filterSub) {
      this.filterSub.unsubscribe();
    }
  }

  setQuickPeriod(period: 'sem1' | 'sem2' | 'full'): void {
    this.activePeriodKey = period;
    if (period === 'sem1') {
      this.filterStartMonth = '2026-01';
      this.filterEndMonth = '2026-06';
    } else if (period === 'sem2') {
      this.filterStartMonth = '2026-07';
      this.filterEndMonth = '2026-12';
    } else {
      this.filterStartMonth = '2026-01';
      this.filterEndMonth = '2026-12';
    }
    this.dashboardService.setDateFilters(this.filterStartMonth, this.filterEndMonth);
  }

  loadOverviewData(): void {
    this.loading = true;
    const cleanSiteId = (!this.selectedSiteId || this.selectedSiteId === 'undefined' || this.selectedSiteId === 'null') 
      ? undefined 
      : this.selectedSiteId;
    this.selectedSiteId = cleanSiteId;

    this.dashboardService.getDashboardData(
      cleanSiteId,
      this.filterStartMonth,
      this.filterEndMonth
    ).subscribe({
      next: (res) => {
        this.data = res;
        this.loading = false;
        this.error = false;
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

  getDonutDashOffset(): number {
    const totalCircumference = 339.292; // 2 * PI * 54
    const score = this.data?.summary?.averageAuditScore || 0;
    const clamped = Math.min(100, Math.max(0, score));
    return totalCircumference - (totalCircumference * clamped) / 100;
  }

  getFilteredSiteCompliance(): any[] {
    if (!this.data || !this.data.siteCompliance) return [];
    if (this.selectedSiteId) {
      return this.data.siteCompliance.filter(s => s.siteId === this.selectedSiteId);
    }
    return this.data.siteCompliance;
  }

  getRankedHospitalSites(): any[] {
    const list = this.getFilteredSiteCompliance();
    return [...list].sort((a, b) => b.averageScore - a.averageScore || b.auditsCount - a.auditsCount);
  }

  getMedalBadge(rank: number): { medal: string, label: string, cssClass: string } {
    if (rank === 0) return { medal: '🥇', label: 'Top 1', cssClass: 'medal-gold' };
    if (rank === 1) return { medal: '🥈', label: 'Top 2', cssClass: 'medal-silver' };
    if (rank === 2) return { medal: '🥉', label: 'Top 3', cssClass: 'medal-bronze' };
    return { medal: `#${rank + 1}`, label: `Peringkat ${rank + 1}`, cssClass: 'medal-default' };
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

  getTotalCompliantCases(): number {
    if (!this.data || !this.data.edCompliance) return 0;
    return this.data.edCompliance.reduce((acc, curr) => acc + (curr.compliantCases || 0), 0);
  }

  getTotalNonCompliantCases(): number {
    if (!this.data || !this.data.edCompliance) return 0;
    return this.data.edCompliance.reduce((acc, curr) => acc + ((curr.totalCases - curr.compliantCases) || 0), 0);
  }

  getIndicatorRouteId(ind: any): string {
    if (!this.data) return 'a0000000-a000-a000-a000-a00000000000';
    const found = this.data.edIndicators?.find(i => i.name.toLowerCase() === ind.indicatorName.toLowerCase());
    if (found) return found.id;
    const name = ind.indicatorName.toLowerCase();
    if (name.includes('ecg') || name.includes('cardio')) return 'a0000000-a000-a000-a000-a00000000000';
    if (name.includes('analges') || name.includes('ortho')) return 'a1111111-a111-a111-a111-a111111111111';
    if (name.includes('ct') || name.includes('neuro')) return 'a2222222-a222-a222-a222-a22222222222';
    if (name.includes('bleed') || name.includes('gastro')) return 'a3333333-a333-a333-a333-a33333333333';
    if (name.includes('fever') || name.includes('onco')) return 'a4444444-a444-a444-a444-a44444444444';
    if (name.includes('bidan') || name.includes('maternal') || name.includes('mom')) return 'a5555555-a555-a555-a555-a55555555555';
    return this.data.edIndicators?.[0]?.id || 'a0000000-a000-a000-a000-a00000000000';
  }

  getIndicatorIcon(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('ecg') || n.includes('cardio')) return '🫀';
    if (n.includes('analges') || n.includes('ortho')) return '🦴';
    if (n.includes('ct') || n.includes('neuro')) return '🧠';
    if (n.includes('bleed') || n.includes('gastro')) return '🩺';
    if (n.includes('fever') || n.includes('onco')) return '🧪';
    if (n.includes('bidan') || n.includes('maternal') || n.includes('mom')) return '👶';
    return '⏱️';
  }

  getFilteredEdCompliance(): any[] {
    if (!this.data || !this.data.edCompliance) return [];
    if (!this.quickSearchText) return this.data.edCompliance;
    const term = this.quickSearchText.toLowerCase();
    return this.data.edCompliance.filter(c => 
      c.indicatorName.toLowerCase().includes(term) || 
      c.category.toLowerCase().includes(term)
    );
  }

  exportExecutiveReport(): void {
    if (!this.data) return;
    
    // Sheet 1: Executive KPI Summary
    const summaryRows = [
      { 'Indikator Eksekutif': 'Total Kasus UGD Terpantau', 'Nilai': this.data.summary.totalAudits, 'Standar Target': '100% Tercatat' },
      { 'Indikator Eksekutif': 'Rata-rata Skor Kepatuhan Global', 'Nilai': `${this.data.summary.averageAuditScore}%`, 'Standar Target': 'Min. 80.0% (Standar Akreditasi)' },
      { 'Indikator Eksekutif': 'Kasus Tepat Waktu (Compliant)', 'Nilai': this.getTotalCompliantCases(), 'Standar Target': 'Golden Hour Terpenuhi' },
      { 'Indikator Eksekutif': 'Kasus Melebihi Batas (Overdue)', 'Nilai': this.getTotalNonCompliantCases(), 'Standar Target': 'Perlu Audit Klinis' },
      { 'Indikator Eksekutif': 'Tindakan CAPA Aktif', 'Nilai': this.data.summary.openCapa + this.data.summary.inProgressCapa, 'Standar Target': 'Terselesaikan Sebelum Deadline' },
      { 'Indikator Eksekutif': 'Tindakan CAPA Selesai', 'Nilai': this.data.summary.resolvedCapa, 'Standar Target': 'Tervalidasi Komite Mutu' }
    ];

    // Sheet 2: Kinerja per Unit RS
    const siteRows = this.getRankedHospitalSites().map((s, idx) => ({
      'Peringkat': idx + 1,
      'Rumah Sakit': s.siteName,
      'Kode Unit': s.siteCode,
      'Total Kasus': s.auditsCount,
      'Open CAPA': s.openCapaCount,
      'Skor Kepatuhan (%)': s.averageScore,
      'Status': s.averageScore >= 90 ? 'Unggul' : (s.averageScore >= 80 ? 'Sesuai Standar' : 'Perlu Audit')
    }));

    const wb = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    const wsSites = XLSX.utils.json_to_sheet(siteRows);

    XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Eksekutif');
    XLSX.utils.book_append_sheet(wb, wsSites, 'Leaderboard Cabang RS');

    const fileName = `AegisMed_Executive_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }
}
