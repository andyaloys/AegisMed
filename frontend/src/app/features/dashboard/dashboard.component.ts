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
  sidebarCollapsed = false;
  mobileMenuOpen = false;
  mobileFormOpen = false;
  
  // Cases List State for active Indicator menu
  activeIndicatorSubmissions: any[] = [];
  loadingSubmissions = false;
  currentPage = 1;
  pageSize = 10;

  // Filters State
  selectedSiteId: string | undefined = undefined;
  filterStartMonth = '2026-01';
  filterEndMonth = '2026-06';

  getSelectedPeriodLabel(): string {
    const sParts = this.filterStartMonth.split('-');
    const eParts = this.filterEndMonth.split('-');
    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
    const startLabel = `${monthsShort[parseInt(sParts[1]) - 1]} ${sParts[0]}`;
    const endLabel = `${monthsShort[parseInt(eParts[1]) - 1]} ${eParts[0]}`;
    return `${startLabel} - ${endLabel}`;
  }

  // Form State
  hospitalSiteId = '11111111-1111-1111-1111-111111111111'; // Default to Jakarta Guid
  emrNumber = '';
  patientInitials = '';
  submissionMonth = '2026-06';
  indicatorType = ''; // Stores EdIndicator UUID

  getTodayDateString(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Separated Date & Time fields (Excel style)
  caseDate = this.getTodayDateString();      // YYYY-MM-DD
  doorTimeOnly = '';  // HH:MM
  eventTimeOnly = ''; // HH:MM

  // Cardiology Custom Fields (Removed)

  // Other Indicators Custom Fields (Default Questions)
  painScore = 5;
  analgesiaType = '';
  medicalDiagnosis = '';
  assessmentTimeOnly = '';
  radiologyAction = '';
  ctOrderTimeOnly = '';
  nihssScore = 0;
  diagnosticExam = '';
  requestTimeOnly = '';
  feverTimeOnly = '';
  antibioticName = '';
  prescriptionTimeOnly = '';
  triageLevel = '';

  clinicalNotes = '';

  previewMinutes: number | null = null;
  previewCompliant = false;

  submitting = false;
  submitSuccess = false;
  submitError = false;
  submitErrorMessage = '';

  // Edit & Delete state
  editingSubmission: any = null;
  showDeleteConfirm = false;
  deletingId: string | null = null;
  deleting = false;
  updating = false;
  updateSuccess = false;
  updateError = false;

  // CAPA state fields
  capaActions: any[] = [];
  loadingCapas = false;
  submittingCapa = false;
  capaSuccess = false;
  capaError = false;
  capaErrorMessage = '';
  showCapaFormModal = false;

  // CAPA form values
  newCapaTitle = '';
  newCapaDescription = '';
  newCapaSeverity = 'Low';
  newCapaStatus = 'Open';
  newCapaDueDate = '';
  newCapaAssignedTo = '';
  newCapaSiteId = '';
  newCapaRootCause = '';
  newCapaCorrectiveAction = '';
  newCapaPreventiveAction = '';
  newCapaActionPlan = '';

  // CAPA edit/delete fields
  editingCapa: any = null;
  showCapaDeleteConfirm = false;
  deletingCapaId: string | null = null;
  deletingCapa = false;
  updatingCapa = false;
  updateCapaSuccess = false;
  updateCapaError = false;

  // Generate CAPA state fields
  showGenerateCapaModal = false;
  genCapaSiteId = '';
  genCapaMonth = '2026-07';
  generatingCapa = false;
  genCapaSuccess = false;
  genCapaError = false;
  genCapaMessage = '';

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

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  getDateRange(): { start: string; end: string } {
    if (!this.filterStartMonth || !this.filterEndMonth) {
      return { start: '2026-01-01', end: '2026-12-31' };
    }
    try {
      const sParts = String(this.filterStartMonth).split('-');
      const eParts = String(this.filterEndMonth).split('-');
      const sYear = sParts[0];
      const sMonth = sParts[1];
      const eYear = eParts[0];
      const eMonth = eParts[1];
      const start = `${sYear}-${sMonth}-01`;
      const lastDay = new Date(parseInt(eYear), parseInt(eMonth), 0).getDate();
      const end = `${eYear}-${eMonth}-${String(lastDay).padStart(2, '0')}`;
      console.log('Calculated date range query parameters:', start, 'to', end);
      return { start, end };
    } catch (e) {
      console.error('Error calculating date range, using default:', e);
      return { start: '2026-01-01', end: '2026-12-31' };
    }
  }

  loadDashboardData(): void {
    this.loading = true;
    this.error = false;
    const { start, end } = this.getDateRange();
    this.dashboardService.getDashboardData(this.selectedSiteId, start, end).subscribe({
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
    // Keyword map: menu key → unique substring in indicator Name
    const keywordMap: Record<string, string> = {
      'cardiology':      'cardiology',
      'orthopaedics':    'orthopaedics',
      'neurology':       'neurology',
      'gastrohepatology':'gastrohepatology',
      'oncology':        'oncology',
      'mom-children':    'bidan'
    };
    const keyword = keywordMap[menu] ?? menu;
    return this.data.edIndicators.find(i => i.name.toLowerCase().includes(keyword.toLowerCase()))?.id;
  }


  switchMenu(menu: string): void {
    this.activeMenu = menu;
    this.mobileMenuOpen = false;
    this.currentPage = 1;
    this.resetForm();
    
    const indicatorKeys = ['cardiology', 'orthopaedics', 'neurology', 'gastrohepatology', 'oncology', 'mom-children'];

    if (indicatorKeys.includes(menu)) {
      const indicatorId = this.getIndicatorIdByMenu(menu);
      if (indicatorId) {
        this.indicatorType = indicatorId;
        this.loadIndicatorSubmissions(indicatorId);
      }
    } else if (menu === 'capas') {
      this.loadCapaActions();
    } else {
      this.loadDashboardData();
    }
  }

  toggleCategory(category: string): void {
    this.activeCategoryExpanded[category] = !this.activeCategoryExpanded[category];
  }

  loadIndicatorSubmissions(indicatorId: string): void {
    this.loadingSubmissions = true;
    this.dashboardService.getEdSubmissions(this.selectedSiteId, undefined, indicatorId).subscribe({
      next: (res) => {
        this.activeIndicatorSubmissions = res;
        this.loadingSubmissions = false;
        // Keep rates updated using the selected range
        const { start, end } = this.getDateRange();
        this.dashboardService.getDashboardData(this.selectedSiteId, start, end).subscribe(data => {
          this.data = data;
        });
      },
      error: (err) => {
        console.error(err);
        this.loadingSubmissions = false;
      }
    });
  }

  onDashboardDateFilterChange(): void {
    console.log('onDashboardDateFilterChange triggered: ', this.filterStartMonth, 'to', this.filterEndMonth);
    this.loadDashboardData();
  }

  onSiteFilterChange(): void {
    this.currentPage = 1;
    if (this.selectedSiteId) {
      this.hospitalSiteId = this.selectedSiteId;
    }
    const indicatorKeys = ['cardiology', 'orthopaedics', 'neurology', 'gastrohepatology', 'oncology', 'mom-children'];
    if (indicatorKeys.includes(this.activeMenu)) {
      const indicatorId = this.getIndicatorIdByMenu(this.activeMenu);
      if (indicatorId) {
        this.loadIndicatorSubmissions(indicatorId);
      }
    } else if (this.activeMenu === 'capas') {
      this.loadCapaActions();
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
    this.caseDate = this.getTodayDateString();
    this.doorTimeOnly = '';
    this.eventTimeOnly = '';
    this.clinicalNotes = '';
    


    // Default / other custom fields
    this.painScore = 5;
    this.analgesiaType = '';
    this.medicalDiagnosis = '';
    this.assessmentTimeOnly = '';
    this.radiologyAction = '';
    this.ctOrderTimeOnly = '';
    this.nihssScore = 0;
    this.diagnosticExam = '';
    this.requestTimeOnly = '';
    this.feverTimeOnly = '';
    this.antibioticName = '';
    this.prescriptionTimeOnly = '';
    this.triageLevel = '';

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

    if (this.activeMenu === 'orthopaedics' && !this.medicalDiagnosis) {
      this.submitError = true;
      this.submitErrorMessage = 'Mohon isi Diagnosa Medis untuk indikator Orthopaedics.';
      return;
    }

    if (this.activeMenu === 'neurology' && (!this.medicalDiagnosis || !this.radiologyAction)) {
      this.submitError = true;
      this.submitErrorMessage = 'Mohon isi Diagnosa Medis dan Tindakan Radiologi untuk indikator Neurology.';
      return;
    }

    if (this.activeMenu === 'gastrohepatology' && (!this.medicalDiagnosis || !this.diagnosticExam)) {
      this.submitError = true;
      this.submitErrorMessage = 'Mohon isi Diagnosa Medis dan Pemeriksaan Diagnostik untuk Gastrohepatology.';
      return;
    }

    const doorDateTime = new Date(`${this.caseDate}T${this.doorTimeOnly}:00`);
    let eventDateTime = new Date(`${this.caseDate}T${this.eventTimeOnly}:00`);
    
    if (eventDateTime < doorDateTime) {
      eventDateTime.setDate(eventDateTime.getDate() + 1);
    }

    // Build custom fields JSON
    const customFieldsObj: any = {};

    if (this.activeMenu === 'orthopaedics') {
      customFieldsObj.PainScore = this.painScore;
      customFieldsObj.MedicalDiagnosis = this.medicalDiagnosis;
      customFieldsObj.AssessmentTime = this.assessmentTimeOnly ? `${this.caseDate}T${this.assessmentTimeOnly}:00` : '';
    } else if (this.activeMenu === 'neurology') {
      customFieldsObj.MedicalDiagnosis = this.medicalDiagnosis;
      customFieldsObj.RadiologyAction = this.radiologyAction;
    } else if (this.activeMenu === 'gastrohepatology') {
      customFieldsObj.MedicalDiagnosis = this.medicalDiagnosis;
      customFieldsObj.DiagnosticExam = this.diagnosticExam;
      customFieldsObj.AssessmentTime = this.assessmentTimeOnly ? `${this.caseDate}T${this.assessmentTimeOnly}:00` : '';
      customFieldsObj.RequestTime = this.requestTimeOnly ? `${this.caseDate}T${this.requestTimeOnly}:00` : '';
    } else if (this.activeMenu === 'oncology') {
      customFieldsObj.MedicalDiagnosis = this.medicalDiagnosis;
      customFieldsObj.AntibioticType = this.antibioticName;
      customFieldsObj.AssessmentTime = this.assessmentTimeOnly ? `${this.caseDate}T${this.assessmentTimeOnly}:00` : '';
      customFieldsObj.PrescriptionTime = this.prescriptionTimeOnly ? `${this.caseDate}T${this.prescriptionTimeOnly}:00` : '';
    } else if (this.activeMenu === 'mom-children') {
      customFieldsObj.TriageLevel = this.triageLevel;
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
      submissionMonth: this.caseDate.slice(0, 7),
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
        this.closeMobileForm();
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
      case 'neurology': return 'Waktu CT scan/MRI diinisiasi';
      case 'gastrohepatology': return 'Waktu Pemeriksaan Diagnostik Dilakukan';
      case 'oncology': return 'Waktu Antibiotik Diberikan ke Pasien';
      case 'mom-children': return 'Waktu Bidan Terlatih Tiba di IGD';
      default: return 'Waktu Tindakan';
    }
  }

  getIndicatorTargetText(): string {
    const activeInd = this.data?.edIndicators.find(i => i.id === this.indicatorType);
    return activeInd ? activeInd.targetDescription : '';
  }

  getPaginatedSubmissions(): any[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.activeIndicatorSubmissions.slice(start, start + this.pageSize);
  }

  getTotalPages(): number {
    return Math.ceil(this.activeIndicatorSubmissions.length / this.pageSize) || 1;
  }

  setPage(page: number): void {
    this.currentPage = page;
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
  }

  getPageNumbers(): number[] {
    const total = this.getTotalPages();
    const pages: number[] = [];
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
    return pages;
  }

  getSelectedSiteName(): string {
    if (!this.selectedSiteId || !this.data || !this.data.siteCompliance) {
      return 'Semua Rumah Sakit';
    }
    const site = this.data.siteCompliance.find(s => s.siteId === this.selectedSiteId);
    return site ? site.siteName : 'Semua Rumah Sakit';
  }

  openMobileForm(): void {
    this.mobileFormOpen = true;
    this.submitSuccess = false;
    this.submitError = false;
    this.hospitalSiteId = this.selectedSiteId || '';
  }

  closeMobileForm(): void {
    this.mobileFormOpen = false;
  }

  // ── EDIT / DELETE ──────────────────────────────────────────────
  startEdit(sub: any): void {
    // Clone the submission into the edit state
    this.editingSubmission = { ...sub };
    // Pre-parse times for the form
    const door = new Date(sub.doorTime);
    const event = new Date(sub.eventTime);
    this.editingSubmission._caseDate   = door.toISOString().split('T')[0];
    this.editingSubmission._doorTime   = door.toTimeString().slice(0, 5);
    this.editingSubmission._eventTime  = event.toTimeString().slice(0, 5);
    // Parse customFields
    try {
      this.editingSubmission._custom = JSON.parse(sub.customFieldsJson || '{}');
      const getOnlyTime = (val: string) => {
        if (!val) return '';
        const tIdx = val.indexOf('T');
        if (tIdx !== -1) return val.slice(tIdx + 1, tIdx + 6);
        return val.length === 5 ? val : '';
      };
      if (this.editingSubmission._custom.AssessmentTime) {
        this.editingSubmission._custom._assessmentTimeOnly = getOnlyTime(this.editingSubmission._custom.AssessmentTime);
      }
      if (this.editingSubmission._custom.RequestTime) {
        this.editingSubmission._custom._requestTimeOnly = getOnlyTime(this.editingSubmission._custom.RequestTime);
      }
      if (this.editingSubmission._custom.PrescriptionTime) {
        this.editingSubmission._custom._prescriptionTimeOnly = getOnlyTime(this.editingSubmission._custom.PrescriptionTime);
      }
    } catch {
      this.editingSubmission._custom = {};
    }
    this.updateSuccess = false;
    this.updateError = false;
  }

  cancelEdit(): void {
    this.editingSubmission = null;
  }

  saveEdit(): void {
    if (!this.editingSubmission) return;
    const s = this.editingSubmission;
    const doorTime  = new Date(`${s._caseDate}T${s._doorTime}:00`);
    const eventTime = new Date(`${s._caseDate}T${s._eventTime}:00`);

    // Rebuild customFieldsJson format before payload submission
    const custom = s._custom || {};
    const formattedCustom: any = {};
    if (this.activeMenu === 'orthopaedics') {
      formattedCustom.PainScore = custom.PainScore;
      formattedCustom.MedicalDiagnosis = custom.MedicalDiagnosis;
      formattedCustom.AssessmentTime = custom._assessmentTimeOnly ? `${s._caseDate}T${custom._assessmentTimeOnly}:00` : '';
    } else if (this.activeMenu === 'neurology') {
      formattedCustom.MedicalDiagnosis = custom.MedicalDiagnosis;
      formattedCustom.RadiologyAction = custom.RadiologyAction;
    } else if (this.activeMenu === 'gastrohepatology') {
      formattedCustom.MedicalDiagnosis = custom.MedicalDiagnosis;
      formattedCustom.DiagnosticExam = custom.DiagnosticExam;
      formattedCustom.AssessmentTime = custom._assessmentTimeOnly ? `${s._caseDate}T${custom._assessmentTimeOnly}:00` : '';
      formattedCustom.RequestTime = custom._requestTimeOnly ? `${s._caseDate}T${custom._requestTimeOnly}:00` : '';
    } else if (this.activeMenu === 'oncology') {
      formattedCustom.MedicalDiagnosis = custom.MedicalDiagnosis;
      formattedCustom.AntibioticType = custom.AntibioticType;
      formattedCustom.AssessmentTime = custom._assessmentTimeOnly ? `${s._caseDate}T${custom._assessmentTimeOnly}:00` : '';
      formattedCustom.PrescriptionTime = custom._prescriptionTimeOnly ? `${s._caseDate}T${custom._prescriptionTimeOnly}:00` : '';
    } else if (this.activeMenu === 'mom-children') {
      formattedCustom.TriageLevel = custom.TriageLevel;
    }

    const payload = {
      hospitalSiteId:  s.hospitalSiteId,
      emrNumber:       s.emrNumber,
      patientInitials: s.patientInitials ?? '',
      submissionMonth: s._caseDate.slice(0, 7),
      edIndicatorId:   s.edIndicatorId,
      doorTime,
      eventTime,
      clinicalNotes:   s.clinicalNotes ?? '',
      customFieldsJson: JSON.stringify(formattedCustom)
    };
    this.updating = true;
    this.dashboardService.updateEdCase(s.id, payload).subscribe({
      next: () => {
        this.updating = false;
        this.updateSuccess = true;
        this.editingSubmission = null;
        // Reload table
        if (this.indicatorType) this.loadIndicatorSubmissions(this.indicatorType);
      },
      error: (err) => {
        this.updating = false;
        this.updateError = true;
        console.error(err);
      }
    });
  }

  confirmDelete(id: string): void {
    this.deletingId = id;
    this.showDeleteConfirm = true;
  }

  cancelDelete(): void {
    this.showDeleteConfirm = false;
    this.deletingId = null;
  }

  executeDelete(): void {
    if (!this.deletingId) return;
    this.deleting = true;
    this.dashboardService.deleteEdCase(this.deletingId).subscribe({
      next: () => {
        this.deleting = false;
        this.showDeleteConfirm = false;
        this.deletingId = null;
        if (this.indicatorType) this.loadIndicatorSubmissions(this.indicatorType);
      },
      error: (err) => {
        this.deleting = false;
        console.error(err);
      }
    });
  }

  getEditPreviewMinutes(): number | null {
    if (!this.editingSubmission) return null;
    const s = this.editingSubmission;
    if (s._caseDate && s._doorTime && s._eventTime) {
      const door = new Date(`${s._caseDate}T${s._doorTime}:00`);
      let event = new Date(`${s._caseDate}T${s._eventTime}:00`);
      if (event < door) {
        event.setDate(event.getDate() + 1);
      }
      return Math.round(((event.getTime() - door.getTime()) / 60000) * 10) / 10;
    }
    return null;
  }

  getEditPreviewCompliant(): boolean {
    const mins = this.getEditPreviewMinutes();
    if (mins === null) return false;
    const activeInd = this.data?.edIndicators.find(i => i.id === this.indicatorType);
    return activeInd ? mins <= activeInd.targetMinutes : false;
  }

  // ── CAPA ACTIONS CRUD ──────────────────────────────────────────────
  loadCapaActions(): void {
    this.loadingCapas = true;
    this.dashboardService.getCapaActions(this.selectedSiteId).subscribe({
      next: (res) => {
        this.capaActions = res;
        this.loadingCapas = false;
      },
      error: (err) => {
        console.error(err);
        this.loadingCapas = false;
      }
    });
  }

  openCapaModal(): void {
    this.showCapaFormModal = true;
    this.editingCapa = null;
    this.newCapaTitle = '';
    this.newCapaDescription = '';
    this.newCapaSeverity = 'Low';
    this.newCapaStatus = 'Open';
    this.newCapaDueDate = new Date().toISOString().split('T')[0];
    this.newCapaAssignedTo = '';
    this.newCapaSiteId = this.selectedSiteId || (this.data?.siteCompliance?.[0]?.siteId || '');
    this.newCapaRootCause = '';
    this.newCapaCorrectiveAction = '';
    this.newCapaPreventiveAction = '';
    this.newCapaActionPlan = '';
    this.capaSuccess = false;
    this.capaError = false;
  }

  closeCapaModal(): void {
    this.showCapaFormModal = false;
    this.editingCapa = null;
  }

  startEditCapa(capa: any): void {
    this.editingCapa = { ...capa };
    this.newCapaTitle = capa.title;
    this.newCapaDescription = capa.description;
    this.newCapaSeverity = capa.severity;
    this.newCapaStatus = capa.status;
    this.newCapaDueDate = capa.dueDate ? new Date(capa.dueDate).toISOString().split('T')[0] : '';
    this.newCapaAssignedTo = capa.assignedTo;
    this.newCapaSiteId = capa.hospitalSiteId;
    this.newCapaRootCause = capa.rootCause || '';
    this.newCapaCorrectiveAction = capa.correctiveAction || '';
    this.newCapaPreventiveAction = capa.preventiveAction || '';
    this.newCapaActionPlan = capa.actionPlan || '';
    this.showCapaFormModal = true;
    this.capaSuccess = false;
    this.capaError = false;
  }

  saveCapa(): void {
    if (!this.newCapaTitle || !this.newCapaSiteId || !this.newCapaDueDate) {
      this.capaError = true;
      this.capaErrorMessage = 'Mohon isi Judul, Rumah Sakit Site, dan Batas Waktu.';
      return;
    }

    const payload = {
      title: this.newCapaTitle,
      description: this.newCapaDescription,
      severity: this.newCapaSeverity,
      status: this.newCapaStatus,
      dueDate: new Date(this.newCapaDueDate).toISOString(),
      assignedTo: this.newCapaAssignedTo,
      hospitalSiteId: this.newCapaSiteId,
      rootCause: this.newCapaRootCause,
      correctiveAction: this.newCapaCorrectiveAction,
      preventiveAction: this.newCapaPreventiveAction,
      actionPlan: this.newCapaActionPlan
    };

    this.submittingCapa = true;
    this.capaError = false;

    if (this.editingCapa) {
      this.dashboardService.updateCapaAction(this.editingCapa.id, payload).subscribe({
        next: () => {
          this.submittingCapa = false;
          this.showCapaFormModal = false;
          this.editingCapa = null;
          this.loadCapaActions();
          this.loadDashboardData();
        },
        error: (err) => {
          this.submittingCapa = false;
          this.capaError = true;
          this.capaErrorMessage = err.error || 'Gagal mengubah tindakan CAPA.';
        }
      });
    } else {
      this.dashboardService.createCapaAction(payload).subscribe({
        next: () => {
          this.submittingCapa = false;
          this.showCapaFormModal = false;
          this.loadCapaActions();
          this.loadDashboardData();
        },
        error: (err) => {
          this.submittingCapa = false;
          this.capaError = true;
          this.capaErrorMessage = err.error || 'Gagal membuat tindakan CAPA.';
        }
      });
    }
  }

  confirmDeleteCapa(id: string): void {
    this.deletingCapaId = id;
    this.showCapaDeleteConfirm = true;
  }

  cancelDeleteCapa(): void {
    this.showCapaDeleteConfirm = false;
    this.deletingCapaId = null;
  }

  executeDeleteCapa(): void {
    if (!this.deletingCapaId) return;
    this.deletingCapa = true;
    this.dashboardService.deleteCapaAction(this.deletingCapaId).subscribe({
      next: () => {
        this.deletingCapa = false;
        this.showCapaDeleteConfirm = false;
        this.deletingCapaId = null;
        this.loadCapaActions();
        this.loadDashboardData();
      },
      error: (err) => {
        this.deletingCapa = false;
        console.error(err);
      }
    });
  }

  // ── GENERATE CAPA ACTIONS ──────────────────────────────────────────
  getMaxMonthForGeneration(): string {
    const today = new Date();
    // Previous month relative to current local time
    const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const year = prevMonth.getFullYear();
    const month = String(prevMonth.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  openGenerateCapaModal(): void {
    this.showGenerateCapaModal = true;
    this.genCapaSiteId = this.selectedSiteId || '';
    this.genCapaMonth = this.getMaxMonthForGeneration();
    this.genCapaSuccess = false;
    this.genCapaError = false;
  }

  closeGenerateCapaModal(): void {
    this.showGenerateCapaModal = false;
  }

  executeGenerateCapas(): void {
    if (!this.genCapaSiteId || !this.genCapaMonth) {
      this.genCapaError = true;
      this.genCapaMessage = 'Mohon lengkapi pilihan rumah sakit dan bulan.';
      return;
    }

    // Verify selected month is indeed in the past (before current month)
    const maxMonth = this.getMaxMonthForGeneration();
    if (stringToMonthValue(this.genCapaMonth) > stringToMonthValue(maxMonth)) {
      this.genCapaError = true;
      this.genCapaMessage = 'Anda hanya dapat meng-generate CAPA untuk bulan yang sudah lewat saja.';
      return;
    }

    this.generatingCapa = true;
    this.genCapaError = false;
    this.genCapaSuccess = false;

    this.dashboardService.generateCapas(this.genCapaSiteId, this.genCapaMonth).subscribe({
      next: (res: any) => {
        this.generatingCapa = false;
        this.genCapaSuccess = true;
        this.genCapaMessage = res.message || 'CAPA berhasil digenerate!';
        this.loadCapaActions();
        this.loadDashboardData();
        // Close modal after delay
        setTimeout(() => {
          this.showGenerateCapaModal = false;
        }, 3000);
      },
      error: (err) => {
        this.generatingCapa = false;
        this.genCapaError = true;
        this.genCapaMessage = err.error || 'Gagal meng-generate CAPA untuk periode ini.';
      }
    });
  }
}

// Helper function to convert YYYY-MM to numeric value for comparison
function stringToMonthValue(monthStr: string): number {
  const parts = monthStr.split('-');
  return parseInt(parts[0], 10) * 12 + parseInt(parts[1], 10);
}
