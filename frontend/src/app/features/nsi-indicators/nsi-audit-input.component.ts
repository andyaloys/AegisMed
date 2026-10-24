import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { NsiAuditService, NsiIndicatorDto, NsiAuditSubmissionDto } from '../../core/services/nsi-audit.service';
import { AuthService, UserProfile } from '../../core/services/auth.service';
import { UserManagementService, HospitalSiteDto, HospitalUnitDto } from '../../core/services/user-management.service';
import { NotificationService } from '../../core/services/notification.service';

export interface FormAuditItem {
  itemNumber: number;
  patientIdentifier: string;
  patientName: string;
  isCompliant: boolean;
  notes: string;
  doorTime?: string;
  eventTime?: string;
  minutesElapsed?: number;

  // 1. NCP specific fields
  diagnosis?: string;
  roomArrivalTime?: string;
  ncpCreatedTime?: string;
  ncpCount?: number;
  ncpDiagnosis?: string;
  isNcpUnder7h?: boolean;
  isNcpCompliant?: boolean;

  // 2. RNC (Call Bell) specific fields
  roomNumber?: string;
  callTime?: string;
  responseTime?: string;
  durationMinutes?: number;

  // 3. Rekam Medis 5-point Checklist (Pengkajian IGD/Ranap, CPPT, Obat, IC, SSC, Periop, Transfer)
  criteriaAda?: boolean;
  criteriaTepatWaktu?: boolean;
  criteriaDapatDibaca?: boolean;
  criteriaAutentikasi?: boolean;
  criteriaLengkap?: boolean;
  isNa?: boolean;

  // 4. Edukasi specific fields
  eduOrientasi?: boolean;
  eduResikoJatuh?: boolean;
  eduPlebitis?: boolean;
  eduCuciTangan?: boolean;
  eduPerawatanLuka?: boolean;
  eduDischarge?: boolean;

  // 5. Monitoring TTV specific fields
  kriteriaPasien?: string;
  arrivalTime?: string;
  isMonitoringOnTime?: boolean;

  // 6. Tata Laksana Nyeri specific fields
  isAnalgeticIvRoutine?: boolean;
  painCategory?: string;
  medicationName?: string;
  isReEvaluationPostMed?: boolean;
  isReAssessmentPain?: boolean;

  // 7. EWS specific fields
  ewsMonitoringTime?: string;
  ewsScore?: number;
  dpjpReportTime?: string;
  isFrequencyIncreased?: boolean;
  isActionAppropriate?: boolean;
  isDocumentedInCppt?: boolean;
}

@Component({
  selector: 'app-nsi-audit-input',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './nsi-audit-input.component.html',
  styleUrls: ['./nsi-audit-input.component.css']
})
export class NsiAuditInputComponent implements OnInit, OnDestroy {
  indicatorId = '';
  submissionId: string | null = null;
  isEditMode = false;

  indicator: NsiIndicatorDto | null = null;
  currentUser: UserProfile | null = null;
  loading = true;
  submitting = false;

  // Metadata Fields
  sites: HospitalSiteDto[] = [];
  units: HospitalUnitDto[] = [];
  filteredUnits: HospitalUnitDto[] = [];

  hospitalSiteId = '';
  hospitalUnitId = '';
  submissionMonth = '2026-10';
  auditDate = '';
  notes = '';
  existingStatus = 0;
  existingStatusText = 'Draft';
  existingSubmission: NsiAuditSubmissionDto | null = null;

  get isAdmin(): boolean {
    return this.authService.isAdmin || this.currentUser?.roleName === 'Admin' || (this.currentUser?.roleLevel ?? 0) >= 4;
  }

  getStepStatus(stepNumber: number): 'completed' | 'current' | 'pending' {
    // 0=Draft, 1=Submitted, 2=ApprovedL1, 3=ApprovedL2, 4=ApprovedL3/Verified, 6=Rejected
    const status = this.existingStatus;
    if (stepNumber === 4) {
      if (status >= 4) return 'completed';
      if (status === 3) return 'current';
      return 'pending';
    }
    if (status >= stepNumber) return 'completed';
    if (status === stepNumber - 1) return 'current';
    return 'pending';
  }

  getStepActor(stepNumber: number): string {
    if (!this.existingSubmission) {
      if (stepNumber === 1) return this.currentUser?.fullName || 'PIC Unit';
      return '-';
    }
    const sub = this.existingSubmission;
    if (stepNumber === 1) return sub.submittedByName || 'PIC Unit';
    if (stepNumber === 2) {
      const h = sub.history?.find(x => x.toStatus === 'ApprovedL1');
      return h ? h.actionByName : (sub.status >= 2 ? 'PSQO Unit' : 'PSQO / PJ Shift');
    }
    if (stepNumber === 3) {
      const h = sub.history?.find(x => x.toStatus === 'ApprovedL2');
      return h ? h.actionByName : (sub.status >= 3 ? 'Kepala Unit' : 'Kanit');
    }
    if (stepNumber === 4) {
      const h = sub.history?.find(x => x.toStatus === 'ApprovedL3' || x.toStatus === 'Verified');
      return h ? h.actionByName : (sub.status >= 4 ? 'Siti Rahma (Kadept NQ)' : 'Kadept Nursing Quality');
    }
    return '-';
  }

  getStepDate(stepNumber: number): string | null {
    if (!this.existingSubmission) return null;
    const sub = this.existingSubmission;
    if (stepNumber === 1) return sub.submittedDate || sub.auditDate || null;
    if (stepNumber === 2) {
      const h = sub.history?.find(x => x.toStatus === 'ApprovedL1');
      return h ? h.actionDate : (sub.status >= 2 ? sub.auditDate : null);
    }
    if (stepNumber === 3) {
      const h = sub.history?.find(x => x.toStatus === 'ApprovedL2');
      return h ? h.actionDate : (sub.status >= 3 ? sub.auditDate : null);
    }
    if (stepNumber === 4) {
      const h = sub.history?.find(x => x.toStatus === 'ApprovedL3' || x.toStatus === 'Verified');
      return h ? h.actionDate : (sub.status >= 4 ? sub.approvedDate || sub.auditDate || null : null);
    }
    return null;
  }

  async quickVerifyCurrent(): Promise<void> {
    if (!this.submissionId || !this.currentUser) return;
    const confirmed = await this.notify.confirm({
      title: 'Verifikasi Langsung Audit',
      message: 'Verifikasi langsung data audit pasien ini sebagai Administrator?',
      confirmText: 'Ya, Verifikasi',
      cancelText: 'Batal',
      type: 'success'
    });

    if (confirmed) {
      this.submitting = true;
      this.nsiService.executeWorkflow(this.submissionId, 'verify', this.currentUser.id, `Diverifikasi langsung oleh ${this.currentUser.fullName || 'Admin'}`).subscribe({
        next: (res) => {
          this.submitting = false;
          this.notify.success(res.message || 'Audit pasien berhasil diverifikasi!');
          if (this.submissionId) this.loadExistingSubmission(this.submissionId);
        },
        error: (err) => {
          this.submitting = false;
          this.notify.error('Gagal memverifikasi: ' + (err.error?.message || err.message));
        }
      });
    }
  }

  async quickUnverifyCurrent(): Promise<void> {
    if (!this.submissionId || !this.currentUser) return;
    const confirmed = await this.notify.confirm({
      title: 'Batalkan Status Verifikasi',
      message: 'Batalkan status verifikasi dan kembalikan ke status Menunggu Approval?',
      confirmText: 'Ya, Batalkan',
      cancelText: 'Tutup',
      type: 'warning'
    });

    if (confirmed) {
      this.submitting = true;
      this.nsiService.executeWorkflow(this.submissionId, 'submit', this.currentUser.id, `Status verifikasi dibatalkan oleh ${this.currentUser.fullName || 'Admin'}`).subscribe({
        next: (res) => {
          this.submitting = false;
          this.notify.info(res.message || 'Status verifikasi berhasil dibatalkan.');
          if (this.submissionId) this.loadExistingSubmission(this.submissionId);
        },
        error: (err) => {
          this.submitting = false;
          this.notify.error('Gagal membatalkan: ' + (err.error?.message || err.message));
        }
      });
    }
  }

  // Observation items
  items: FormAuditItem[] = [];

  // Active Patient Item being edited
  activeItemIndex = 0;

  get currentItem(): FormAuditItem {
    if (!this.items || this.items.length === 0) {
      this.items = [this.createDefaultItem(1)];
    }
    if (this.activeItemIndex < 0 || this.activeItemIndex >= this.items.length) {
      this.activeItemIndex = 0;
    }
    return this.items[this.activeItemIndex];
  }

  selectItem(index: number): void {
    if (index >= 0 && index < this.items.length) {
      this.activeItemIndex = index;
    }
  }

  private routeSub: Subscription | null = null;
  private querySub: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private nsiService: NsiAuditService,
    public authService: AuthService,
    private userService: UserManagementService,
    public notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.currentUser;
    this.authService.currentUser$.subscribe(u => this.currentUser = u);

    this.auditDate = this.getTodayDateString();
    this.submissionMonth = this.getTodayDateString().substring(0, 7);

    this.loadSitesAndUnits();

    this.querySub = this.route.queryParamMap.subscribe(qp => {
      const itemParam = qp.get('item');
      if (itemParam) {
        const idx = parseInt(itemParam, 10) - 1;
        if (idx >= 0) this.activeItemIndex = idx;
      }
    });

    this.routeSub = this.route.paramMap.subscribe(params => {
      const indId = params.get('indicatorId');
      const subId = params.get('submissionId');

      if (indId) {
        this.indicatorId = indId;
        this.loadIndicator();
      }

      if (subId) {
        this.isEditMode = true;
        this.submissionId = subId;
        this.loadExistingSubmission(subId);
      } else {
        this.isEditMode = false;
        this.submissionId = null;
        this.initializeDefaultItems();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.routeSub) this.routeSub.unsubscribe();
    if (this.querySub) this.querySub.unsubscribe();
  }

  getTodayDateString(): string {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  loadSitesAndUnits(): void {
    this.userService.getSites().subscribe(sites => {
      this.sites = sites;
      if (this.currentUser && this.currentUser.hospitalSiteId) {
        this.hospitalSiteId = this.currentUser.hospitalSiteId;
      } else if (sites.length > 0 && !this.hospitalSiteId) {
        this.hospitalSiteId = sites[0].id;
      }
      this.onSiteChange(this.hospitalSiteId);
    });
  }

  onSiteChange(siteId: string): void {
    this.userService.getUnits(siteId).subscribe(units => {
      this.units = units;
      this.filteredUnits = units;
      if (this.currentUser && this.currentUser.hospitalUnitId && this.filteredUnits.some(u => u.id === this.currentUser?.hospitalUnitId)) {
        this.hospitalUnitId = this.currentUser.hospitalUnitId;
      } else if (this.filteredUnits.length > 0 && !this.hospitalUnitId) {
        this.hospitalUnitId = this.filteredUnits[0].id;
      }
    });
  }

  loadIndicator(): void {
    this.loading = true;
    this.nsiService.getIndicatorById(this.indicatorId).subscribe({
      next: (ind) => {
        this.indicator = ind;
        this.loading = false;
      },
      error: () => {
        this.nsiService.getIndicators().subscribe(inds => {
          this.indicator = inds.find(i => i.id === this.indicatorId) || null;
          this.loading = false;
        });
      }
    });
  }

  get rawDataCategory(): 'NCP' | 'RNC' | 'REK_MED' | 'EDUKASI' | 'VITAL' | 'PAIN' | 'EWS' | 'TIME_BASED' | 'GENERIC' {
    const code = this.indicator?.code || '';
    if (code === 'NSI-NCP') return 'NCP';
    if (code === 'NSI-RNC') return 'RNC';
    if (code.startsWith('NSI-IGD-ASSESS') || code.startsWith('NSI-RI-ASSESS') || code === 'NSI-CPPT' ||
        code === 'NSI-MED-REC' || code === 'NSI-IC' || code === 'NSI-SSC' ||
        code === 'NSI-PERIOP' || code === 'NSI-TRANSFER') {
      return 'REK_MED';
    }
    if (code === 'NSI-EDUKASI') return 'EDUKASI';
    if (code === 'NSI-VITAL') return 'VITAL';
    if (code === 'NSI-PAIN') return 'PAIN';
    if (code === 'NSI-EWS') return 'EWS';
    if (this.indicator?.measurementType === 'TimeBased' || code.startsWith('PI-')) return 'TIME_BASED';
    return 'GENERIC';
  }

  loadExistingSubmission(id: string): void {
    this.loading = true;
    this.nsiService.getSubmissionById(id).subscribe({
      next: (sub) => {
        this.hospitalSiteId = sub.hospitalSiteId;
        this.onSiteChange(sub.hospitalSiteId);
        this.hospitalUnitId = sub.hospitalUnitId;
        this.submissionMonth = sub.submissionMonth;
        this.auditDate = sub.auditDate ? sub.auditDate.substring(0, 10) : this.getTodayDateString();
        this.notes = sub.rejectionNotes || '';
        this.existingStatus = sub.status;
        this.existingStatusText = sub.statusText;
        this.existingSubmission = sub;

        if (sub.items && sub.items.length > 0) {
          // Opsi B: 1 Raw Data Submission = Tepat 1 Pasien
        const singleItem = sub.items[0];
        let parsed: any = {};
        try {
          if (singleItem && singleItem.customFieldsJson) parsed = JSON.parse(singleItem.customFieldsJson);
        } catch (e) {
          parsed = {};
        }

        const item: FormAuditItem = {
          itemNumber: 1,
          patientIdentifier: singleItem ? singleItem.patientIdentifier : '',
          patientName: parsed.patientName || 'Pasien',
          isCompliant: singleItem ? singleItem.isCompliant : true,
          notes: singleItem ? (singleItem.notes || '') : '',
          doorTime: singleItem ? singleItem.doorTime : undefined,
          eventTime: singleItem ? singleItem.eventTime : undefined,
          minutesElapsed: singleItem ? singleItem.minutesElapsed : undefined,

          // NCP
          diagnosis: parsed.diagnosis || '',
          roomArrivalTime: parsed.roomArrivalTime || '',
          ncpCreatedTime: parsed.ncpCreatedTime || '',
          ncpCount: parsed.ncpCount !== undefined ? parsed.ncpCount : 1,
          ncpDiagnosis: parsed.ncpDiagnosis || '',
          isNcpUnder7h: parsed.isNcpUnder7h !== undefined ? parsed.isNcpUnder7h : true,
          isNcpCompliant: parsed.isNcpCompliant !== undefined ? parsed.isNcpCompliant : (singleItem ? singleItem.isCompliant : true),

          // RNC
          roomNumber: parsed.roomNumber || '',
          callTime: parsed.callTime || '',
          responseTime: parsed.responseTime || '',
          durationMinutes: parsed.durationMinutes !== undefined ? parsed.durationMinutes : (singleItem ? singleItem.minutesElapsed : 2),

          // Rekam Medis (5 Kriteria)
          criteriaAda: parsed.criteriaAda !== undefined ? parsed.criteriaAda : true,
          criteriaTepatWaktu: parsed.criteriaTepatWaktu !== undefined ? parsed.criteriaTepatWaktu : true,
          criteriaDapatDibaca: parsed.criteriaDapatDibaca !== undefined ? parsed.criteriaDapatDibaca : true,
          criteriaAutentikasi: parsed.criteriaAutentikasi !== undefined ? parsed.criteriaAutentikasi : true,
          criteriaLengkap: parsed.criteriaLengkap !== undefined ? parsed.criteriaLengkap : true,
          isNa: parsed.isNa !== undefined ? parsed.isNa : false,

          // Edukasi
          eduOrientasi: parsed.eduOrientasi !== undefined ? parsed.eduOrientasi : true,
          eduResikoJatuh: parsed.eduResikoJatuh !== undefined ? parsed.eduResikoJatuh : true,
          eduPlebitis: parsed.eduPlebitis !== undefined ? parsed.eduPlebitis : true,
          eduCuciTangan: parsed.eduCuciTangan !== undefined ? parsed.eduCuciTangan : true,
          eduPerawatanLuka: parsed.eduPerawatanLuka !== undefined ? parsed.eduPerawatanLuka : true,
          eduDischarge: parsed.eduDischarge !== undefined ? parsed.eduDischarge : true,

          // TTV
          kriteriaPasien: parsed.kriteriaPasien || 'Post Tindakan',
          arrivalTime: parsed.arrivalTime || '11:00',
          isMonitoringOnTime: parsed.isTtvOnTime !== undefined ? parsed.isTtvOnTime === 1 : (parsed.isMonitoringOnTime !== undefined ? parsed.isMonitoringOnTime : true),

          // Nyeri
          isAnalgeticIvRoutine: parsed.hasRoutineIvAnalgesic === 'Ya' || parsed.isAnalgeticIvRoutine === true,
          painCategory: parsed.painCategory || 'Sedang',
          medicationName: parsed.medicationName || '',
          isReEvaluationPostMed: parsed.isPostEvaluationCompliant !== undefined ? parsed.isPostEvaluationCompliant === 1 : (parsed.isReEvaluationPostMed !== undefined ? parsed.isReEvaluationPostMed : true),
          isReAssessmentPain: parsed.isReassessmentCompliant !== undefined ? parsed.isReassessmentCompliant === 1 : (parsed.isReAssessmentPain !== undefined ? parsed.isReAssessmentPain : true),

          // EWS
          ewsMonitoringTime: parsed.ewsMonitoringTime || '14:00',
          ewsScore: parsed.ewsScore !== undefined ? parsed.ewsScore : 3,
          dpjpReportTime: parsed.dpjpReportTime || '14:15',
          isFrequencyIncreased: parsed.isFrequencyIncreased !== undefined ? parsed.isFrequencyIncreased : true,
          isActionAppropriate: parsed.isActionAppropriate !== undefined ? parsed.isActionAppropriate : true,
          isDocumentedInCppt: parsed.isDocumentedInCppt !== undefined ? parsed.isDocumentedInCppt : (singleItem ? singleItem.isCompliant : true)
        };

        this.calculateItemCompliance(item);
        this.items = [item];
        this.activeItemIndex = 0;
        } else {
          this.initializeDefaultItems();
        }
        this.loading = false;
      },
      error: (err) => {
        this.notify.error('Gagal memuat data audit: ' + (err.error?.message || err.message));
        this.router.navigate(['/nsi-indicators', this.indicatorId]);
      }
    });
  }

  createDefaultItem(seq: number): FormAuditItem {
    const pad = String(seq).padStart(3, '0');
    const item: FormAuditItem = {
      itemNumber: seq,
      patientIdentifier: `RM-102${pad}`,
      patientName: `Tn. Pasien ${seq}`,
      isCompliant: true,
      notes: 'Sesuai SPO',

      // NCP defaults
      diagnosis: 'Nyeri Akut / Hipertensi',
      roomArrivalTime: '08:00',
      ncpCreatedTime: '10:30',
      ncpDiagnosis: 'Nyeri Akut & Risiko Infeksi',
      isNcpUnder7h: true,
      isNcpCompliant: true,

      // RNC defaults
      roomNumber: `Kamar ${700 + seq}`,
      callTime: '10:00',
      responseTime: '10:02',
      durationMinutes: 2,

      // Rekam Medis defaults (5 points = 100%)
      criteriaAda: true,
      criteriaTepatWaktu: true,
      criteriaDapatDibaca: true,
      criteriaAutentikasi: true,
      criteriaLengkap: true,
      isNa: false,

      // Edukasi defaults
      eduOrientasi: true,
      eduResikoJatuh: true,
      eduPlebitis: true,
      eduCuciTangan: true,
      eduPerawatanLuka: true,
      eduDischarge: true,

      // TTV defaults
      kriteriaPasien: 'Post Tindakan',
      arrivalTime: '11:00',
      isMonitoringOnTime: true,

      // Nyeri defaults
      isAnalgeticIvRoutine: true,
      painCategory: 'Sedang',
      medicationName: 'Remopain IV',
      isReEvaluationPostMed: true,
      isReAssessmentPain: true,

      // EWS defaults
      ewsMonitoringTime: '08:00',
      ewsScore: 2,
      dpjpReportTime: '08:15',
      isFrequencyIncreased: true,
      isActionAppropriate: true,
      isDocumentedInCppt: true
    };

    this.calculateItemCompliance(item);
    return item;
  }

  initializeDefaultItems(): void {
    if (this.items.length === 0) {
      this.items = [
        this.createDefaultItem(1)
      ];
      this.activeItemIndex = 0;
    }
  }

  addItem(): void {
    const nextSeq = this.items.length + 1;
    this.items.push(this.createDefaultItem(nextSeq));
    this.activeItemIndex = this.items.length - 1;
  }

  addBatchItems(count: number): void {
    for (let i = 0; i < count; i++) {
      this.addItem();
    }
  }

  removeItem(index: number): void {
    if (this.items.length <= 1) {
      this.notify.warning('Minimal harus ada satu data observasi audit.');
      return;
    }
    this.items.splice(index, 1);
    this.items.forEach((item, idx) => item.itemNumber = idx + 1);
  }

  // Reactive calculation for each item based on its specific raw data inputs
  calculateItemCompliance(item: FormAuditItem): void {
    const cat = this.rawDataCategory;

    if (cat === 'NCP') {
      item.isCompliant = (item.isNcpUnder7h ?? true) && (item.isNcpCompliant ?? true);
    } else if (cat === 'RNC') {
      // Calculate duration from callTime and responseTime if provided
      if (item.callTime && item.responseTime) {
        const [cHour, cMin] = item.callTime.split(':').map(Number);
        const [rHour, rMin] = item.responseTime.split(':').map(Number);
        const diff = (rHour * 60 + rMin) - (cHour * 60 + cMin);
        item.durationMinutes = diff >= 0 ? diff : 0;
      }
      item.isCompliant = (item.durationMinutes || 0) <= 3; // Target standar <= 3 menit
    } else if (cat === 'REK_MED') {
      if (item.isNa) {
        item.isCompliant = true;
      } else {
        const score = (item.criteriaAda ? 1 : 0) +
                      (item.criteriaTepatWaktu ? 1 : 0) +
                      (item.criteriaDapatDibaca ? 1 : 0) +
                      (item.criteriaAutentikasi ? 1 : 0) +
                      (item.criteriaLengkap ? 1 : 0);
        item.isCompliant = score === 5; // 100% lengkap
      }
    } else if (cat === 'EDUKASI') {
      item.isCompliant = (item.eduOrientasi ?? true) &&
                         (item.eduResikoJatuh ?? true) &&
                         (item.eduPlebitis ?? true) &&
                         (item.eduCuciTangan ?? true) &&
                         (item.eduPerawatanLuka ?? true) &&
                         (item.eduDischarge ?? true);
    } else if (cat === 'VITAL') {
      item.isCompliant = item.isMonitoringOnTime ?? true;
    } else if (cat === 'PAIN') {
      item.isCompliant = (item.isReEvaluationPostMed ?? true) && (item.isReAssessmentPain ?? true);
    } else if (cat === 'EWS') {
      item.isCompliant = (item.isFrequencyIncreased ?? true) &&
                         (item.isActionAppropriate ?? true) &&
                         (item.isDocumentedInCppt ?? true);
    }
  }

  getRekamMedisScore(item: FormAuditItem): number {
    if (item.isNa) return 100;
    const count = (item.criteriaAda ? 1 : 0) +
                  (item.criteriaTepatWaktu ? 1 : 0) +
                  (item.criteriaDapatDibaca ? 1 : 0) +
                  (item.criteriaAutentikasi ? 1 : 0) +
                  (item.criteriaLengkap ? 1 : 0);
    return Math.round((count / 5) * 100);
  }

  // Live KPI Calculations
  get calculateDenominator(): number {
    return this.items.length;
  }

  get calculateNumerator(): number {
    return this.items.filter(i => i.isCompliant).length;
  }

  get calculateRate(): number {
    const d = this.calculateDenominator;
    return d > 0 ? Math.round((this.calculateNumerator * 100) / d) : 0;
  }

  get isTargetMet(): boolean {
    const target = this.indicator?.targetPercentage || 100;
    return this.calculateRate >= target;
  }

  async saveSubmission(submitDirectly: boolean = true): Promise<void> {
    if (!this.hospitalUnitId) {
      await this.notify.alert('Unit Kerja Belum Dipilih', 'Harap pilih Unit Kerja terlebih dahulu sebelum menyimpan data audit.', 'warning');
      return;
    }

    if (this.items.some(i => !i.patientIdentifier.trim())) {
      await this.notify.alert('Data Belum Lengkap', 'Harap isi Nomor Rekam Medis (No. RM) pasien.', 'warning');
      return;
    }

    if (!this.currentUser) {
      await this.notify.alert('Sesi Berakhir', 'Silakan login terlebih dahulu untuk menyimpan formulir.', 'warning');
      return;
    }

    this.submitting = true;

    // Package raw data fields into CustomFieldsJson
    const payloadItems = this.items.map(it => {
      this.calculateItemCompliance(it);

      const customData: any = {
        patientName: it.patientName,
        // NCP
        diagnosis: it.diagnosis,
        roomArrivalTime: it.roomArrivalTime,
        ncpCreatedTime: it.ncpCreatedTime,
        ncpCount: it.ncpCount,
        ncpDiagnosis: it.ncpDiagnosis,
        isNcpUnder7h: it.isNcpUnder7h,
        isNcpCompliant: it.isNcpCompliant,
        // RNC
        roomNumber: it.roomNumber,
        callTime: it.callTime,
        responseTime: it.responseTime,
        durationMinutes: it.durationMinutes,
        // Rekam Medis
        criteriaAda: it.criteriaAda,
        criteriaTepatWaktu: it.criteriaTepatWaktu,
        criteriaDapatDibaca: it.criteriaDapatDibaca,
        criteriaAutentikasi: it.criteriaAutentikasi,
        criteriaLengkap: it.criteriaLengkap,
        isNa: it.isNa,
        // Edukasi
        eduOrientasi: it.eduOrientasi,
        eduResikoJatuh: it.eduResikoJatuh,
        eduPlebitis: it.eduPlebitis,
        eduCuciTangan: it.eduCuciTangan,
        eduPerawatanLuka: it.eduPerawatanLuka,
        eduDischarge: it.eduDischarge,
        // TTV
        kriteriaPasien: it.kriteriaPasien,
        arrivalTime: it.arrivalTime,
        isMonitoringOnTime: it.isMonitoringOnTime,
        // Nyeri
        isAnalgeticIvRoutine: it.isAnalgeticIvRoutine,
        painCategory: it.painCategory,
        medicationName: it.medicationName,
        isReEvaluationPostMed: it.isReEvaluationPostMed,
        isReAssessmentPain: it.isReAssessmentPain,
        // EWS
        ewsMonitoringTime: it.ewsMonitoringTime,
        ewsScore: it.ewsScore,
        dpjpReportTime: it.dpjpReportTime,
        isFrequencyIncreased: it.isFrequencyIncreased,
        isActionAppropriate: it.isActionAppropriate,
        isDocumentedInCppt: it.isDocumentedInCppt
      };

      return {
        patientIdentifier: it.patientIdentifier.trim(),
        isCompliant: it.isCompliant,
        notes: it.notes,
        doorTime: it.doorTime,
        eventTime: it.eventTime,
        minutesElapsed: it.minutesElapsed,
        customFieldsJson: JSON.stringify(customData)
      };
    });

    const payload = {
      hospitalUnitId: this.hospitalUnitId,
      nsiIndicatorId: this.indicatorId,
      submissionMonth: this.submissionMonth,
      auditDate: new Date(this.auditDate).toISOString(),
      submittedById: this.currentUser.id,
      notes: this.notes,
      items: payloadItems
    };

    if (this.isEditMode && this.submissionId) {
      this.nsiService.updateSubmission(this.submissionId, payload).subscribe({
        next: () => {
          this.submitting = false;
          this.notify.success('Perubahan data audit dan raw data observasi berhasil disimpan.');
          this.router.navigate(['/nsi-indicators', this.indicatorId]);
        },
        error: (err) => {
          this.submitting = false;
          this.notify.error('Gagal memperbarui audit: ' + (err.error?.message || err.message));
        }
      });
    } else {
      this.nsiService.createSubmission(payload).subscribe({
        next: () => {
          this.submitting = false;
          this.notify.success('Formulir audit raw data berhasil disimpan & diajukan untuk proses approval.');
          this.router.navigate(['/nsi-indicators', this.indicatorId]);
        },
        error: (err) => {
          this.submitting = false;
          this.notify.error('Gagal menyimpan audit: ' + (err.error?.message || err.message));
        }
      });
    }
  }
}
