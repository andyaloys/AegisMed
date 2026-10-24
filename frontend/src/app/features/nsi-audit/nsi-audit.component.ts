import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NsiAuditService, NsiCategoryDto, NsiIndicatorDto, NsiAuditSubmissionDto, NsiSummaryDto } from '../../core/services/nsi-audit.service';
import { AuthService, UserProfile } from '../../core/services/auth.service';
import { UserManagementService, HospitalSiteDto, HospitalUnitDto } from '../../core/services/user-management.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-nsi-audit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './nsi-audit.component.html',
  styleUrls: ['./nsi-audit.component.css']
})
export class NsiAuditComponent implements OnInit {
  activeTab: 'submissions' | 'summary' = 'submissions';
  loading = false;
  submitting = false;

  // Data
  categories: NsiCategoryDto[] = [];
  indicators: NsiIndicatorDto[] = [];
  submissions: NsiAuditSubmissionDto[] = [];
  summaryData: NsiSummaryDto | null = null;
  sites: HospitalSiteDto[] = [];
  units: HospitalUnitDto[] = [];

  // KPI helper predicates
  hasPendingL1OrL2 = (s: NsiAuditSubmissionDto) => s.status === 1 || s.status === 2;
  hasPendingL3 = (s: NsiAuditSubmissionDto) => s.status === 3;
  hasVerified = (s: NsiAuditSubmissionDto) => s.status === 5;

  // Current User
  currentUser: UserProfile | null = null;

  // Filters
  filterMonth = '2026-10';
  filterSiteId = '';
  filterUnitId = '';
  filterIndicatorId = '';
  filterStatus: string = '';

  // Input Modal State
  inputModalOpen = false;
  newAudit = {
    siteId: '',
    unitId: '',
    indicatorId: '',
    auditDate: new Date().toISOString().substring(0, 10),
    month: '2026-10',
    notes: '',
    items: [
      { patientIdentifier: 'RM-5501', isCompliant: true, notes: 'Dokumentasi lengkap dan terverifikasi' },
      { patientIdentifier: 'RM-5502', isCompliant: true, notes: 'Sesuai standar operasional' },
      { patientIdentifier: 'RM-5503', isCompliant: false, notes: 'Paraf perawat terlewat pada lembar transfer' },
      { patientIdentifier: 'RM-5504', isCompliant: true, notes: 'Lengkap' },
      { patientIdentifier: 'RM-5505', isCompliant: true, notes: 'Lengkap dan tepat waktu' }
    ]
  };

  // Detail & Approval Modal State
  detailModalOpen = false;
  selectedSubmission: NsiAuditSubmissionDto | null = null;
  workflowNotes = '';
  rejectNotes = '';
  showRejectInput = false;

  constructor(
    private nsiService: NsiAuditService,
    public authService: AuthService,
    private userService: UserManagementService,
    private notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user && user.hospitalSiteId && !this.filterSiteId) {
        // If not corporate, default to user's site
        if (user.roleScope !== 'Corporate') {
          this.filterSiteId = user.hospitalSiteId;
          this.newAudit.siteId = user.hospitalSiteId;
        }
      }
      if (user && user.hospitalUnitId) {
        this.newAudit.unitId = user.hospitalUnitId;
      }
    });

    this.loadMetadata();
    this.loadSubmissions();
    this.loadSummary();
  }

  loadMetadata(): void {
    this.nsiService.getCategories().subscribe(cats => {
      this.categories = cats;
    });

    this.nsiService.getIndicators().subscribe(inds => {
      this.indicators = inds;
    });

    this.userService.getSites().subscribe(sites => {
      this.sites = sites;
      if (!this.newAudit.siteId && sites.length > 0) {
        this.newAudit.siteId = sites[0].id;
        this.onSiteChange(this.newAudit.siteId);
      }
    });
  }

  onSiteChange(siteId: string): void {
    if (!siteId) {
      this.units = [];
      return;
    }
    this.userService.getUnits(siteId).subscribe(units => {
      this.units = units;
      if (units.length > 0 && !this.newAudit.unitId) {
        this.newAudit.unitId = units[0].id;
      }
    });
  }

  onFilterChange(): void {
    this.loadSubmissions();
    this.loadSummary();
  }

  loadSubmissions(): void {
    this.loading = true;
    const filters: any = {};
    if (this.filterSiteId) filters.siteId = this.filterSiteId;
    if (this.filterUnitId) filters.unitId = this.filterUnitId;
    if (this.filterIndicatorId) filters.indicatorId = this.filterIndicatorId;
    if (this.filterMonth) filters.month = this.filterMonth;
    if (this.filterStatus !== '') filters.status = parseInt(this.filterStatus, 10);

    this.nsiService.getSubmissions(filters).subscribe({
      next: (data) => {
        this.submissions = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  loadSummary(): void {
    this.nsiService.getSummary(this.filterMonth, this.filterSiteId || undefined, this.filterUnitId || undefined).subscribe({
      next: (res) => {
        this.summaryData = res;
      }
    });
  }

  // Input Modal Helpers
  openInputModal(): void {
    this.inputModalOpen = true;
    if (this.newAudit.siteId) {
      this.onSiteChange(this.newAudit.siteId);
    }
    if (this.indicators.length > 0 && !this.newAudit.indicatorId) {
      this.newAudit.indicatorId = this.indicators[0].id;
    }
  }

  closeInputModal(): void {
    this.inputModalOpen = false;
  }

  addPatientRow(): void {
    const nextIdx = this.newAudit.items.length + 1;
    this.newAudit.items.push({
      patientIdentifier: `RM-${5500 + nextIdx}`,
      isCompliant: true,
      notes: ''
    });
  }

  removePatientRow(idx: number): void {
    if (this.newAudit.items.length > 1) {
      this.newAudit.items.splice(idx, 1);
    }
  }

  get calculateNumerator(): number {
    return this.newAudit.items.filter(i => i.isCompliant).length;
  }

  get calculateDenominator(): number {
    return this.newAudit.items.length;
  }

  get calculateComplianceRate(): number {
    const d = this.calculateDenominator;
    return d > 0 ? Math.round((this.calculateNumerator * 100) / d) : 0;
  }

  async submitAudit(): Promise<void> {
    if (!this.newAudit.unitId || !this.newAudit.indicatorId) {
      await this.notify.alert('Pilihan Belum Lengkap', 'Pilih Rumah Sakit, Unit, dan Indikator terlebih dahulu.', 'warning');
      return;
    }

    if (!this.currentUser) {
      await this.notify.alert('Sesi Berakhir', 'Silakan login terlebih dahulu.', 'warning');
      return;
    }

    this.submitting = true;
    this.nsiService.createSubmission({
      hospitalUnitId: this.newAudit.unitId,
      nsiIndicatorId: this.newAudit.indicatorId,
      submissionMonth: this.newAudit.month,
      auditDate: this.newAudit.auditDate,
      submittedById: this.currentUser.id,
      notes: this.newAudit.notes,
      items: this.newAudit.items
    }).subscribe({
      next: () => {
        this.submitting = false;
        this.closeInputModal();
        this.notify.success('Data audit berhasil disimpan.');
        this.loadSubmissions();
        this.loadSummary();
      },
      error: (err) => {
        this.submitting = false;
        this.notify.error('Gagal menyimpan audit: ' + (err.error?.message || err.message));
      }
    });
  }

  // Detail Modal & Workflow
  viewDetail(submission: NsiAuditSubmissionDto): void {
    this.nsiService.getSubmissionById(submission.id).subscribe(detail => {
      this.selectedSubmission = detail;
      this.detailModalOpen = true;
      this.showRejectInput = false;
      this.workflowNotes = '';
      this.rejectNotes = '';
    });
  }

  closeDetailModal(): void {
    this.detailModalOpen = false;
    this.selectedSubmission = null;
  }

  // Workflow actions
  canApproveCurrent(submission: NsiAuditSubmissionDto): boolean {
    if (!this.currentUser) return false;
    const role = this.currentUser.roleName;
    if (role === 'Admin') return true;

    // Status 1 = Submitted -> Can be approved by PSQO (Level 1) or Kanit
    if (submission.status === 1 && (role === 'PSQO' || role === 'Kanit')) return true;
    // Status 2 = ApprovedL1 -> Can be approved by Kanit (Level 2)
    if (submission.status === 2 && role === 'Kanit') return true;
    // Status 3 = ApprovedL2 -> Can be approved by Kadept NQ (Level 3)
    if (submission.status === 3 && role === 'KadeptNQ') return true;
    // Status 4 = ApprovedL3 -> Can be verified by NQ Corp (Corporate Level)
    if (submission.status === 4 && role === 'NQCorp') return true;

    return false;
  }

  async executeApproval(action: string): Promise<void> {
    if (!this.selectedSubmission || !this.currentUser) return;

    const notes = action === 'reject' ? this.rejectNotes : this.workflowNotes;
    if (action === 'reject' && !notes.trim()) {
      await this.notify.alert('Catatan Revisi Wajib Diisi', 'Harap berikan catatan revisi / alasan penolakan.', 'warning');
      return;
    }

    this.submitting = true;
    this.nsiService.executeWorkflow(this.selectedSubmission.id, action, this.currentUser.id, notes).subscribe({
      next: () => {
        this.submitting = false;
        this.closeDetailModal();
        this.notify.success('Status alur audit berhasil diperbarui.');
        this.loadSubmissions();
        this.loadSummary();
      },
      error: (err) => {
        this.submitting = false;
        this.notify.error('Gagal memproses workflow: ' + (err.error?.message || err.message));
      }
    });
  }

  getStatusBadgeClass(status: number): string {
    switch (status) {
      case 0: return 'badge-draft';
      case 1: return 'badge-submitted';
      case 2: return 'badge-l1';
      case 3: return 'badge-l2';
      case 4: return 'badge-l3';
      case 5: return 'badge-verified';
      case 6: return 'badge-rejected';
      default: return 'badge-default';
    }
  }

  getStatusLabel(status: number): string {
    switch (status) {
      case 0: return 'Draft';
      case 1: return 'Menunggu Approval PSQO';
      case 2: return 'Approved L1 (PSQO)';
      case 3: return 'Approved L2 (Kanit)';
      case 4: return 'Approved L3 (Kadept NQ)';
      case 5: return 'Terverifikasi Corporate';
      case 6: return 'Ditolak / Perlu Revisi';
      default: return 'Unknown';
    }
  }
}
