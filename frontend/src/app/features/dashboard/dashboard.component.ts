import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService, DashboardData, IndicatorSummaryDto } from '../../core/services/dashboard.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  data: DashboardData | null = null;
  loading = true;
  error = false;
  errorMessage = '';
  lastUpdated: Date = new Date();

  // Theme State
  theme: 'light' | 'dark' = 'light';

  // Navigation State
  activeMenu = 'overview';
  activeCategoryExpanded: { [key: string]: boolean } = {
    goldenHour: true,
    qualityAssurance: true
  };
  
  // Cases List State for active Indicator menu
  activeIndicatorSubmissions: any[] = [];
  loadingSubmissions = false;

  // Filters State
  selectedSiteId: string | undefined = undefined;
  selectedMonth: string = '2026-06';

  // Form State
  hospitalSiteId = '11111111-1111-1111-1111-111111111111'; // Default to Jakarta Guid
  emrNumber = '';
  patientInitials = '';
  submissionMonth = '2026-06';
  indicatorType = ''; // Stores EdIndicator UUID

  // Separated Date & Time fields (Excel style)
  caseDate = '';      // YYYY-MM-DD
  doorTimeOnly = '';  // HH:MM
  eventTimeOnly = ''; // HH:MM

  // Cardiology Custom Fields
  ecgInterpreter = '';
  isStemi = false;

  // Other Indicators Custom Fields (Default Questions)
  painScore = 5;
  analgesiaType = '';
  ctOrderTimeOnly = '';
  nihssScore = 0;
  consultTimeOnly = '';
  primaryDiagnosis = '';
  feverTimeOnly = '';
  antibioticName = '';

  clinicalNotes = '';

  previewMinutes: number | null = null;
  previewCompliant = false;

  submitting = false;
  submitSuccess = false;
  submitError = false;
  submitErrorMessage = '';

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    this.loadDashboardData();
    this.initTheme();
  }

  initTheme(): void {
    const savedTheme = localStorage.getItem('aegismed-theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      this.theme = savedTheme;
    } else {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.theme = prefersDark ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', this.theme);
  }

  toggleTheme(): void {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', this.theme);
    localStorage.setItem('aegismed-theme', this.theme);
  }

  loadDashboardData(): void {
    this.loading = true;
    this.error = false;
    this.dashboardService.getDashboardData(this.selectedSiteId).subscribe({
      next: (res) => {
        console.log('Site Compliance loaded in component:', res.siteCompliance);
        this.data = res;
        this.loading = false;
        this.lastUpdated = new Date();
      },
      error: (err) => {
        console.error(err);
        this.error = true;
        this.loading = false;
        this.errorMessage = 'Gagal terhubung ke API. Pastikan service backend .NET Core API sudah dijalankan.';
      }
    });
  }

  getIndicatorIdByMenu(menu: string): string | undefined {
    if (!this.data || !this.data.edIndicators) return undefined;
    return this.data.edIndicators.find(i => i.name.toLowerCase().includes(menu.toLowerCase()))?.id;
  }

  switchMenu(menu: string): void {
    this.activeMenu = menu;
    this.resetForm();
    
    const indicatorKeys = ['cardiology', 'orthopaedics', 'neurology', 'gastrohepatology', 'oncology'];

    if (indicatorKeys.includes(menu)) {
      const indicatorId = this.getIndicatorIdByMenu(menu);
      if (indicatorId) {
        this.indicatorType = indicatorId;
        this.loadIndicatorSubmissions(indicatorId);
      }
    } else {
      this.loadDashboardData();
    }
  }

  toggleCategory(category: string): void {
    this.activeCategoryExpanded[category] = !this.activeCategoryExpanded[category];
  }

  loadIndicatorSubmissions(indicatorId: string): void {
    this.loadingSubmissions = true;
    this.dashboardService.getEdSubmissions(this.selectedSiteId, this.selectedMonth, indicatorId).subscribe({
      next: (res) => {
        this.activeIndicatorSubmissions = res;
        this.loadingSubmissions = false;
        // Keep rates updated
        this.dashboardService.getDashboardData(this.selectedSiteId).subscribe(data => {
          console.log('Site Compliance updated in component:', data.siteCompliance);
          this.data = data;
        });
      },
      error: (err) => {
        console.error(err);
        this.loadingSubmissions = false;
      }
    });
  }

  onSiteFilterChange(): void {
    if (this.selectedSiteId) {
      this.hospitalSiteId = this.selectedSiteId;
    }
    const indicatorKeys = ['cardiology', 'orthopaedics', 'neurology', 'gastrohepatology', 'oncology'];
    if (indicatorKeys.includes(this.activeMenu)) {
      const indicatorId = this.getIndicatorIdByMenu(this.activeMenu);
      if (indicatorId) {
        this.loadIndicatorSubmissions(indicatorId);
      }
    } else {
      this.loadDashboardData();
    }
  }

  getFilteredSiteCompliance(): any[] {
    if (!this.data) return [];
    if (!this.selectedSiteId) return this.data.siteCompliance;
    return this.data.siteCompliance.filter(s => s.siteId === this.selectedSiteId);
  }


  getParsedCustomFields(jsonStr: string): any {
    try {
      return JSON.parse(jsonStr || '{}');
    } catch {
      return {};
    }
  }

  getCompliantCount(): number {
    return this.activeIndicatorSubmissions.filter(s => s.isCompliant).length;
  }

  getResolutionRate(): number {
    if (!this.data) return 0;
    const total = this.data.summary.totalCapa;
    if (total === 0) return 0;
    return Math.round((this.data.summary.resolvedCapa / total) * 100);
  }

  getScoreClass(score: number): string {
    if (score >= 90) return 'high-score';
    if (score >= 80) return 'med-score';
    return 'low-score';
  }

  getIndicatorPercent(ind: IndicatorSummaryDto): number {
    if (ind.unit === '%') {
      return ind.currentValue;
    }
    if (ind.target === 0) return 0;
    const ratio = (ind.currentValue / ind.target) * 100;
    return Math.min(Math.round(ratio), 100);
  }

  // ED Compliance Styling
  getEdComplianceClass(rate: number): string {
    if (rate >= 90) return 'success';
    if (rate >= 80) return 'warning';
    return 'danger';
  }

  resetForm(): void {
    this.emrNumber = '';
    this.patientInitials = '';
    this.caseDate = '';
    this.doorTimeOnly = '';
    this.eventTimeOnly = '';
    this.clinicalNotes = '';
    
    // Cardiology custom fields
    this.ecgInterpreter = '';
    this.isStemi = false;

    // Default / other custom fields
    this.painScore = 5;
    this.analgesiaType = '';
    this.ctOrderTimeOnly = '';
    this.nihssScore = 0;
    this.consultTimeOnly = '';
    this.primaryDiagnosis = '';
    this.feverTimeOnly = '';
    this.antibioticName = '';

    this.previewMinutes = null;
    this.submitSuccess = false;
    this.submitError = false;
  }

  onFormChange(): void {
    if (this.caseDate && this.doorTimeOnly && this.eventTimeOnly) {
      const doorDateTime = new Date(`${this.caseDate}T${this.doorTimeOnly}:00`);
      let eventDateTime = new Date(`${this.caseDate}T${this.eventTimeOnly}:00`);
      
      // Handle midnight crossing
      if (eventDateTime < doorDateTime) {
        eventDateTime.setDate(eventDateTime.getDate() + 1);
      }

      const diffMs = eventDateTime.getTime() - doorDateTime.getTime();
      const diffMins = Math.round((diffMs / 1000 / 60) * 10) / 10;
      this.previewMinutes = diffMins;

      const activeInd = this.data?.edIndicators.find(i => i.id === this.indicatorType);
      if (activeInd) {
        this.previewCompliant = diffMins <= activeInd.targetMinutes;
      } else {
        this.previewCompliant = false;
      }
    } else {
      this.previewMinutes = null;
    }
  }

  onSubmit(): void {
    if (!this.emrNumber || !this.caseDate || !this.doorTimeOnly || !this.eventTimeOnly) {
      this.submitError = true;
      this.submitErrorMessage = 'Mohon lengkapi seluruh field wajib (No Rekam Medis, Tanggal, Waktu Tiba, Waktu Tindakan).';
      return;
    }

    const doorDateTime = new Date(`${this.caseDate}T${this.doorTimeOnly}:00`);
    let eventDateTime = new Date(`${this.caseDate}T${this.eventTimeOnly}:00`);
    
    if (eventDateTime < doorDateTime) {
      eventDateTime.setDate(eventDateTime.getDate() + 1);
    }

    // Build custom fields JSON
    const customFieldsObj: any = {};

    if (this.activeMenu === 'cardiology') {
      customFieldsObj.EcgInterpreter = this.ecgInterpreter;
      customFieldsObj.IsStemi = this.isStemi;
    } else if (this.activeMenu === 'orthopaedics') {
      customFieldsObj.PainScore = this.painScore;
      customFieldsObj.AnalgesiaType = this.analgesiaType;
    } else if (this.activeMenu === 'neurology') {
      customFieldsObj.CtOrderTime = this.ctOrderTimeOnly ? `${this.caseDate}T${this.ctOrderTimeOnly}:00` : '';
      customFieldsObj.NihssScore = this.nihssScore;
    } else if (this.activeMenu === 'gastrohepatology') {
      customFieldsObj.ConsultTime = this.consultTimeOnly ? `${this.caseDate}T${this.consultTimeOnly}:00` : '';
      customFieldsObj.PrimaryDiagnosis = this.primaryDiagnosis;
    } else if (this.activeMenu === 'oncology') {
      customFieldsObj.FeverTime = this.feverTimeOnly ? `${this.caseDate}T${this.feverTimeOnly}:00` : '';
      customFieldsObj.AntibioticName = this.antibioticName;
    }

    // Validate that if target is not achieved, notes explaining why are mandatory!
    const diffMs = eventDateTime.getTime() - doorDateTime.getTime();
    const diffMins = diffMs / 1000 / 60;
    
    const activeInd = this.data?.edIndicators.find(i => i.id === this.indicatorType);
    const targetLimit = activeInd ? activeInd.targetMinutes : 10;

    const isAchieved = diffMins <= targetLimit;
    if (!isAchieved && !this.clinicalNotes) {
      this.submitError = true;
      this.submitErrorMessage = 'Mohon isi Keterangan / Catatan klinis mengapa target tidak tercapai.';
      return;
    }

    const payload = {
      hospitalSiteId: this.hospitalSiteId,
      emrNumber: this.emrNumber,
      patientInitials: this.patientInitials || 'XX',
      submissionMonth: this.submissionMonth,
      edIndicatorId: this.indicatorType,
      doorTime: doorDateTime.toISOString(),
      eventTime: eventDateTime.toISOString(),
      clinicalNotes: this.clinicalNotes,
      customFieldsJson: JSON.stringify(customFieldsObj)
    };

    this.submitting = true;
    this.submitError = false;
    this.submitSuccess = false;

    this.dashboardService.submitEdCase(payload).subscribe({
      next: (res) => {
        this.submitting = false;
        this.submitSuccess = true;
        this.resetForm();
        this.loadIndicatorSubmissions(this.indicatorType);
      },
      error: (err) => {
        console.error(err);
        this.submitting = false;
        this.submitError = true;
        this.submitErrorMessage = err.error || 'Terjadi kesalahan saat menyimpan data kasus.';
      }
    });
  }

  getEventTimeLabel(): string {
    switch (this.activeMenu) {
      case 'cardiology': return 'Waktu ECG Selesai & Diinterpretasi';
      case 'orthopaedics': return 'Waktu Pemberian Analgesik';
      case 'neurology': return 'Waktu CT Scan Selesai';
      case 'gastrohepatology': return 'Waktu Penegakan Diagnosis Awal';
      case 'oncology': return 'Waktu Pemberian Antibiotik';
      default: return 'Waktu Tindakan';
    }
  }

  getIndicatorTargetText(): string {
    const activeInd = this.data?.edIndicators.find(i => i.id === this.indicatorType);
    return activeInd ? activeInd.targetDescription : '';
  }
}
