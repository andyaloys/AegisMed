import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { combineLatest, Subscription } from 'rxjs';
import * as XLSX from 'xlsx';
import { NsiAuditService, NsiDashboardDto } from '../../core/services/nsi-audit.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { AuthService, UserProfile } from '../../core/services/auth.service';
import { UserManagementService, HospitalSiteDto, HospitalUnitDto } from '../../core/services/user-management.service';

@Component({
  selector: 'app-nsi-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './nsi-dashboard.component.html',
  styleUrls: ['./nsi-dashboard.component.css']
})
export class NsiDashboardComponent implements OnInit, OnDestroy {
  loading = true;
  error = false;
  errorMessage = '';

  currentUser: UserProfile | null = null;
  dashboardData: NsiDashboardDto | null = null;

  // Filters
  filterMonth = '2026-10';
  selectedSiteId: string | undefined = undefined;
  selectedUnitId: string | undefined = undefined;
  activeCategoryFilter = 'ALL';
  searchQuery = '';
  statusFilterTab: 'ALL' | 'MET' | 'NEED_PDSA' = 'ALL';

  sites: HospitalSiteDto[] = [];
  units: HospitalUnitDto[] = [];

  private subs = new Subscription();

  availableMonths: string[] = ['2026-10'];

  constructor(
    private nsiService: NsiAuditService,
    private dashboardService: DashboardService,
    public authService: AuthService,
    private userService: UserManagementService
  ) {}

  ngOnInit(): void {
    // Default to active audit month '2026-10'
    this.filterMonth = '2026-10';

    // Load sites and units for filter options
    this.userService.getSites().subscribe({
      next: (res) => this.sites = res,
      error: (err) => console.error('Failed to load sites', err)
    });

    this.subs.add(
      this.authService.currentUser$.subscribe(u => {
        this.currentUser = u;
        if (u && !this.authService.isCorporate && !this.authService.isAdmin && u.hospitalSiteId) {
          this.selectedSiteId = u.hospitalSiteId;
          this.loadUnitsForSite(u.hospitalSiteId);
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
          if (this.selectedSiteId) {
            this.loadUnitsForSite(this.selectedSiteId);
          } else {
            this.units = [];
            this.selectedUnitId = undefined;
          }
        }
        // Only load dashboard, do not force override with 2026-12
        this.loadDashboard();
      })
    );
  }

  setPeriod(period: string): void {
    this.filterMonth = period;
    this.loadDashboard();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  loadUnitsForSite(siteId: string): void {
    this.userService.getUnits(siteId).subscribe({
      next: (res) => this.units = res,
      error: (err) => console.error('Failed to load units', err)
    });
  }

  onSiteChange(): void {
    this.selectedUnitId = undefined;
    if (this.selectedSiteId) {
      this.loadUnitsForSite(this.selectedSiteId);
    } else {
      this.units = [];
    }
    this.loadDashboard();
  }

  onFilterChange(): void {
    this.loadDashboard();
  }

  analyticsCharts: {
    pt: any;
    risk: any;
    init: any;
    reassess: any;
  } | null = null;

  loadDashboard(): void {
    this.loading = true;
    this.error = false;

    this.nsiService.getNsiDashboard(
      this.filterMonth,
      this.selectedSiteId,
      this.selectedUnitId
    ).subscribe({
      next: (res) => {
        this.dashboardData = res;
        if (res.availableMonths && res.availableMonths.length) {
          this.availableMonths = res.availableMonths;
        }
        if (res.periodMonth && res.periodMonth !== 'ALL' && this.filterMonth !== 'ALL') {
          this.filterMonth = res.periodMonth;
        }
        this.computeAnalyticsCharts();
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load NSI dashboard data', err);
        this.error = true;
        this.errorMessage = err.error?.message || 'Gagal memuat data dashboard mutu keperawatan.';
        this.loading = false;
      }
    });
  }

  computeAnalyticsCharts(): void {
    const a = this.dashboardData?.auditAnalytics;
    const pt1 = a?.patientType?.inPatientCount ?? 1745;
    const pt2 = a?.patientType?.outPatientCount ?? 937;
    const r1 = a?.riskScreening?.yesCount ?? 2600;
    const r2 = a?.riskScreening?.noCount ?? 15;
    const i1 = a?.initialAssessment?.yesCount ?? 3607;
    const i2 = a?.initialAssessment?.noCount ?? 626;
    const re1 = a?.reAssessment?.yesCount ?? 2850;
    const re2 = a?.reAssessment?.noCount ?? 265;

    this.analyticsCharts = {
      pt: this.getPieChartData(pt1, pt2, 170, 130, 68),
      risk: this.getPieChartData(r1, r2, 170, 130, 68),
      init: this.getPieChartData(i1, i2, 170, 130, 68),
      reassess: this.getPieChartData(re1, re2, 170, 130, 68)
    };
  }

  get filteredIndicators(): any[] {
    if (!this.dashboardData || !this.dashboardData.indicators) return [];
    let list = this.dashboardData.indicators;

    if (this.activeCategoryFilter !== 'ALL') {
      list = list.filter(i => i.categoryCode === this.activeCategoryFilter || i.categoryId === this.activeCategoryFilter);
    }

    if (this.statusFilterTab === 'MET') {
      list = list.filter(i => i.isTargetMet);
    } else if (this.statusFilterTab === 'NEED_PDSA') {
      list = list.filter(i => i.needsPdsa);
    }

    if (this.searchQuery && this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter(i =>
        i.indicatorName.toLowerCase().includes(q) ||
        i.indicatorCode.toLowerCase().includes(q) ||
        i.categoryName.toLowerCase().includes(q)
      );
    }

    return list;
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

  getGaugeDashOffset(rate: number): number {
    const circumference = 2 * Math.PI * 54; // ~339.29
    const clamped = Math.min(Math.max(rate, 0), 100);
    return circumference - (clamped / 100) * circumference;
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

    const printElement = document.getElementById('nsiPrintArea');
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
        <title>Cetak Laporan Mutu Keperawatan (NSI) - Mayapada Hospital</title>
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

          /* Two col layout */
          .dash-two-col-layout {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
            margin-bottom: 16px;
          }
          .dash-panel-card, .dash-table-card {
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 14px;
            margin-bottom: 16px;
          }
          .panel-card-header, .table-card-header {
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
          .benchmark-line-legend {
            font-size: 7.5pt;
            font-weight: 700;
            color: #0284c7;
          }

          /* Progress cards */
          .cat-progress-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 8px 10px;
            margin-bottom: 8px;
          }
          .cat-card-header {
            display: flex;
            justify-content: space-between;
            font-size: 8pt;
            margin-bottom: 4px;
          }
          .cat-code-badge {
            background: #e2e8f0;
            font-size: 7pt;
            font-weight: 700;
            padding: 1px 5px;
            border-radius: 3px;
            margin-right: 4px;
          }
          .cat-title { font-weight: 700; color: #0f172a; }
          .score-percent { font-weight: 800; color: #0284c7; }
          .cat-progress-track {
            height: 6px;
            background: #e2e8f0;
            border-radius: 9999px;
            overflow: hidden;
            margin-bottom: 4px;
          }
          .cat-progress-bar {
            height: 100%;
            background: #0284c7;
            border-radius: 9999px;
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
          .kpi-progress-fill.bg-blue {
            background: #0284c7 !important;
            background-color: #0284c7 !important;
            box-shadow: inset 0 0 0 1000px #0284c7 !important;
          }
          .kpi-progress-fill.bg-emerald {
            background: #10b981 !important;
            background-color: #10b981 !important;
            box-shadow: inset 0 0 0 1000px #10b981 !important;
          }
          .cat-card-footer {
            display: flex;
            justify-content: space-between;
            font-size: 7pt;
            color: #64748b;
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

          /* Table */
          .table-responsive { width: 100%; overflow: visible; }
          .nsi-dash-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8pt;
          }
          .nsi-dash-table th {
            background: #f1f5f9;
            color: #0f172a;
            border: 1px solid #cbd5e1;
            padding: 6px 8px;
            font-weight: 700;
            text-align: left;
          }
          .nsi-dash-table td {
            border: 1px solid #e2e8f0;
            padding: 6px 8px;
            color: #1e293b;
          }
          .text-center { text-align: center !important; }
          .font-mono { font-family: monospace; }
          .code-pill {
            background: #e2e8f0;
            padding: 1px 5px;
            border-radius: 3px;
            font-weight: 700;
            font-size: 7.5pt;
          }
          .cat-pill {
            background: #f8fafc;
            color: #475569;
            font-size: 7pt;
            padding: 2px 6px;
            border-radius: 4px;
            border: 1px solid #e2e8f0;
          }
          .status-pill {
            display: inline-block;
            padding: 2px 6px;
            font-size: 7pt;
            font-weight: 700;
            border-radius: 4px;
          }
          .status-pill.green { background: #dcfce7; color: #166534; }
          .status-pill.red { background: #fee2e2; color: #991b1b; }
          .status-pill.gray { background: #f1f5f9; color: #64748b; }
          .text-emerald { color: #10b981; }
          .text-rose { color: #ef4444; }

          /* Unit ranking */
          .unit-ranking-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }
          .unit-card-rank {
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
          .unit-meta { flex: 1; }
          .unit-name { font-size: 8pt; font-weight: 700; color: #0f172a; display: block; }
          .unit-site { font-size: 7pt; color: #64748b; }
          .unit-score-val { font-size: 11pt; font-weight: 800; display: block; text-align: right; }
          .unit-status-tag {
            font-size: 6.5pt;
            font-weight: 700;
            padding: 1px 5px;
            border-radius: 3px;
          }
          .unit-status-tag.pass { background: #dcfce7; color: #166534; }
          .unit-status-tag.fail { background: #fee2e2; color: #991b1b; }

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
            .dash-panel-card, .dash-table-card, .kpi-card, .sig-box, .dash-hero-banner {
              page-break-inside: avoid;
              break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="popup-bar no-print">
          <div>
            <strong>🖨️ Pratinjau Dokumen Cetak Laporan NSI</strong> &bull; Mayapada Hospital Healthcare Group
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

  getPieChartData(val1: number, val2: number, cx = 200, cy = 135, r = 80) {
    const total = val1 + val2;
    if (total === 0) {
      return {
        total: 0,
        val1: 0,
        pct1: 0,
        val2: 0,
        pct2: 0,
        path1: '',
        path2: '',
        line1: '',
        label1X: 0,
        label1Y: 0,
        anchor1: 'middle',
        line2: '',
        label2X: 0,
        label2Y: 0,
        anchor2: 'middle'
      };
    }

    const pct1 = Math.round((val1 / total) * 10000) / 100;
    const pct2 = Math.round((val2 / total) * 10000) / 100;

    // Angle in degrees & radians
    const angle1 = Math.min(359.9, Math.max(0.1, (val1 / total) * 360));
    const rad1 = (angle1 - 90) * (Math.PI / 180);
    const startRad = -90 * (Math.PI / 180);

    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);

    const x2 = cx + r * Math.cos(rad1);
    const y2 = cy + r * Math.sin(rad1);

    const largeArc1 = angle1 > 180 ? 1 : 0;
    const path1 = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc1} 1 ${x2} ${y2} Z`;

    const largeArc2 = (360 - angle1) > 180 ? 1 : 0;
    const path2 = `M ${cx} ${cy} L ${x2} ${y2} A ${r} ${r} 0 ${largeArc2} 1 ${x1} ${y1} Z`;

    // Leader lines angles
    const midAngle1 = (angle1 / 2 - 90) * (Math.PI / 180);
    const midAngle2 = (angle1 + (360 - angle1) / 2 - 90) * (Math.PI / 180);

    // Callout coordinates for slice 1
    const p1x = cx + r * Math.cos(midAngle1);
    const p1y = cy + r * Math.sin(midAngle1);
    const elbow1x = cx + (r + 26) * Math.cos(midAngle1);
    const elbow1y = cy + (r + 26) * Math.sin(midAngle1);
    const isRight1 = Math.cos(midAngle1) >= 0;
    const end1x = elbow1x + (isRight1 ? 32 : -32);
    const end1y = elbow1y;

    // Callout coordinates for slice 2
    const p2x = cx + r * Math.cos(midAngle2);
    const p2y = cy + r * Math.sin(midAngle2);
    const elbow2x = cx + (r + 26) * Math.cos(midAngle2);
    const elbow2y = cy + (r + 26) * Math.sin(midAngle2);
    const isRight2 = Math.cos(midAngle2) >= 0;
    const end2x = elbow2x + (isRight2 ? 32 : -32);
    const end2y = elbow2y;

    return {
      total,
      val1,
      pct1,
      val2,
      pct2,
      path1,
      path2,
      line1: `${p1x},${p1y} ${elbow1x},${elbow1y} ${end1x},${end1y}`,
      label1X: isRight1 ? end1x + 6 : end1x - 6,
      label1Y: end1y + 4,
      anchor1: isRight1 ? 'start' : 'end',
      line2: `${p2x},${p2y} ${elbow2x},${elbow2y} ${end2x},${end2y}`,
      label2X: isRight2 ? end2x + 6 : end2x - 6,
      label2Y: end2y + 4,
      anchor2: isRight2 ? 'start' : 'end'
    };
  }
}
