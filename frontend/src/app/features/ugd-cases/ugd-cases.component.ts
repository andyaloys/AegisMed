import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { combineLatest, Subscription } from 'rxjs';
import * as XLSX from 'xlsx';
import { DashboardService, DashboardData } from '../../core/services/dashboard.service';
import { AuthService, UserProfile } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-ugd-cases',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './ugd-cases.component.html',
  styleUrls: ['./ugd-cases.component.css']
})
export class UgdCasesComponent implements OnInit, OnDestroy {
  data: DashboardData | null = null;
  loading = true;
  error = false;
  errorMessage = '';

  // Current User & Role State
  currentUser: UserProfile | null = null;

  // Active indicator & site
  indicatorType = ''; // stores EdIndicator UUID
  selectedSiteId: string | undefined = undefined;

  // Case submissions
  activeIndicatorSubmissions: any[] = [];
  loadingSubmissions = false;
  currentPage = 1;
  pageSize = 10;

  // Local independent date filters for individual indicator pages (Full day-level range)
  filterStartDate = '2026-01-01';
  filterEndDate = '2026-06-30';
  filterStartMonth = '2026-01';
  filterEndMonth = '2026-06';
  searchQuery = '';
  statusFilter: 'ALL' | 'COMPLIANT' | 'OVERDUE' = 'ALL';

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

  workflowProcessing = false;

  get isAdmin(): boolean {
    return this.authService.isAdmin || this.currentUser?.roleName === 'Admin';
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dashboardService: DashboardService,
    public authService: AuthService,
    public notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.caseDate = this.getTodayDateString();
    this.authService.currentUser$.subscribe(u => this.currentUser = u);
    
    // Initialize local date filters with full day-level defaults
    const sMonth = this.dashboardService.getFilterStartMonth() || '2026-01';
    const eMonth = this.dashboardService.getFilterEndMonth() || '2026-12';
    this.filterStartMonth = sMonth;
    this.filterEndMonth = eMonth;
    this.filterStartDate = `${sMonth}-01`;
    const [eYear, eM] = eMonth.split('-').map(Number);
    const lastDay = new Date(eYear, eM, 0).getDate();
    this.filterEndDate = `${eMonth}-${String(lastDay).padStart(2, '0')}`;
    
    // Reactively combine Route Parameter changes, Global Site Filter, and Date Range changes
    this.routeSub = combineLatest([
      this.route.paramMap,
      this.dashboardService.selectedSiteId$,
      this.dashboardService.dateFilter$
    ]).subscribe(([params, siteId, dates]) => {
      const indId = params.get('indicatorId');
      this.selectedSiteId = (!siteId || siteId === 'undefined' || siteId === 'null') ? undefined : siteId;
      
      if (dates) {
        this.filterStartMonth = dates.start || '2026-01';
        this.filterEndMonth = dates.end || '2026-12';
        this.filterStartDate = `${this.filterStartMonth}-01`;
        const [y, m] = this.filterEndMonth.split('-').map(Number);
        const lDay = new Date(y, m, 0).getDate();
        this.filterEndDate = `${this.filterEndMonth}-${String(lDay).padStart(2, '0')}`;
      }

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
    const cleanSiteId = (!this.selectedSiteId || this.selectedSiteId === 'undefined' || this.selectedSiteId === 'null') 
      ? undefined 
      : this.selectedSiteId;
    this.selectedSiteId = cleanSiteId;

    this.dashboardService.getDashboardData(
      cleanSiteId,
      this.filterStartDate,
      this.filterEndDate
    ).subscribe({
      next: (res) => {
        this.data = res;
      },
      error: (err) => console.error(err)
    });
  }

  loadIndicatorSubmissions(indicatorId: string): void {
    this.loadingSubmissions = true;
    const cleanSiteId = (!this.selectedSiteId || this.selectedSiteId === 'undefined' || this.selectedSiteId === 'null') 
      ? undefined 
      : this.selectedSiteId;
    this.selectedSiteId = cleanSiteId;

    this.dashboardService.getEdSubmissions(
      cleanSiteId,
      undefined, // all months, filtered in UI or range
      indicatorId,
      this.filterStartDate,
      this.filterEndDate
    ).subscribe({
      next: (res) => {
        this.activeIndicatorSubmissions = Array.isArray(res) ? res : [];
        this.loadingSubmissions = false;
        this.loading = false;
        this.error = false;
      },
      error: (err) => {
        console.error(err);
        this.activeIndicatorSubmissions = [];
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
      customFieldsJson: JSON.stringify(customFieldsObj),
      submittedById: this.currentUser?.id
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

  // Edit cases - navigate directly to dedicated edit page
  startEdit(sub: any): void {
    if (!sub || !sub.id) return;
    this.router.navigate(['/ugd-cases', this.indicatorType, 'edit', sub.id]);
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

  // Stepper Row Expansion
  expandedRowId: string | null = null;

  toggleRowExpand(rowId: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.expandedRowId = this.expandedRowId === rowId ? null : rowId;
  }

  // Workflow Permissions & Helpers (4-Stage Parity with NSI)
  canApproveStep(status: number): boolean {
    if (this.isAdmin) return true;
    if (!this.currentUser) return false;
    const role = this.currentUser.roleName;
    if (status === 1) return role === 'PSQO';
    if (status === 2) return role === 'Kanit';
    if (status === 3) return role === 'KadeptNQ';
    return false;
  }

  getRequiredRoleName(status: number): string {
    if (status === 1) return 'PSQO';
    if (status === 2) return 'Kanit';
    if (status === 3) return 'Kadept NQ';
    return 'Selesai';
  }

  getNextStepName(status: number): string {
    switch (status) {
      case 1: return 'Validasi PSQO (L1)';
      case 2: return 'Approve Kanit (L2)';
      case 3: return 'Verifikasi Kadept NQ (L3 - Final)';
      default: return 'Verifikasi Selesai';
    }
  }

  getNextStepShort(status: number): string {
    switch (status) {
      case 1: return 'Val L1';
      case 2: return 'App L2';
      case 3: return 'Verif Kadept';
      default: return 'Verif';
    }
  }

  getStatusLabel(status: number): string {
    switch (status) {
      case 1: return 'Menunggu L1 (PSQO)';
      case 2: return 'Menunggu L2 (Kanit)';
      case 3: return 'Menunggu L3 (Kadept NQ)';
      case 4:
      case 5: return 'Terverifikasi (Kadept NQ)';
      case 6: return 'Ditolak';
      default: return 'Draft';
    }
  }

  getStatusBadgeClass(status: number): string {
    switch (status) {
      case 1: return 'status-badge-amber';
      case 2: return 'status-badge-blue';
      case 3: return 'status-badge-purple';
      case 4:
      case 5: return 'status-badge-green';
      case 6: return 'status-badge-red';
      default: return 'status-badge-gray';
    }
  }

  getStepStatus(sub: any, stepNum: number): 'done' | 'active' | 'pending' {
    const status = sub.status || 1;
    if (stepNum === 1) return 'done';
    if (stepNum === 2) {
      if (status >= 2) return 'done';
      if (status === 1) return 'active';
      return 'pending';
    }
    if (stepNum === 3) {
      if (status >= 3) return 'done';
      if (status === 2) return 'active';
      return 'pending';
    }
    if (stepNum === 4) {
      if (status >= 4) return 'done';
      if (status === 3) return 'active';
      return 'pending';
    }
    return 'pending';
  }

  getStepActor(sub: any, stepNum: number): string {
    const status = sub.status || 1;
    if (stepNum === 1) return sub.submittedByName || 'Staff IGD / PIC Mutu';
    if (stepNum === 2) {
      const h = sub.history?.find((x: any) => x.toStatus === 'ApprovedL1');
      if (h?.actionByName) return `${h.actionByName} (PSQO)`;
      return status >= 2 ? 'Dewi Lestari (PSQO)' : 'PSQO / PJ Shift';
    }
    if (stepNum === 3) {
      const h = sub.history?.find((x: any) => x.toStatus === 'ApprovedL2');
      if (h?.actionByName) return `${h.actionByName} (Kanit)`;
      return status >= 3 ? 'Budi Santoso (Kanit)' : 'Kepala Unit (Kanit)';
    }
    if (stepNum === 4) {
      const h = sub.history?.find((x: any) => x.toStatus === 'ApprovedL3' || x.toStatus === 'Verified');
      if (h?.actionByName) return `${h.actionByName} (Kadept NQ)`;
      return status >= 4 ? (sub.approvedByName ? `${sub.approvedByName} (Kadept NQ)` : 'Siti Rahma (Kadept NQ)') : 'Kadept Nursing Quality';
    }
    return '-';
  }

  getStepDate(sub: any, stepNum: number): string | undefined {
    const status = sub.status || 1;
    if (stepNum === 1) return sub.submittedDate || sub.doorTime;
    if (stepNum === 2) {
      const h = sub.history?.find((x: any) => x.toStatus === 'ApprovedL1');
      return h?.actionDate || (status >= 2 ? sub.doorTime : undefined);
    }
    if (stepNum === 3) {
      const h = sub.history?.find((x: any) => x.toStatus === 'ApprovedL2');
      return h?.actionDate || (status >= 3 ? sub.doorTime : undefined);
    }
    if (stepNum === 4) {
      const h = sub.history?.find((x: any) => x.toStatus === 'ApprovedL3' || x.toStatus === 'Verified');
      return h?.actionDate || sub.approvedDate || (status >= 4 ? sub.doorTime : undefined);
    }
    return undefined;
  }

  async advanceWorkflow(submissionId: string, currentStatus: number, event?: Event): Promise<void> {
    if (event) event.stopPropagation();
    if (!this.currentUser) return;

    if (!this.canApproveStep(currentStatus)) {
      await this.notify.alert('Akses Ditolak', `Hanya role ${this.getRequiredRoleName(currentStatus)} (atau Admin) yang berwenang melakukan tahapan verifikasi ini.`, 'warning');
      return;
    }

    let action = '';
    let stepName = '';
    if (currentStatus === 1) {
      action = 'approve_l1';
      stepName = 'Validasi PSQO (L1)';
    } else if (currentStatus === 2) {
      action = 'approve_l2';
      stepName = 'Approve Kepala Unit / Kanit (L2)';
    } else if (currentStatus === 3) {
      action = 'approve_l3';
      stepName = 'Verifikasi Final Kadept Nursing Quality (L3)';
    } else {
      action = 'verify';
      stepName = 'Verifikasi';
    }

    const roleDesc = this.currentUser.roleDisplayName || this.currentUser.roleName;
    const confirmed = await this.notify.confirm({
      title: 'Konfirmasi Approval Alur IGD',
      message: `Lanjutkan persetujuan untuk kasus IGD ini ke tahap '${stepName}' sebagai ${this.currentUser.fullName || this.currentUser.username} (${roleDesc})?`,
      confirmText: 'Ya, Setujui',
      cancelText: 'Batal',
      type: 'primary'
    });

    if (confirmed) {
      this.workflowProcessing = true;
      this.dashboardService.executeEdWorkflow(
        submissionId,
        action,
        this.currentUser.id,
        `${stepName} disetujui oleh ${this.currentUser.fullName || this.currentUser.username} (${roleDesc})`
      ).subscribe({
        next: (res) => {
          this.workflowProcessing = false;
          this.notify.success(res.message || 'Status verifikasi berhasil diperbarui!');
          this.loadIndicatorSubmissions(this.indicatorType);
        },
        error: (err) => {
          this.workflowProcessing = false;
          this.notify.error('Gagal memproses verifikasi: ' + (err.error?.message || err.message));
        }
      });
    }
  }

  async quickVerify(submissionId: string, event?: Event): Promise<void> {
    if (event) event.stopPropagation();
    if (!this.currentUser) return;

    const confirmed = await this.notify.confirm({
      title: 'Verifikasi Langsung (Final)',
      message: 'Verifikasi langsung kasus IGD ini ke status Final Terverifikasi?',
      confirmText: 'Ya, Verifikasi',
      cancelText: 'Batal',
      type: 'primary'
    });

    if (confirmed) {
      this.workflowProcessing = true;
      this.dashboardService.executeEdWorkflow(
        submissionId,
        'verify',
        this.currentUser.id,
        `Diverifikasi langsung oleh ${this.currentUser.fullName || 'Admin'}`
      ).subscribe({
        next: (res) => {
          this.workflowProcessing = false;
          this.notify.success(res.message || 'Kasus IGD berhasil diverifikasi.');
          this.loadIndicatorSubmissions(this.indicatorType);
        },
        error: (err) => {
          this.workflowProcessing = false;
          this.notify.error('Gagal memverifikasi: ' + (err.error?.message || err.message));
        }
      });
    }
  }

  async quickUnverify(submissionId: string, event?: Event): Promise<void> {
    if (event) event.stopPropagation();
    if (!this.currentUser) return;

    const confirmed = await this.notify.confirm({
      title: 'Batalkan Verifikasi',
      message: 'Batalkan status verifikasi dan kembalikan kasus IGD ini ke status Menunggu Approval?',
      confirmText: 'Ya, Batalkan',
      cancelText: 'Tutup',
      type: 'warning'
    });

    if (confirmed) {
      this.workflowProcessing = true;
      this.dashboardService.executeEdWorkflow(
        submissionId,
        'reset',
        this.currentUser.id,
        `Status verifikasi dibatalkan oleh ${this.currentUser.fullName || 'Admin'}`
      ).subscribe({
        next: (res) => {
          this.workflowProcessing = false;
          this.notify.info(res.message || 'Status verifikasi berhasil dibatalkan.');
          this.loadIndicatorSubmissions(this.indicatorType);
        },
        error: (err) => {
          this.workflowProcessing = false;
          this.notify.error('Gagal membatalkan verifikasi: ' + (err.error?.message || err.message));
        }
      });
    }
  }

  canDelete(sub?: any): boolean {
    if (!this.currentUser) return false;
    const role = this.currentUser.roleName;
    return role === 'Kanit' || role === 'KadeptNQ' || role === 'NQCorp' || role === 'Admin' || this.isAdmin;
  }

  async deleteCase(sub: any, event?: Event): Promise<void> {
    if (event) event.stopPropagation();
    if (!this.currentUser) return;

    if (!this.canDelete(sub)) {
      await this.notify.alert('Akses Ditolak', 'Hanya Kepala Unit (Kanit), Kadept Nursing Quality, atau Administrator yang berwenang menghapus data kasus UGD.', 'error');
      return;
    }

    const patientLabel = sub.patientInitials ? `Inisial ${sub.patientInitials} (RM: ${sub.emrNumber})` : (sub.emrNumber || `Kasus ID: ${sub.id}`);
    const confirmed = await this.notify.confirm({
      title: 'Hapus Data Kasus UGD',
      message: `Apakah Anda yakin ingin menghapus data kasus IGD "${patientLabel}"? Tindakan ini bersifat permanen dan tidak dapat dibatalkan.`,
      confirmText: 'Ya, Hapus Kasus',
      cancelText: 'Batal',
      type: 'error'
    });

    if (confirmed) {
      this.deleting = true;
      this.dashboardService.deleteEdCase(sub.id, this.currentUser.id).subscribe({
        next: () => {
          this.deleting = false;
          this.notify.success('Data kasus IGD berhasil dihapus.');
          this.loadIndicatorSubmissions(this.indicatorType);
        },
        error: (err) => {
          this.deleting = false;
          this.notify.error('Gagal menghapus kasus: ' + (err.error?.message || err.message));
        }
      });
    }
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

  getFilteredSubmissions(): any[] {
    if (!Array.isArray(this.activeIndicatorSubmissions)) {
      return [];
    }
    let list = this.activeIndicatorSubmissions;
    if (this.statusFilter === 'COMPLIANT') {
      list = list.filter(s => s && s.isCompliant);
    } else if (this.statusFilter === 'OVERDUE') {
      list = list.filter(s => s && !s.isCompliant);
    }
    if (this.searchQuery && this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter(s => 
        (s.emrNumber && s.emrNumber.toLowerCase().includes(q)) ||
        (s.patientInitials && s.patientInitials.toLowerCase().includes(q)) ||
        (s.clinicalNotes && s.clinicalNotes.toLowerCase().includes(q))
      );
    }
    return list;
  }

  getFilteredCount(): number {
    return this.getFilteredSubmissions().length;
  }

  getTotalCount(): number {
    return Array.isArray(this.activeIndicatorSubmissions) ? this.activeIndicatorSubmissions.length : 0;
  }

  getPaginationCountText(): string {
    const total = this.getTotalCount();
    const filtered = this.getFilteredCount();
    if (total === 0) {
      return 'Belum ada data kasus';
    }
    if (filtered === total) {
      return `Menampilkan ${total} dari ${total} kasus`;
    }
    return `Menampilkan ${filtered} dari ${total} kasus`;
  }

  pageSizeOptions = [10, 25, 50, 100];

  get totalSubmissionsCount(): number {
    return this.getFilteredSubmissions().length;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalSubmissionsCount / this.pageSize));
  }

  get paginationStartIndex(): number {
    if (this.totalSubmissionsCount === 0) return 0;
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get paginationEndIndex(): number {
    return Math.min(this.currentPage * this.pageSize, this.totalSubmissionsCount);
  }

  get pagedSubmissions(): any[] {
    const total = this.totalSubmissionsCount;
    const maxPage = Math.max(1, Math.ceil(total / this.pageSize));
    if (this.currentPage > maxPage) {
      this.currentPage = maxPage;
    }
    const start = (this.currentPage - 1) * this.pageSize;
    return this.getFilteredSubmissions().slice(start, start + this.pageSize);
  }

  getPaginatedSubmissions(): any[] {
    return this.pagedSubmissions;
  }

  getTotalPages(): number {
    return this.totalPages;
  }

  get visiblePages(): number[] {
    const pages: number[] = [];
    const total = this.totalPages;
    const current = this.currentPage;
    const maxVisible = 5;

    let start = Math.max(1, current - Math.floor(maxVisible / 2));
    let end = Math.min(total, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  onSearchChange(): void {
    this.currentPage = 1;
  }

  getCompliancePercentage(): number {
    if (!this.activeIndicatorSubmissions.length) return 0;
    return Math.round((this.getAchievedCount() / this.activeIndicatorSubmissions.length) * 100);
  }

  getAverageMinutes(): number {
    if (!this.activeIndicatorSubmissions.length) return 0;
    const total = this.activeIndicatorSubmissions.reduce((acc, curr) => acc + (curr.minutesElapsed || 0), 0);
    return Math.round((total / this.activeIndicatorSubmissions.length) * 10) / 10;
  }

  getFastestMinutes(): number {
    if (!this.activeIndicatorSubmissions.length) return 0;
    return Math.min(...this.activeIndicatorSubmissions.map(s => s.minutesElapsed || 0));
  }

  getOverdueCount(): number {
    return this.activeIndicatorSubmissions.filter(s => !s.isCompliant).length;
  }

  exportToExcel(): void {
    const list = this.getFilteredSubmissions();
    if (!list.length) return;
    
    const indicator = this.getIndicatorCode();
    const rows = list.map((s, idx) => {
      const baseRow: Record<string, any> = {
        'No': idx + 1,
        'No Rekam Medis': s.emrNumber,
        'Inisial Pasien': s.patientInitials || '-',
      };

      if (indicator === 'cardiology') {
        baseRow['Tanggal Tiba'] = s.doorTime ? new Date(s.doorTime).toLocaleDateString('id-ID') : '-';
        baseRow['Waktu Tiba IGD'] = s.doorTime ? new Date(s.doorTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
        baseRow['Waktu ECG Selesai'] = s.eventTime ? new Date(s.eventTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
        baseRow['Selisih Waktu (Menit)'] = s.minutesElapsed;
      } else if (indicator === 'orthopaedics') {
        baseRow['Diagnosa Medis'] = this.getCustomFieldValue(s.customFieldsJson, 'MedicalDiagnosis');
        baseRow['Tanggal Tiba'] = s.doorTime ? new Date(s.doorTime).toLocaleDateString('id-ID') : '-';
        baseRow['Waktu Tiba IGD'] = s.doorTime ? new Date(s.doorTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
        baseRow['Waktu Analgesik'] = s.eventTime ? new Date(s.eventTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
        baseRow['Selisih Waktu (Menit)'] = s.minutesElapsed;
        baseRow['Pre-Assess Skala Nyeri'] = this.getCustomFieldValue(s.customFieldsJson, 'PainScore');
        baseRow['Waktu Pre-Assess'] = this.getCustomFieldTime(s.customFieldsJson, 'AssessmentTime');
      } else if (indicator === 'neurology') {
        baseRow['Diagnosa Medis'] = this.getCustomFieldValue(s.customFieldsJson, 'MedicalDiagnosis');
        baseRow['Tindakan Radiologi'] = this.getCustomFieldValue(s.customFieldsJson, 'RadiologyAction');
        baseRow['Tanggal Tiba'] = s.doorTime ? new Date(s.doorTime).toLocaleDateString('id-ID') : '-';
        baseRow['Waktu Tiba IGD'] = s.doorTime ? new Date(s.doorTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
        baseRow['Waktu CT/MRI'] = s.eventTime ? new Date(s.eventTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
        baseRow['Selisih Waktu (Menit)'] = s.minutesElapsed;
      } else if (indicator === 'gastrohepatology') {
        baseRow['Diagnosa Medis'] = this.getCustomFieldValue(s.customFieldsJson, 'MedicalDiagnosis');
        baseRow['Tanggal Tiba'] = s.doorTime ? new Date(s.doorTime).toLocaleDateString('id-ID') : '-';
        baseRow['Waktu Tiba IGD'] = s.doorTime ? new Date(s.doorTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
        baseRow['Waktu Diagnostik'] = s.eventTime ? new Date(s.eventTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
        baseRow['Selisih Waktu (Menit)'] = s.minutesElapsed;
        baseRow['Pemeriksaan'] = this.getCustomFieldValue(s.customFieldsJson, 'DiagnosticExam');
        baseRow['Waktu Pre-Assess'] = this.getCustomFieldTime(s.customFieldsJson, 'AssessmentTime');
        baseRow['Waktu Request Lab'] = this.getCustomFieldTime(s.customFieldsJson, 'RequestTime');
      } else if (indicator === 'oncology') {
        baseRow['Diagnosa Medis'] = this.getCustomFieldValue(s.customFieldsJson, 'MedicalDiagnosis');
        baseRow['Tanggal Tiba'] = s.doorTime ? new Date(s.doorTime).toLocaleDateString('id-ID') : '-';
        baseRow['Waktu Tiba IGD'] = s.doorTime ? new Date(s.doorTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
        baseRow['Waktu Antibiotik'] = s.eventTime ? new Date(s.eventTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
        baseRow['Selisih Waktu (Menit)'] = s.minutesElapsed;
        baseRow['Antibiotik IV'] = this.getCustomFieldValue(s.customFieldsJson, 'AntibioticType');
        baseRow['Waktu Pre-Assess'] = this.getCustomFieldTime(s.customFieldsJson, 'AssessmentTime');
        baseRow['Waktu Resep'] = this.getCustomFieldTime(s.customFieldsJson, 'PrescriptionTime');
      } else if (indicator === 'mom-children') {
        baseRow['Triage / Kasus'] = this.getCustomFieldValue(s.customFieldsJson, 'TriageLevel');
        baseRow['Tanggal Tiba'] = s.doorTime ? new Date(s.doorTime).toLocaleDateString('id-ID') : '-';
        baseRow['Waktu Tiba IGD'] = s.doorTime ? new Date(s.doorTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
        baseRow['Waktu Bidan Tiba'] = s.eventTime ? new Date(s.eventTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
        baseRow['Selisih Waktu (Menit)'] = s.minutesElapsed;
      } else {
        baseRow['Tanggal Tiba'] = s.doorTime ? new Date(s.doorTime).toLocaleDateString('id-ID') : '-';
        baseRow['Waktu Tiba IGD'] = s.doorTime ? new Date(s.doorTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
        baseRow['Waktu Tindakan Selesai'] = s.eventTime ? new Date(s.eventTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
        baseRow['Selisih Waktu (Menit)'] = s.minutesElapsed;
      }

      baseRow['Target Standar'] = this.getIndicatorTargetText();
      baseRow['Status Kepatuhan'] = s.isCompliant ? 'Tercapai' : 'Tidak Tercapai';
      baseRow['Keterangan Klinis'] = s.clinicalNotes || '-';

      return baseRow;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Auto-fit column widths based on maximum content length
    const colKeys = Object.keys(rows[0] || {});
    worksheet['!cols'] = colKeys.map(k => {
      let maxLen = k.length;
      for (const r of rows) {
        const valStr = String((r as any)[k] ?? '');
        if (valStr.length > maxLen) maxLen = valStr.length;
      }
      return { wch: Math.min(Math.max(maxLen + 4, 10), 45) };
    });

    const workbook = XLSX.utils.book_new();
    const sheetName = (this.getIndicatorCode() || 'Kasus').substring(0, 31);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const fileName = `AegisMed_${this.getIndicatorCode()}_cases_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }

  exportToCsv(): void {
    if (!this.activeIndicatorSubmissions.length) return;
    const headers = ['No Rekam Medis', 'Inisial', 'Waktu Tiba (Door Time)', 'Waktu Selesai (Event Time)', 'Durasi (Menit)', 'Kepatuhan', 'Keterangan Klinis'];
    const rows = this.activeIndicatorSubmissions.map(s => [
      s.emrNumber,
      s.patientInitials,
      new Date(s.doorTime).toLocaleString(),
      new Date(s.eventTime).toLocaleString(),
      s.minutesElapsed,
      s.isCompliant ? 'Tercapai' : 'Tidak Tercapai',
      `"${(s.clinicalNotes || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AegisMed_${this.getIndicatorCode()}_cases.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    this.router.navigate(['/ugd-cases', this.indicatorType, 'input']);
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
      if (tIdx !== -1) {
        return val.slice(tIdx + 1, tIdx + 6);
      }
      if (val.length >= 5 && val.includes(':')) {
        return val.slice(0, 5);
      }
      return val;
    } catch {
      return '-';
    }
  }
}
