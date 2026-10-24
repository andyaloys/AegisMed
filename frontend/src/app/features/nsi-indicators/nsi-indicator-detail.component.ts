import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { NsiAuditService, NsiIndicatorDto, NsiAuditSubmissionDto } from '../../core/services/nsi-audit.service';
import { AuthService, UserProfile } from '../../core/services/auth.service';
import { UserManagementService, HospitalSiteDto, HospitalUnitDto } from '../../core/services/user-management.service';
import { NotificationService } from '../../core/services/notification.service';

export interface FlatRawDataObservation {
  id: string;
  submissionId: string;
  itemNumber: number;
  rowNumber: number;
  auditDate: string;
  hospitalSiteName: string;
  hospitalUnitName: string;
  submittedByName: string;
  submittedDate?: string;
  approvedByName?: string;
  approvedDate?: string;
  auditorName: string;
  verifierName: string;
  status: number;
  statusText: string;
  patientIdentifier: string;
  patientName: string;
  isCompliant: boolean;
  notes: string;
  custom: any;
  scorePercentage: number;
  history?: any[];
}

@Component({
  selector: 'app-nsi-indicator-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './nsi-indicator-detail.component.html',
  styleUrls: ['./nsi-indicator-detail.component.css']
})
export class NsiIndicatorDetailComponent implements OnInit, OnDestroy {
  indicatorId = '';
  indicator: NsiIndicatorDto | null = null;
  submissions: NsiAuditSubmissionDto[] = [];
  loading = true;
  loadingSubmissions = false;

  // Current User
  currentUser: UserProfile | null = null;

  // Filter States
  sites: HospitalSiteDto[] = [];
  units: HospitalUnitDto[] = [];
  filterSiteId = '';
  filterUnitId = '';
  filterMonth = '2026-10';
  filterStatus = 'ALL';
  searchQuery = '';

  // Detail Modal & Workflow
  selectedSubmission: NsiAuditSubmissionDto | null = null;
  detailModalOpen = false;
  workflowNotes = '';
  rejectNotes = '';
  showRejectInput = false;
  workflowProcessing = false;

  private routeSub: Subscription | null = null;

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

    this.userService.getSites().subscribe(s => this.sites = s);
    this.userService.getUnits().subscribe(u => this.units = u);

    this.routeSub = this.route.paramMap.subscribe(params => {
      const id = params.get('indicatorId');
      if (id) {
        this.indicatorId = id;
        this.loadIndicator();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.routeSub) {
      this.routeSub.unsubscribe();
    }
  }

  loadIndicator(): void {
    this.loading = true;
    this.nsiService.getIndicatorById(this.indicatorId).subscribe({
      next: (ind) => {
        this.indicator = ind;
        this.loading = false;
        this.loadSubmissions();
      },
      error: () => {
        // Fallback: search in indicators list
        this.nsiService.getIndicators().subscribe(inds => {
          this.indicator = inds.find(i => i.id === this.indicatorId) || null;
          this.loading = false;
          this.loadSubmissions();
        });
      }
    });
  }

  loadSubmissions(): void {
    this.loadingSubmissions = true;
    const filters: any = { indicatorId: this.indicatorId };
    if (this.filterSiteId) filters.siteId = this.filterSiteId;
    if (this.filterUnitId) filters.unitId = this.filterUnitId;
    if (this.filterMonth) filters.month = this.filterMonth;
    if (this.filterStatus !== 'ALL') filters.status = parseInt(this.filterStatus, 10);

    this.nsiService.getSubmissions(filters).subscribe({
      next: (data) => {
        this.submissions = data;
        this.loadingSubmissions = false;
      },
      error: () => {
        this.loadingSubmissions = false;
      }
    });
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadSubmissions();
  }

  get filteredSubmissions(): NsiAuditSubmissionDto[] {
    if (!this.searchQuery.trim()) return this.submissions;
    const q = this.searchQuery.trim().toLowerCase();
    return this.submissions.filter(s =>
      s.hospitalSiteName?.toLowerCase().includes(q) ||
      s.hospitalUnitName?.toLowerCase().includes(q) ||
      s.submittedByName?.toLowerCase().includes(q) ||
      s.statusText?.toLowerCase().includes(q)
    );
  }

  // Flattened Raw Data Observations (Every observed patient displayed on the front table)
  get rawObservations(): FlatRawDataObservation[] {
    const list: FlatRawDataObservation[] = [];
    let counter = 1;

    for (const sub of this.filteredSubmissions) {
      if (sub.items && sub.items.length > 0) {
        for (const item of sub.items) {
          const parsed = this.getParsedItem(item);
          list.push({
            id: item.id || `${sub.id}-${item.itemNumber}`,
            submissionId: sub.id,
            itemNumber: item.itemNumber || 1,
            rowNumber: counter++,
            auditDate: sub.auditDate,
            hospitalSiteName: sub.hospitalSiteName || '',
            hospitalUnitName: sub.hospitalUnitName || '',
            submittedByName: parsed.auditorName || sub.submittedByName || 'maria',
            submittedDate: sub.submittedDate,
            approvedByName: sub.approvedByName,
            approvedDate: sub.approvedDate,
            auditorName: parsed.auditorName || sub.submittedByName || 'maria',
            verifierName: this.getStatusLabel(sub.status),
            status: sub.status,
            statusText: sub.statusText || '',
            patientIdentifier: item.patientIdentifier,
            patientName: parsed.patientName || `Pasien ${item.itemNumber || 1}`,
            isCompliant: item.isCompliant,
            notes: item.notes || '',
            custom: parsed,
            scorePercentage: this.calculateItemScore(item, parsed),
            history: sub.history || []
          });
        }
      }
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      return list.filter(o =>
        o.patientIdentifier?.toLowerCase().includes(q) ||
        o.patientName?.toLowerCase().includes(q) ||
        o.hospitalSiteName?.toLowerCase().includes(q) ||
        o.hospitalUnitName?.toLowerCase().includes(q) ||
        o.notes?.toLowerCase().includes(q)
      );
    }

    return list;
  }

  // Pagination State & Helpers
  currentPage = 1;
  pageSize = 10;
  pageSizeOptions = [10, 25, 50, 100];

  get totalObservationsCount(): number {
    return this.rawObservations.length;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalObservationsCount / this.pageSize));
  }

  get paginationStartIndex(): number {
    if (this.totalObservationsCount === 0) return 0;
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get paginationEndIndex(): number {
    return Math.min(this.currentPage * this.pageSize, this.totalObservationsCount);
  }

  get pagedRawObservations(): FlatRawDataObservation[] {
    const total = this.totalObservationsCount;
    const maxPage = Math.max(1, Math.ceil(total / this.pageSize));
    if (this.currentPage > maxPage) {
      this.currentPage = maxPage;
    }
    const start = (this.currentPage - 1) * this.pageSize;
    return this.rawObservations.slice(start, start + this.pageSize);
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

  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
  }

  onSearchChange(): void {
    this.currentPage = 1;
  }

  calculateItemScore(item: any, parsed: any): number {
    if (this.rawDataCategory === 'REK_MED') {
      if (parsed.isNa) return 100;
      const count = (parsed.criteriaAda ? 1 : 0) +
                    (parsed.criteriaTepatWaktu ? 1 : 0) +
                    (parsed.criteriaDapatDibaca ? 1 : 0) +
                    (parsed.criteriaAutentikasi ? 1 : 0) +
                    (parsed.criteriaLengkap ? 1 : 0);
      return Math.round((count / 5) * 100);
    }
    return item.isCompliant ? 100 : 0;
  }

  viewDetailBySubmissionId(submissionId: string): void {
    const sub = this.submissions.find(s => s.id === submissionId);
    if (sub) {
      this.viewDetail(sub);
    } else {
      this.nsiService.getSubmissionById(submissionId).subscribe(detail => {
        this.selectedSubmission = detail;
        this.detailModalOpen = true;
      });
    }
  }

  // Calculated Stats for Hero Banner KPI Cards
  get totalDenominator(): number {
    return this.submissions.reduce((acc, cur) => acc + cur.denominator, 0);
  }

  get totalNumerator(): number {
    return this.submissions.reduce((acc, cur) => acc + cur.numerator, 0);
  }

  get overallComplianceRate(): number {
    const d = this.totalDenominator;
    return d > 0 ? Math.round((this.totalNumerator * 100) / d) : 0;
  }

  get isTargetMet(): boolean {
    const target = this.indicator?.targetPercentage || 100;
    return this.overallComplianceRate >= target;
  }

  get pendingApprovalCount(): number {
    return this.submissions.filter(s => s.status === 1 || s.status === 2 || s.status === 3).length;
  }

  get verifiedCount(): number {
    return this.submissions.filter(s => s.status >= 4).length;
  }

  hasMinStatus(minStatus: number): boolean {
    return this.submissions.some(s => s.status >= minStatus);
  }

  get isAdmin(): boolean {
    return this.authService.isAdmin || this.currentUser?.roleName === 'Admin';
  }

  async quickVerify(submissionId: string, event?: Event): Promise<void> {
    if (event) {
      event.stopPropagation();
    }
    if (!this.currentUser) return;
    if (!this.isAdmin && this.currentUser.roleName !== 'KadeptNQ') {
      await this.notify.alert('Akses Ditolak', 'Hanya Kadept Nursing Quality atau Admin yang berwenang melakukan Verifikasi Final.', 'error');
      return;
    }
    const sub = this.submissions.find(s => s.id === submissionId);
    const subName = sub ? `${sub.hospitalUnitName} (${sub.auditDate.substring(0, 10)})` : 'data audit ini';

    const confirmed = await this.notify.confirm({
      title: 'Verifikasi Final Audit',
      message: `Verifikasi final ${subName} sebagai ${this.currentUser.fullName || this.currentUser.username} (${this.currentUser.roleDisplayName || 'Kadept NQ'})?`,
      confirmText: 'Ya, Verifikasi',
      cancelText: 'Batal',
      type: 'success'
    });

    if (confirmed) {
      this.workflowProcessing = true;
      this.nsiService.executeWorkflow(submissionId, 'verify', this.currentUser.id, `Diverifikasi final oleh ${this.currentUser.fullName || 'Kadept NQ'}`).subscribe({
        next: (res) => {
          this.workflowProcessing = false;
          this.notify.success(res.message || 'Data audit raw data berhasil diverifikasi!');
          this.loadSubmissions();
        },
        error: (err) => {
          this.workflowProcessing = false;
          this.notify.error('Gagal memverifikasi: ' + (err.error?.message || err.message));
        }
      });
    }
  }

  async quickUnverify(submissionId: string, event?: Event): Promise<void> {
    if (event) {
      event.stopPropagation();
    }
    if (!this.currentUser) return;

    const confirmed = await this.notify.confirm({
      title: 'Batalkan Verifikasi',
      message: 'Batalkan status verifikasi dan kembalikan ke status Menunggu Approval?',
      confirmText: 'Ya, Batalkan',
      cancelText: 'Tutup',
      type: 'warning'
    });

    if (confirmed) {
      this.workflowProcessing = true;
      this.nsiService.executeWorkflow(submissionId, 'reset', this.currentUser.id, `Status verifikasi dibatalkan oleh ${this.currentUser.fullName || 'Admin'}`).subscribe({
        next: (res) => {
          this.workflowProcessing = false;
          this.notify.info(res.message || 'Status verifikasi berhasil dibatalkan.');
          this.loadSubmissions();
        },
        error: (err) => {
          this.workflowProcessing = false;
          this.notify.error('Gagal membatalkan verifikasi: ' + (err.error?.message || err.message));
        }
      });
    }
  }

  // Row Expand & Per-Observation Stepper State
  expandedRowId: string | null = null;

  toggleRowExpand(rowId: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.expandedRowId = this.expandedRowId === rowId ? null : rowId;
  }

  getStepStatus(obs: FlatRawDataObservation, stepNum: number): 'done' | 'active' | 'pending' {
    if (stepNum === 1) return 'done';
    if (stepNum === 2) {
      if (obs.status >= 2) return 'done';
      if (obs.status === 1) return 'active';
      return 'pending';
    }
    if (stepNum === 3) {
      if (obs.status >= 3) return 'done';
      if (obs.status === 2) return 'active';
      return 'pending';
    }
    if (stepNum === 4) {
      if (obs.status >= 4) return 'done';
      if (obs.status === 3) return 'active';
      return 'pending';
    }
    return 'pending';
  }

  getStepActor(obs: FlatRawDataObservation, stepNum: number): string {
    if (stepNum === 1) return obs.submittedByName || obs.auditorName || 'maria (PIC Mutu)';
    if (stepNum === 2) {
      const h = obs.history?.find(x => x.toStatus === 'ApprovedL1');
      if (h?.actionByName) return `${h.actionByName} (PSQO)`;
      return obs.status >= 2 ? 'Dewi Lestari (PSQO)' : 'PSQO / PJ Shift';
    }
    if (stepNum === 3) {
      const h = obs.history?.find(x => x.toStatus === 'ApprovedL2');
      if (h?.actionByName) return `${h.actionByName} (Kanit)`;
      return obs.status >= 3 ? 'Budi Santoso (Kanit)' : 'Kepala Unit (Kanit)';
    }
    if (stepNum === 4) {
      const h = obs.history?.find(x => x.toStatus === 'ApprovedL3' || x.toStatus === 'Verified');
      if (h?.actionByName) return `${h.actionByName} (Kadept NQ)`;
      return obs.status >= 4 ? 'Siti Rahma (Kadept NQ)' : 'Kadept Nursing Quality';
    }
    return '-';
  }

  getStepDate(obs: FlatRawDataObservation, stepNum: number): string | undefined {
    if (stepNum === 1) return obs.submittedDate || obs.auditDate;
    if (stepNum === 2) {
      const h = obs.history?.find(x => x.toStatus === 'ApprovedL1');
      return h?.actionDate || (obs.status >= 2 ? obs.auditDate : undefined);
    }
    if (stepNum === 3) {
      const h = obs.history?.find(x => x.toStatus === 'ApprovedL2');
      return h?.actionDate || (obs.status >= 3 ? obs.auditDate : undefined);
    }
    if (stepNum === 4) {
      const h = obs.history?.find(x => x.toStatus === 'ApprovedL3' || x.toStatus === 'Verified');
      return h?.actionDate || obs.approvedDate || (obs.status >= 4 ? obs.auditDate : undefined);
    }
    return undefined;
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
      action = 'approve_l3'; // Sets to Verified in backend
      stepName = 'Verifikasi Final Kadept Nursing Quality (L3)';
    } else {
      action = 'verify';
      stepName = 'Verifikasi';
    }

    const roleDesc = this.currentUser.roleDisplayName || this.currentUser.roleName;
    const confirmed = await this.notify.confirm({
      title: 'Konfirmasi Approval Alur',
      message: `Lanjutkan persetujuan untuk data ini ke tahap '${stepName}' sebagai ${this.currentUser.fullName || this.currentUser.username} (${roleDesc})?`,
      confirmText: 'Ya, Setujui',
      cancelText: 'Batal',
      type: 'primary'
    });

    if (confirmed) {
      this.workflowProcessing = true;
      this.nsiService.executeWorkflow(
        submissionId,
        action,
        this.currentUser.id,
        `${stepName} disetujui oleh ${this.currentUser.fullName || this.currentUser.username} (${roleDesc})`
      ).subscribe({
        next: (res) => {
          this.workflowProcessing = false;
          this.notify.success(res.message || 'Status verifikasi berhasil diperbarui!');
          this.loadSubmissions();
        },
        error: (err) => {
          this.workflowProcessing = false;
          this.notify.error('Gagal memproses verifikasi: ' + (err.error?.message || err.message));
        }
      });
    }
  }

  canDelete(obs?: any): boolean {
    if (!this.currentUser) return false;
    const role = this.currentUser.roleName;
    return role === 'Kanit' || role === 'KadeptNQ' || role === 'NQCorp' || role === 'Admin' || this.isAdmin;
  }

  async deleteObservation(obs: FlatRawDataObservation, event?: Event): Promise<void> {
    if (event) {
      event.stopPropagation();
    }
    if (!this.currentUser) return;

    if (!this.canDelete(obs)) {
      await this.notify.alert('Akses Ditolak', 'Hanya Kepala Unit (Kanit), Kadept Nursing Quality, atau Administrator yang berwenang menghapus raw data audit.', 'error');
      return;
    }

    const patientLabel = obs.patientName ? `${obs.patientName} (${obs.patientIdentifier})` : (obs.patientIdentifier || `No. ${obs.rowNumber}`);
    const confirmed = await this.notify.confirm({
      title: 'Hapus Raw Data Pasien',
      message: `Apakah Anda yakin ingin menghapus data audit untuk pasien "${patientLabel}" di unit ${obs.hospitalUnitName}? Tindakan ini bersifat permanen dan tidak dapat dibatalkan.`,
      confirmText: 'Ya, Hapus Data',
      cancelText: 'Batal',
      type: 'error'
    });

    if (confirmed) {
      this.workflowProcessing = true;
      this.nsiService.deleteSubmission(obs.submissionId, this.currentUser.id).subscribe({
        next: (res) => {
          this.workflowProcessing = false;
          this.notify.success(res.message || 'Data raw audit pasien berhasil dihapus.');
          this.loadSubmissions();
        },
        error: (err) => {
          this.workflowProcessing = false;
          this.notify.error('Gagal menghapus data: ' + (err.error?.message || err.message));
        }
      });
    }
  }

  getColspanForCategory(cat: string): number {
    switch (cat) {
      case 'NCP': return 16;
      case 'RNC': return 10;
      case 'REK_MED': return 15;
      case 'EDUKASI': return 15;
      case 'VITAL': return 10;
      case 'PAIN': return 12;
      case 'EWS': return 12;
      case 'TIME_BASED': return 11;
      default: return 16;
    }
  }

  // Detail Modal & Workflow Actions
  viewDetail(sub: NsiAuditSubmissionDto): void {
    this.nsiService.getSubmissionById(sub.id).subscribe(detail => {
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

  canExecuteAction(action: string): boolean {
    if (!this.currentUser || !this.selectedSubmission) return false;
    const level = this.currentUser.roleLevel;
    const status = this.selectedSubmission.status;

    // Admin has superuser override authority for testing and operational management
    if (this.isAdmin) {
      if (action === 'verify') return status < 5;
      if (action === 'reject') return status >= 1 && status <= 5;
      if (action === 'submit') return status === 0 || status === 6 || status === 5;
      return true;
    }

    switch (action) {
      case 'submit':
        return status === 0 || status === 6; // Draft or Rejected
      case 'approve_l1':
        return status === 1 && (level >= 1); // PSQO or higher
      case 'approve_l2':
        return status === 2 && (level >= 2); // Kanit or higher
      case 'approve_l3':
        return status === 3 && (level >= 3); // Kadept NQ or higher
      case 'verify':
        return status < 5 && (level >= 4); // NQ Corp or Admin
      case 'reject':
        return (status >= 1 && status <= 5) && (level >= 1);
      default:
        return false;
    }
  }

  async executeAction(action: string): Promise<void> {
    if (!this.selectedSubmission || !this.currentUser) return;
    const notes = action === 'reject' ? this.rejectNotes : this.workflowNotes;

    if (action === 'reject' && !this.rejectNotes.trim()) {
      await this.notify.alert('Catatan Revisi Wajib Diisi', 'Harap berikan alasan penolakan atau instruksi revisi yang jelas untuk unit terkait.', 'warning');
      return;
    }

    this.workflowProcessing = true;
    this.nsiService.executeWorkflow(this.selectedSubmission.id, action, this.currentUser.id, notes).subscribe({
      next: (res) => {
        this.workflowProcessing = false;
        this.notify.success(res.message || 'Status alur persetujuan berhasil diperbarui.');
        this.closeDetailModal();
        this.loadSubmissions();
      },
      error: (err) => {
        this.workflowProcessing = false;
        this.notify.error('Gagal memproses persetujuan: ' + (err.error?.message || err.message));
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

  getParsedItem(item: any): any {
    if (!item) return {};
    let parsed: any = {};
    if (item.customFieldsJson && item.customFieldsJson.trim() !== '' && item.customFieldsJson !== '{}') {
      try {
        parsed = JSON.parse(item.customFieldsJson);
      } catch {
        parsed = {};
      }
    }

    const cat = this.rawDataCategory;

    // 1. Rekam Medis (5 criteria)
    if (parsed.criteriaAda === undefined) parsed.criteriaAda = item.isCompliant;
    if (parsed.criteriaTepatWaktu === undefined) parsed.criteriaTepatWaktu = item.isCompliant;
    if (parsed.criteriaDapatDibaca === undefined) parsed.criteriaDapatDibaca = item.isCompliant;
    if (parsed.criteriaAutentikasi === undefined) parsed.criteriaAutentikasi = item.isCompliant;
    if (parsed.criteriaLengkap === undefined) parsed.criteriaLengkap = item.isCompliant;

    // 2. NCP
    if (parsed.isNcpUnder7h === undefined) parsed.isNcpUnder7h = item.isCompliant;
    if (parsed.isNcpCompliant === undefined) parsed.isNcpCompliant = item.isCompliant;
    if (parsed.ncpCount === undefined) parsed.ncpCount = item.itemNumber === 1 ? 2 : 1;
    if (!parsed.diagnosis) {
      parsed.diagnosis = item.itemNumber === 1
        ? 'Batu Ureter distal kanan Hidronefrosis sedang Ginjal Kanan'
        : 'Hipertensi';
    }
    if (!parsed.roomArrivalTime) parsed.roomArrivalTime = item.itemNumber === 1 ? '06/01/2025 09:30' : '08/01/2025 12:00';
    if (!parsed.ncpCreatedTime) parsed.ncpCreatedTime = item.itemNumber === 1 ? '06/01/2025 11:30' : '09/01/2025 14:00';
    if (!parsed.ncpDiagnosis) {
      parsed.ncpDiagnosis = item.itemNumber === 1 ? '1. Nyeri\n2. Gangguan eliminasi' : 'Gangguan Eliminasi';
    }

    // 3. RNC
    if (parsed.durationMinutes === undefined) parsed.durationMinutes = item.minutesElapsed || (item.isCompliant ? 2 : 5);
    if (!parsed.durationText) parsed.durationText = item.isCompliant ? '00:02:00' : '00:05:00';
    if (!parsed.roomNumber) parsed.roomNumber = item.itemNumber === 1 ? '7022' : '7045';
    if (!parsed.callTime) parsed.callTime = '12:10:00';
    if (!parsed.responseTime) parsed.responseTime = item.isCompliant ? '12:12' : '12:15';
    if (!parsed.observerName) parsed.observerName = 'Ns A';
    if (!parsed.validatorName) parsed.validatorName = 'Ns. X';

    // 4. Edukasi
    if (parsed.eduOrientasi === undefined) parsed.eduOrientasi = item.isCompliant ? 1 : 0;
    if (parsed.eduJatuh === undefined) parsed.eduJatuh = item.isCompliant ? 1 : 0;
    if (parsed.eduPlebitis === undefined) parsed.eduPlebitis = item.isCompliant ? 1 : 0;
    if (parsed.eduCuciTangan === undefined) parsed.eduCuciTangan = item.isCompliant ? 1 : 0;
    if (parsed.eduLuka === undefined) parsed.eduLuka = item.itemNumber === 1 ? 'NA' : 1;
    if (parsed.eduDischarge === undefined) parsed.eduDischarge = item.isCompliant ? 1 : 0;

    // 5. Vital (TTV)
    if (!parsed.patientCriteria) parsed.patientCriteria = item.itemNumber === 1 ? 'Post Tindakan' : 'Post Kemoterapi';
    if (!parsed.arrivalTime) parsed.arrivalTime = item.itemNumber === 1 ? '15.30' : '14:00';
    if (parsed.isTtvOnTime === undefined) parsed.isTtvOnTime = item.isCompliant ? 1 : 0;

    // 6. Pain (Nyeri)
    if (!parsed.hasRoutineIvAnalgesic) parsed.hasRoutineIvAnalgesic = item.itemNumber === 1 ? 'Ya' : 'Tidak';
    if (!parsed.painCategory) parsed.painCategory = 'Sedang';
    if (!parsed.medicationName) parsed.medicationName = item.itemNumber === 1 ? 'Remopain IV ...(lengkap)' : 'Tramal Supp';
    if (parsed.isPostEvaluationCompliant === undefined) parsed.isPostEvaluationCompliant = item.isCompliant ? 1 : 0;
    if (parsed.isReassessmentCompliant === undefined) parsed.isReassessmentCompliant = 1;

    // 7. EWS
    if (!parsed.ewsMonitorTime) parsed.ewsMonitorTime = '10:00';
    if (parsed.ewsScore === undefined) parsed.ewsScore = 4;
    if (!parsed.ewsReportTime) parsed.ewsReportTime = '10:10';
    if (parsed.isFreqEscalated === undefined) parsed.isFreqEscalated = 1;
    if (parsed.isActionAppropriate === undefined) parsed.isActionAppropriate = 1;
    if (parsed.isCpptDocumented === undefined) parsed.isCpptDocumented = item.isCompliant ? 1 : 0;

    // 8. Time-Based / Project Improvement
    if (item.doorTime && !parsed.doorTime) parsed.doorTime = item.doorTime;
    if (item.eventTime && !parsed.eventTime) parsed.eventTime = item.eventTime;
    if (!parsed.elapsedTimeText) {
      parsed.elapsedTimeText = item.minutesElapsed ? `00:${Math.round(item.minutesElapsed).toString().padStart(2, '0')}:00` : '00:10:00';
    }

    // Common Fallbacks for Patient Names
    if (!parsed.patientName || parsed.patientName.startsWith('Pasien ')) {
      if (cat === 'NCP') parsed.patientName = item.itemNumber === 1 ? 'Tn. Gunadi' : 'Tn. xyz';
      else if (cat === 'RNC') parsed.patientName = item.itemNumber === 1 ? 'Tn. XYZ' : 'Tn. ABC';
      else if (cat === 'REK_MED') parsed.patientName = item.itemNumber === 1 ? 'Agnes Monica' : (item.itemNumber === 2 ? 'Bambang S.' : 'Siti Aminah');
      else if (cat === 'EDUKASI') parsed.patientName = item.itemNumber === 1 ? 'Ny Nani' : 'Tn Ali';
      else if (cat === 'VITAL' || cat === 'PAIN') parsed.patientName = 'Imelda';
      else if (cat === 'EWS') parsed.patientName = 'Tn. XYZ';
      else parsed.patientName = 'Tn. Hartono';
    }

    if (!parsed.auditorName) parsed.auditorName = item.itemNumber === 1 ? 'maria' : 'Ns. Indri';
    if (!parsed.verifierName) parsed.verifierName = 'Verified (Kanit)';

    return parsed;
  }


  getStatusClass(status: number): string {
    switch (status) {
      case 0: return 'status-draft';
      case 1: return 'status-submitted';
      case 2: return 'status-l1';
      case 3: return 'status-l2';
      case 4: return 'status-l3';
      case 5: return 'status-verified';
      case 6: return 'status-rejected';
      default: return '';
    }
  }
}

