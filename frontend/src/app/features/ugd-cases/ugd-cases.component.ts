import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { combineLatest, Subscription } from 'rxjs';
import { DashboardService, DashboardData } from '../../core/services/dashboard.service';

@Component({
  selector: 'app-ugd-cases',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ugd-cases.component.html',
  styleUrls: []
})
export class UgdCasesComponent implements OnInit, OnDestroy {
  data: DashboardData | null = null;
  loading = true;
  error = false;
  errorMessage = '';

  // Active indicator & site
  indicatorType = ''; // stores EdIndicator UUID
  selectedSiteId: string | undefined = undefined;

  // Case submissions
  activeIndicatorSubmissions: any[] = [];
  loadingSubmissions = false;
  currentPage = 1;
  pageSize = 10;

  // Local independent date filters for individual indicator pages
  filterStartMonth = '2026-01';
  filterEndMonth = '2026-06';

  // Sidebar configuration / configuration data (needed for site options)
  private routeSub: Subscription | null = null;

  // Form State
  hospitalSiteId = ''; 
  emrNumber = '';
  patientInitials = '';
  caseDate = ''; // YYYY-MM-DD
  doorTimeOnly = '';  // HH:MM
  eventTimeOnly = ''; // HH:MM

  // Indicator Custom Fields
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

  // Form validation & status
  previewMinutes: number | null = null;
  previewCompliant = false;
  submitting = false;
  submitSuccess = false;
  submitError = false;
  submitErrorMessage = '';

  // Mobile / desktop input form popup modal status
  mobileFormOpen = false;

  // Edit State
  editingSubmission: any = null;
  updating = false;
  updateSuccess = false;
  updateError = false;

  // Delete State
  showDeleteConfirm = false;
  deletingId: string | null = null;
  deleting = false;

  constructor(
    private route: ActivatedRoute,
    private dashboardService: DashboardService
  ) {}

  ngOnInit(): void {
    this.caseDate = this.getTodayDateString();
    
    // Initialize local date filters with defaults from the global service
    this.filterStartMonth = this.dashboardService.getFilterStartMonth();
    this.filterEndMonth = this.dashboardService.getFilterEndMonth();
    
    // Reactively combine Route Parameter changes and Global Site Filter changes
    this.routeSub = combineLatest([
      this.route.paramMap,
      this.dashboardService.selectedSiteId$
    ]).subscribe(([params, siteId]) => {
      const indId = params.get('indicatorId');
      this.selectedSiteId = siteId;
      if (indId) {
        this.indicatorType = indId;
        this.currentPage = 1;
        this.loadLayoutData();
        this.loadIndicatorSubmissions(indId);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.routeSub) {
      this.routeSub.unsubscribe();
    }
  }

  getTodayDateString(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  loadLayoutData(): void {
    this.dashboardService.getDashboardData(
      this.selectedSiteId,
      this.filterStartMonth,
      this.filterEndMonth
    ).subscribe({
      next: (res) => {
        this.data = res;
      },
      error: (err) => console.error(err)
    });
  }

  loadIndicatorSubmissions(indicatorId: string): void {
    this.loadingSubmissions = true;
    this.dashboardService.getEdSubmissions(
      this.selectedSiteId,
      undefined, // all months, filtered in UI or range
      indicatorId,
      this.filterStartMonth,
      this.filterEndMonth
    ).subscribe({
      next: (res) => {
        this.activeIndicatorSubmissions = res;
        this.loadingSubmissions = false;
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.error = true;
        this.errorMessage = 'Gagal memuat daftar kasus UGD.';
        this.loadingSubmissions = false;
        this.loading = false;
      }
    });
  }

  onDateFilterChange(): void {
    this.currentPage = 1;
    this.loadLayoutData();
    this.loadIndicatorSubmissions(this.indicatorType);
  }

  onFormChange(): void {
    if (this.caseDate && this.doorTimeOnly && this.eventTimeOnly) {
      const door = new Date(`${this.caseDate}T${this.doorTimeOnly}:00`);
      let event = new Date(`${this.caseDate}T${this.eventTimeOnly}:00`);
      
      if (event < door) {
        event.setDate(event.getDate() + 1); // spans to next day
      }
      
      const diffMs = event.getTime() - door.getTime();
      const diffMins = diffMs / 1000 / 60;
      this.previewMinutes = Math.round(diffMins * 10) / 10;
      
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

    const customFieldsObj: any = {};
    const activeIndCode = this.getIndicatorCode();

    if (activeIndCode === 'orthopaedics') {
      customFieldsObj.PainScore = this.painScore;
      customFieldsObj.MedicalDiagnosis = this.medicalDiagnosis;
      customFieldsObj.AssessmentTime = this.assessmentTimeOnly ? `${this.caseDate}T${this.assessmentTimeOnly}:00` : '';
    } else if (activeIndCode === 'neurology') {
      customFieldsObj.MedicalDiagnosis = this.medicalDiagnosis;
      customFieldsObj.RadiologyAction = this.radiologyAction;
    } else if (activeIndCode === 'gastrohepatology') {
      customFieldsObj.MedicalDiagnosis = this.medicalDiagnosis;
      customFieldsObj.DiagnosticExam = this.diagnosticExam;
      customFieldsObj.AssessmentTime = this.assessmentTimeOnly ? `${this.caseDate}T${this.assessmentTimeOnly}:00` : '';
      customFieldsObj.RequestTime = this.requestTimeOnly ? `${this.caseDate}T${this.requestTimeOnly}:00` : '';
    } else if (activeIndCode === 'oncology') {
      customFieldsObj.MedicalDiagnosis = this.medicalDiagnosis;
      customFieldsObj.AntibioticType = this.antibioticName;
      customFieldsObj.AssessmentTime = this.assessmentTimeOnly ? `${this.caseDate}T${this.assessmentTimeOnly}:00` : '';
      customFieldsObj.PrescriptionTime = this.prescriptionTimeOnly ? `${this.caseDate}T${this.prescriptionTimeOnly}:00` : '';
    } else if (activeIndCode === 'mom-children') {
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
      next: () => {
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

  resetForm(): void {
    this.emrNumber = '';
    this.patientInitials = '';
    this.caseDate = this.getTodayDateString();
    this.doorTimeOnly = '';
    this.eventTimeOnly = '';
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
    this.clinicalNotes = '';
    this.previewMinutes = null;
  }

  // Edit cases
  startEdit(sub: any): void {
    this.editingSubmission = { ...sub };
    const door = new Date(sub.doorTime);
    const event = new Date(sub.eventTime);
    this.editingSubmission._caseDate   = door.toISOString().split('T')[0];
    this.editingSubmission._doorTime   = door.toTimeString().slice(0, 5);
    this.editingSubmission._eventTime  = event.toTimeString().slice(0, 5);
    
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
    const activeIndCode = this.getIndicatorCode();

    const custom = s._custom || {};
    const formattedCustom: any = {};
    if (activeIndCode === 'orthopaedics') {
      formattedCustom.PainScore = custom.PainScore;
      formattedCustom.MedicalDiagnosis = custom.MedicalDiagnosis;
      formattedCustom.AssessmentTime = custom._assessmentTimeOnly ? `${s._caseDate}T${custom._assessmentTimeOnly}:00` : '';
    } else if (activeIndCode === 'neurology') {
      formattedCustom.MedicalDiagnosis = custom.MedicalDiagnosis;
      formattedCustom.RadiologyAction = custom.RadiologyAction;
    } else if (activeIndCode === 'gastrohepatology') {
      formattedCustom.MedicalDiagnosis = custom.MedicalDiagnosis;
      formattedCustom.DiagnosticExam = custom.DiagnosticExam;
      formattedCustom.AssessmentTime = custom._assessmentTimeOnly ? `${s._caseDate}T${custom._assessmentTimeOnly}:00` : '';
      formattedCustom.RequestTime = custom._requestTimeOnly ? `${s._caseDate}T${custom._requestTimeOnly}:00` : '';
    } else if (activeIndCode === 'oncology') {
      formattedCustom.MedicalDiagnosis = custom.MedicalDiagnosis;
      formattedCustom.AntibioticType = custom.AntibioticType;
      formattedCustom.AssessmentTime = custom._assessmentTimeOnly ? `${s._caseDate}T${custom._assessmentTimeOnly}:00` : '';
      formattedCustom.PrescriptionTime = custom._prescriptionTimeOnly ? `${s._caseDate}T${custom._prescriptionTimeOnly}:00` : '';
    } else if (activeIndCode === 'mom-children') {
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
        this.loadIndicatorSubmissions(this.indicatorType);
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
        this.loadIndicatorSubmissions(this.indicatorType);
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

  // UI Helpers
  getEventTimeLabel(): string {
    const code = this.getIndicatorCode();
    switch (code) {
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

  getIndicatorTitle(): string {
    const activeInd = this.data?.edIndicators.find(i => i.id === this.indicatorType);
    return activeInd ? activeInd.name : 'Waktu Tindakan';
  }

  getIndicatorCode(): string {
    const activeInd = this.data?.edIndicators.find(i => i.id === this.indicatorType);
    if (!activeInd) return '';
    const nameLower = activeInd.name.toLowerCase();
    if (nameLower.includes('ecg') || nameLower.includes('cardiology')) return 'cardiology';
    if (nameLower.includes('analgesia') || nameLower.includes('orthopaedics')) return 'orthopaedics';
    if (nameLower.includes('ct') || nameLower.includes('neurology')) return 'neurology';
    if (nameLower.includes('gastro') || nameLower.includes('diag')) return 'gastrohepatology';
    if (nameLower.includes('oncology') || nameLower.includes('antibiotic')) return 'oncology';
    if (nameLower.includes('mom') || nameLower.includes('bidan')) return 'mom-children';
    return '';
  }

  getScoreClass(score: number): string {
    if (score >= 90) return 'score-green';
    if (score >= 80) return 'score-amber';
    return 'score-red';
  }

  getEdComplianceClass(rate: number): string {
    if (rate >= 90) return 'success';
    if (rate >= 80) return 'warning';
    return 'danger';
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

  getAchievedCount(): number {
    return this.activeIndicatorSubmissions.filter(s => s.isCompliant).length;
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

  getCustomFieldValue(jsonStr: string, field: string): string {
    try {
      const obj = JSON.parse(jsonStr || '{}');
      return obj[field] ?? '-';
    } catch {
      return '-';
    }
  }

  getCustomFieldTime(jsonStr: string, field: string): string {
    try {
      const obj = JSON.parse(jsonStr || '{}');
      const val = obj[field];
      if (!val) return '-';
      const tIdx = val.indexOf('T');
      return tIdx !== -1 ? val.slice(tIdx + 1, tIdx + 16).replace('T', ' ') : val;
    } catch {
      return '-';
    }
  }
}
