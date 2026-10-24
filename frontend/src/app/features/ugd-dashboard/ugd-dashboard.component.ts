import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { combineLatest, Subscription } from 'rxjs';
import * as XLSX from 'xlsx';
import { DashboardService, EdDashboardDto } from '../../core/services/dashboard.service';
import { AuthService, UserProfile } from '../../core/services/auth.service';
import { UserManagementService, HospitalSiteDto } from '../../core/services/user-management.service';

@Component({
  selector: 'app-ugd-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './ugd-dashboard.component.html',
  styleUrls: ['./ugd-dashboard.component.css']
})
export class UgdDashboardComponent implements OnInit, OnDestroy {
  Math = Math;
  loading = true;
  error = false;
  errorMessage = '';

  currentUser: UserProfile | null = null;
  dashboardData: EdDashboardDto | null = null;

  // Filters
  filterStartDate = '2026-01-01';
  filterEndDate = '2026-12-31';
  selectedSiteId: string | undefined = undefined;
  activePeriodKey: 'sem1' | 'sem2' | 'full' = 'full';

  sites: HospitalSiteDto[] = [];
  private subs = new Subscription();

  constructor(
    private dashboardService: DashboardService,
    public authService: AuthService,
    private userService: UserManagementService
  ) {}

  ngOnInit(): void {
    // Load hospital sites for filter
    this.userService.getSites().subscribe({
      next: (res) => this.sites = res,
      error: (err) => console.error('Failed to load sites', err)
    });

    this.subs.add(
      this.authService.currentUser$.subscribe(u => {
        this.currentUser = u;
        if (u && !this.authService.isCorporate && !this.authService.isAdmin && u.hospitalSiteId) {
          this.selectedSiteId = u.hospitalSiteId;
        }
      })
    );

    this.subs.add(
      combineLatest([
        this.dashboardService.selectedSiteId$,
        this.dashboardService.dateFilter$
      ]).subscribe(([siteId, dates]) => {
        if (this.authService.isCorporate || this.authService.isAdmin) {
          this.selectedSiteId = (!siteId || siteId === 'undefined' || siteId === 'null') ? undefined : siteId;
        }

        if (dates?.start && dates?.end) {
          this.filterStartDate = `${dates.start}-01`;
          const [y, m] = dates.end.split('-').map(Number);
          const lastDay = new Date(y, m, 0).getDate();
          this.filterEndDate = `${dates.end}-${String(lastDay).padStart(2, '0')}`;

          if (dates.start === '2026-01' && dates.end === '2026-06') {
            this.activePeriodKey = 'sem1';
          } else if (dates.start === '2026-07' && dates.end === '2026-12') {
            this.activePeriodKey = 'sem2';
          } else {
            this.activePeriodKey = 'full';
          }
        }
        this.loadDashboard();
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  setQuickPeriod(period: 'sem1' | 'sem2' | 'full'): void {
    this.activePeriodKey = period;
    let s = '2026-01';
    let e = '2026-12';

    if (period === 'sem1') {
      s = '2026-01';
      e = '2026-06';
    } else if (period === 'sem2') {
      s = '2026-07';
      e = '2026-12';
    }

    this.dashboardService.setDateFilters(s, e);
  }

  onFilterChange(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.loading = true;
    this.error = false;

    this.dashboardService.getEdDashboard(
      this.selectedSiteId,
      this.filterStartDate,
      this.filterEndDate
    ).subscribe({
      next: (res) => {
        this.dashboardData = res;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load ED dashboard', err);
        this.error = true;
        this.errorMessage = err.error?.message || 'Gagal memuat dashboard mutu IGD.';
        this.loading = false;
      }
    });
  }

  getGaugeDashOffset(rate: number): number {
    const circumference = 2 * Math.PI * 54; // ~339.29
    const clamped = Math.min(Math.max(rate, 0), 100);
    return circumference - (clamped / 100) * circumference;
  }

  getOverallScoreClass(rate: number): string {
    if (rate >= 90) return 'text-emerald';
    if (rate >= 80) return 'text-blue';
    if (rate >= 70) return 'text-amber';
    return 'text-rose';
  }

  getOverallProgressClass(rate: number): string {
    if (rate >= 90) return 'progress-emerald';
    if (rate >= 80) return 'progress-blue';
    if (rate >= 70) return 'progress-amber';
    return 'progress-rose';
  }

  getIndicatorIcon(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('ecg') || n.includes('cardio')) return '❤️';
    if (n.includes('ct') || n.includes('neuro')) return '🧠';
    if (n.includes('analges') || n.includes('ortho')) return '🦴';
    if (n.includes('diag') || n.includes('gastro')) return '🔬';
    if (n.includes('antibiot') || n.includes('onco')) return '💊';
    if (n.includes('bidan') || n.includes('matern') || n.includes('mom')) return '👶';
    return '⏱️';
  }

  getIndicatorSpecialty(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('ecg') || n.includes('cardio')) return 'Kardiologi / Nyeri Dada';
    if (n.includes('ct') || n.includes('neuro')) return 'Neurologi / Stroke Akut';
    if (n.includes('analges') || n.includes('ortho')) return 'Ortopedi / Nyeri Akut';
    if (n.includes('diag') || n.includes('gastro')) return 'Gastrohepatologi / Akut Abdomen';
    if (n.includes('antibiot') || n.includes('onco')) return 'Onkologi / Febrile Neutropenia';
    if (n.includes('bidan') || n.includes('matern') || n.includes('mom')) return 'Maternal & Emergency Kebidanan';
    return 'Pelayanan Gawat Darurat';
  }

  printDate = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  get selectedSiteName(): string {
    if (!this.selectedSiteId) return 'Semua Rumah Sakit (Mayapada Group)';
    const s = this.sites.find(x => x.id === this.selectedSiteId);
    return s ? `${s.name} (${s.code})` : 'Mayapada Healthcare';
  }

  printDashboard(): void {
    this.printDate = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const printElement = document.getElementById('ugdPrintArea');
    if (!printElement) {
      window.print();
      return;
    }

    // Clone element to sanitize for popup printout
    const clone = printElement.cloneNode(true) as HTMLElement;

    // Remove all non-printable elements (buttons, filters, search bars, pagination, action columns)
    clone.querySelectorAll('.no-print').forEach(el => el.remove());

    // Ensure all print-only elements are displayed
    clone.querySelectorAll('.print-only').forEach(el => {
      (el as HTMLElement).style.setProperty('display', 'block', 'important');
    });

    const popup = window.open('', '_blank', 'width=1150,height=900,top=40,left=60,toolbar=no,location=no,status=no,menubar=no,scrollbars=yes');
    if (!popup) {
      window.print();
      return;
    }

    const doc = popup.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="utf-8">
        <title>Cetak Laporan Mutu Pelayanan IGD (Golden Hour) - Mayapada Hospital</title>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Outfit:wght@500;600;700;800&display=swap">
        <style>
          *, *::before, *::after {
            box-sizing: border-box;
          }
          html, body {
            background: #f1f5f9;
            color: #0f172a;
            font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .popup-bar {
            position: sticky;
            top: 0;
            z-index: 99999;
            background: #0f172a;
            color: #ffffff;
            padding: 12px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 4px 16px rgba(0,0,0,0.2);
            font-size: 13px;
          }
          .popup-bar-btns {
            display: flex;
            gap: 10px;
          }
          .btn-print-action {
            background: #0284c7;
            color: #ffffff;
            border: none;
            padding: 8px 18px;
            font-size: 13px;
            font-weight: 700;
            border-radius: 6px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }
          .btn-print-action:hover { background: #0369a1; }
          .btn-close-action {
            background: #334155;
            color: #ffffff;
            border: none;
            padding: 8px 16px;
            font-size: 13px;
            font-weight: 600;
            border-radius: 6px;
            cursor: pointer;
          }
          .btn-close-action:hover { background: #475569; }
          .paper-container {
            max-width: 1050px;
            margin: 25px auto;
            background: #ffffff;
            padding: 35px 40px;
            border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.08);
          }
          .print-only { display: block !important; }
          .no-print { display: none !important; }

          /* Header Kop RS */
          .hospital-print-header {
            border-bottom: 2.5px solid #0f172a;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          .print-header-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
          }
          .print-hospital-badge {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .cross-icon {
            font-size: 30px;
            color: #0284c7;
            font-weight: 900;
            line-height: 1;
          }
          .brand-text h2 {
            margin: 0;
            font-size: 17pt;
            font-weight: 800;
            letter-spacing: 0.04em;
            color: #0f172a;
          }
          .brand-text span {
            font-size: 8pt;
            font-weight: 700;
            color: #64748b;
            letter-spacing: 0.08em;
          }
          .print-doc-meta { text-align: right; }
          .doc-badge {
            display: inline-block;
            padding: 3px 8px;
            font-size: 8pt;
            font-weight: 800;
            background: #e0f2fe;
            color: #0369a1;
            border: 1px solid #bae6fd;
            border-radius: 4px;
          }
          .doc-code {
            font-size: 7.5pt;
            font-family: monospace;
            color: #64748b;
            margin-top: 3px;
          }
          .print-title-box {
            text-align: center;
            margin: 12px 0 16px 0;
          }
          .print-title {
            margin: 0 0 4px 0;
            font-size: 13pt;
            font-weight: 800;
            color: #0f172a;
          }
          .print-subtitle {
            margin: 0;
            font-size: 8.5pt;
            color: #475569;
            font-style: italic;
          }
          .print-metadata-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 8px 12px;
          }
          .meta-item {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .meta-label {
            font-size: 7.5pt;
            color: #64748b;
            font-weight: 600;
            text-transform: uppercase;
          }
          .meta-val {
            font-size: 9pt;
            color: #0f172a;
            font-weight: 700;
          }

          /* Summary Banner */
          .dash-hero-banner {
            background: #f8fafc !important;
            border: 1px solid #cbd5e1 !important;
            padding: 12px 16px !important;
            margin-bottom: 16px !important;
            border-radius: 8px;
          }
          .hero-main-title {
            margin: 0 0 4px 0;
            font-size: 13pt;
            font-weight: 800;
            color: #0f172a;
          }
          .hero-sub-title {
            margin: 0;
            font-size: 8.5pt;
            color: #475569;
          }
          .hero-badge-tag {
            display: inline-flex;
            gap: 5px;
            font-size: 7.5pt;
            font-weight: 700;
            background: #e2e8f0;
            color: #0f172a;
            padding: 2px 8px;
            border-radius: 9999px;
            margin-bottom: 4px;
          }

          /* KPI Grid */
          .dash-kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 16px;
          }
          .kpi-card {
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 12px;
            display: flex;
            flex-direction: column;
          }
          .kpi-lbl {
            font-size: 8pt;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            margin-bottom: 4px;
          }
          .kpi-num {
            font-size: 1.6rem;
            font-weight: 800;
            color: #0f172a;
            line-height: 1.1;
          }
          .kpi-sub {
            font-size: 7.5pt;
            color: #64748b;
            margin-top: 4px;
          }
          .kpi-gauge-hero {
            border: 1.5px solid #0284c7;
            align-items: center;
            text-align: center;
          }
          .gauge-svg-wrap {
            position: relative;
            width: 100px;
            height: 100px;
            margin: 6px auto;
          }
          .gauge-svg {
            transform: rotate(-90deg);
            width: 100%;
            height: 100%;
          }
          .gauge-circle-bg {
            fill: none;
            stroke: #e2e8f0;
            stroke-width: 9;
          }
          .gauge-circle-fill {
            fill: none;
            stroke-width: 9;
            stroke-linecap: round;
          }
          .stroke-emerald { stroke: #10b981; }
          .stroke-blue { stroke: #0284c7; }
          .stroke-amber { stroke: #f59e0b; }
          .stroke-rose { stroke: #ef4444; }
          .gauge-center-stat {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
          }
          .gauge-num {
            font-size: 1rem;
            font-weight: 800;
            color: #0f172a;
          }
          .gauge-label {
            font-size: 6.5pt;
            color: #64748b;
            display: block;
          }

          /* Approval levels list */
          .approval-levels-list {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-top: 6px;
          }
          .appr-row {
            display: flex;
            justify-content: space-between;
            font-size: 7.5pt;
            padding: 2px 6px;
            background: #f8fafc;
            border-radius: 4px;
          }
          .appr-label { color: #475569; }
          .appr-num { font-weight: 700; color: #0f172a; }

          /* 6 Emergency Indicator Cards */
          .ed-indicator-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            margin-bottom: 16px;
          }
          .ed-indicator-card {
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .ed-card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .ed-badge {
            font-size: 7.5pt;
            font-weight: 700;
            background: #f1f5f9;
            padding: 2px 6px;
            border-radius: 4px;
          }
          .ed-target-badge {
            font-size: 7.5pt;
            color: #64748b;
            font-weight: 600;
          }
          .ed-title {
            margin: 0;
            font-size: 9.5pt;
            font-weight: 800;
            color: #0f172a;
          }
          .ed-specialty {
            font-size: 7pt;
            color: #64748b;
          }
          .ed-score-row {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
          }
          .ed-score-num {
            font-size: 1.15rem;
            font-weight: 800;
            color: #0284c7;
          }
          .ed-cases-num {
            font-size: 8.5pt;
            font-weight: 700;
            color: #475569;
          }
          .ed-progress-track {
            height: 6px;
            background: #e2e8f0;
            border-radius: 9999px;
            overflow: hidden;
          }
          .ed-progress-fill {
            height: 100%;
            background: #0284c7;
            border-radius: 9999px;
          }
          .ed-time-metrics {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 6px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 6px 8px;
            text-align: center;
          }
          .time-lbl {
            font-size: 6.5pt;
            color: #64748b;
            display: block;
          }
          .time-val {
            font-size: 8pt;
            font-weight: 800;
            color: #0f172a;
          }
          .ed-card-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 7pt;
          }
          .ed-status-tag {
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 4px;
          }
          .ed-status-tag.pass { background: #dcfce7; color: #166534; }
          .ed-status-tag.fail { background: #fee2e2; color: #991b1b; }

          /* Two col layout */
          .dash-two-col-layout {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
            margin-bottom: 16px;
          }
          .dash-panel-card {
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 14px;
            margin-bottom: 16px;
          }
          .panel-card-header {
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 8px;
            margin-bottom: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .panel-title {
            margin: 0;
            font-size: 11pt;
            font-weight: 800;
            color: #0f172a;
          }
          .panel-subtitle {
            font-size: 7.5pt;
            color: #64748b;
          }

          /* Compare bars */
          .compare-bars-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .compare-bar-item {
            display: flex;
            flex-direction: column;
            gap: 3px;
          }
          .compare-info-row {
            display: flex;
            justify-content: space-between;
            font-size: 7.5pt;
          }
          .compare-name { font-weight: 700; color: #0f172a; }
          .compare-time { color: #64748b; }
          .compare-bar-track {
            height: 6px;
            background: #e2e8f0;
            border-radius: 9999px;
            overflow: hidden;
          }
          /* Progress classes for popup */
          circle.progress-emerald, .gauge-circle-progress.progress-emerald { stroke: #10b981 !important; }
          div.progress-emerald, .progress-emerald:not(circle) {
            background: #10b981 !important;
            background-color: #10b981 !important;
            box-shadow: inset 0 0 0 1000px #10b981 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          circle.progress-blue, .gauge-circle-progress.progress-blue { stroke: #0284c7 !important; }
          div.progress-blue, .progress-blue:not(circle) {
            background: #0284c7 !important;
            background-color: #0284c7 !important;
            box-shadow: inset 0 0 0 1000px #0284c7 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          circle.progress-amber, .gauge-circle-progress.progress-amber { stroke: #f59e0b !important; }
          div.progress-amber, .progress-amber:not(circle) {
            background: #f59e0b !important;
            background-color: #f59e0b !important;
            box-shadow: inset 0 0 0 1000px #f59e0b !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          circle.progress-rose, .gauge-circle-progress.progress-rose { stroke: #ef4444 !important; }
          div.progress-rose, .progress-rose:not(circle) {
            background: #ef4444 !important;
            background-color: #ef4444 !important;
            box-shadow: inset 0 0 0 1000px #ef4444 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .kpi-progress-bar {
            height: 6px;
            background: #e2e8f0;
            border-radius: 9999px;
            overflow: hidden;
            margin-top: 6px;
          }
          .kpi-progress-fill {
            height: 100%;
            border-radius: 9999px;
            background: #0284c7;
            background-color: #0284c7;
            box-shadow: inset 0 0 0 1000px #0284c7 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .compare-bar-fill {
            height: 100%;
            border-radius: 9999px;
            background: #0284c7;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .compare-bar-fill.bg-emerald,
          .compare-bar-fill.pass,
          .bg-emerald {
            background: #10b981 !important;
            background-color: #10b981 !important;
            box-shadow: inset 0 0 0 1000px #10b981 !important;
          }
          .compare-bar-fill.bg-rose,
          .compare-bar-fill.fail,
          .bg-rose {
            background: #ef4444 !important;
            background-color: #ef4444 !important;
            box-shadow: inset 0 0 0 1000px #ef4444 !important;
          }

          /* Trend bars */
          .trend-bars-container {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            height: 140px;
            padding-top: 20px;
            gap: 8px;
          }
          .trend-bar-col {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            height: 100%;
          }
          .trend-bar-track {
            position: relative;
            width: 100%;
            flex: 1;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            background: #f8fafc;
            border-radius: 4px;
            border: 1px dashed #e2e8f0;
          }
          .target-threshold-line {
            position: absolute;
            left: 0;
            right: 0;
            border-top: 1.5px dashed #0284c7;
          }
          .trend-bar-fill {
            width: 70%;
            background: #0284c7;
            border-radius: 4px 4px 0 0;
            display: flex;
            justify-content: center;
            align-items: flex-start;
          }
          .bar-val-tooltip {
            font-size: 6.5pt;
            color: #ffffff;
            font-weight: 800;
            margin-top: 2px;
          }
          .trend-bar-label {
            font-size: 7.5pt;
            font-weight: 700;
            margin-top: 4px;
          }
          .trend-bar-sub {
            font-size: 6.5pt;
            color: #64748b;
          }

          /* Site ranking */
          .site-ranking-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }
          .site-card-rank {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 12px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
          }
          .rank-badge {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: #e2e8f0;
            font-weight: 800;
            font-size: 7.5pt;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 8px;
          }
          .rank-badge.top-1 { background: #fef08a; color: #854d0e; }
          .site-meta { flex: 1; }
          .site-name { font-size: 8pt; font-weight: 700; color: #0f172a; display: block; }
          .site-cases { font-size: 7pt; color: #64748b; }
          .site-score-val { font-size: 11pt; font-weight: 800; display: block; text-align: right; }
          .site-status-tag {
            font-size: 6.5pt;
            font-weight: 700;
            padding: 1px 5px;
            border-radius: 3px;
          }
          .site-status-tag.pass { background: #dcfce7; color: #166534; }
          .site-status-tag.fail { background: #fee2e2; color: #991b1b; }

          /* Signatures */
          .print-signature-section {
            margin-top: 24px;
            padding-top: 14px;
            border-top: 1px dashed #cbd5e1;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .sig-note {
            font-size: 7.5pt;
            color: #64748b;
            font-style: italic;
            margin-bottom: 16px;
            line-height: 1.4;
            text-align: center;
          }
          .sig-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            text-align: center;
          }
          .sig-box {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 8px;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            background: #fafafa;
          }
          .sig-role {
            font-size: 8pt;
            font-weight: 800;
            color: #0284c7;
            text-transform: uppercase;
            margin-bottom: 2px;
          }
          .sig-title {
            font-size: 7.5pt;
            color: #475569;
            margin-bottom: 45px;
            min-height: 22px;
          }
          .sig-line {
            width: 80%;
            border-bottom: 1px solid #0f172a;
            margin-bottom: 4px;
          }
          .sig-name {
            font-size: 8pt;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 2px;
          }
          .sig-date { font-size: 7pt; color: #64748b; }

          @page {
            size: A4 portrait;
            margin: 12mm 15mm 15mm 15mm;
          }
          @media print {
            .popup-bar { display: none !important; }
            html, body { background: #ffffff !important; }
            .paper-container {
              max-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
            }
            .dash-panel-card, .ed-indicator-card, .kpi-card, .sig-box, .dash-hero-banner {
              page-break-inside: avoid;
              break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="popup-bar no-print">
          <div>
            <strong>🖨️ Pratinjau Dokumen Cetak Laporan Mutu Pelayanan IGD</strong> &bull; Mayapada Hospital Healthcare Group
          </div>
          <div class="popup-bar-btns">
            <button class="btn-print-action" onclick="window.print()">🖨️ Cetak / Simpan PDF</button>
            <button class="btn-close-action" onclick="window.close()">✕ Tutup Jendela</button>
          </div>
        </div>
        <div class="paper-container">
          ${clone.innerHTML}
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.focus();
              window.print();
            }, 450);
          };
        </script>
      </body>
      </html>
    `);
    doc.close();
  }
}
