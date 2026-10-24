import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PdsaService, PdsaActionDto } from '../../core/services/pdsa.service';
import { NsiAuditService, NsiIndicatorDto } from '../../core/services/nsi-audit.service';
import { AuthService, UserProfile } from '../../core/services/auth.service';
import { UserManagementService, HospitalSiteDto, HospitalUnitDto } from '../../core/services/user-management.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-pdsa',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pdsa.component.html',
  styleUrls: ['./pdsa.component.css']
})
export class PdsaComponent implements OnInit {
  loading = false;
  submitting = false;

  actions: PdsaActionDto[] = [];
  indicators: NsiIndicatorDto[] = [];
  sites: HospitalSiteDto[] = [];
  units: HospitalUnitDto[] = [];

  currentUser: UserProfile | null = null;

  // Filters
  filterMonth = '2026-10';
  filterSiteId = '';
  filterUnitId = '';
  filterStatus: string = '';

  // Create Modal
  createModalOpen = false;
  newPdsa = {
    siteId: '',
    unitId: '',
    indicatorId: '',
    month: '2026-10',
    achievementRate: 85.0,
    numerator: 17,
    denominator: 20,
    rootCauseAnalysis: '',
    improvementPlan: '',
    pic: '',
    targetDate: ''
  };

  // Detail & Review Modal
  detailModalOpen = false;
  selectedPdsa: PdsaActionDto | null = null;
  reviewNotes = '';
  showReviseBox = false;

  constructor(
    private pdsaService: PdsaService,
    private nsiService: NsiAuditService,
    public authService: AuthService,
    private userService: UserManagementService,
    private notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user && user.hospitalSiteId && !this.filterSiteId) {
        if (user.roleScope !== 'Corporate') {
          this.filterSiteId = user.hospitalSiteId;
          this.newPdsa.siteId = user.hospitalSiteId;
        }
      }
      if (user && user.hospitalUnitId) {
        this.newPdsa.unitId = user.hospitalUnitId;
      }
    });

    this.loadMetadata();
    this.loadPdsaActions();
  }

  loadMetadata(): void {
    this.nsiService.getIndicators().subscribe(inds => {
      this.indicators = inds;
      if (inds.length > 0 && !this.newPdsa.indicatorId) {
        this.newPdsa.indicatorId = inds[0].id;
      }
    });

    this.userService.getSites().subscribe(sites => {
      this.sites = sites;
      if (!this.newPdsa.siteId && sites.length > 0) {
        this.newPdsa.siteId = sites[0].id;
        this.onSiteChange(this.newPdsa.siteId);
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
      if (units.length > 0 && !this.newPdsa.unitId) {
        this.newPdsa.unitId = units[0].id;
      }
    });
  }

  loadPdsaActions(): void {
    this.loading = true;
    const filters: any = {};
    if (this.filterSiteId) filters.siteId = this.filterSiteId;
    if (this.filterUnitId) filters.unitId = this.filterUnitId;
    if (this.filterMonth) filters.month = this.filterMonth;
    if (this.filterStatus !== '') filters.status = parseInt(this.filterStatus, 10);

    this.pdsaService.getPdsaActions(filters).subscribe({
      next: (data) => {
        this.actions = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  openCreateModal(): void {
    this.createModalOpen = true;
    if (this.newPdsa.siteId) {
      this.onSiteChange(this.newPdsa.siteId);
    }
    if (this.currentUser) {
      this.newPdsa.pic = this.currentUser.fullName;
    }
  }

  closeCreateModal(): void {
    this.createModalOpen = false;
  }

  async submitPdsa(): Promise<void> {
    if (!this.newPdsa.unitId || !this.newPdsa.indicatorId) {
      await this.notify.alert('Data Belum Lengkap', 'Pilih Rumah Sakit, Unit, dan Indikator terlebih dahulu.', 'warning');
      return;
    }
    if (!this.newPdsa.rootCauseAnalysis.trim() || !this.newPdsa.improvementPlan.trim()) {
      await this.notify.alert('Form Belum Lengkap', 'Analisa penyebab dan rencana perbaikan wajib diisi.', 'warning');
      return;
    }
    if (!this.currentUser) {
      await this.notify.alert('Sesi Berakhir', 'Silakan login terlebih dahulu.', 'warning');
      return;
    }

    this.submitting = true;
    this.pdsaService.createPdsa({
      hospitalUnitId: this.newPdsa.unitId,
      nsiIndicatorId: this.newPdsa.indicatorId,
      month: this.newPdsa.month,
      achievementRate: this.newPdsa.achievementRate,
      numerator: this.newPdsa.numerator,
      denominator: this.newPdsa.denominator,
      rootCauseAnalysis: this.newPdsa.rootCauseAnalysis,
      improvementPlan: this.newPdsa.improvementPlan,
      pic: this.newPdsa.pic,
      targetDate: this.newPdsa.targetDate || undefined,
      createdById: this.currentUser.id
    }).subscribe({
      next: () => {
        this.submitting = false;
        this.closeCreateModal();
        this.notify.success('Rencana tindak lanjut PDSA berhasil disimpan.');
        this.loadPdsaActions();
      },
      error: (err) => {
        this.submitting = false;
        this.notify.error('Gagal menyimpan PDSA: ' + (err.error?.message || err.message));
      }
    });
  }

  viewDetail(pdsa: PdsaActionDto): void {
    this.pdsaService.getPdsaById(pdsa.id).subscribe(detail => {
      this.selectedPdsa = detail;
      this.detailModalOpen = true;
      this.showReviseBox = false;
      this.reviewNotes = '';
    });
  }

  closeDetailModal(): void {
    this.detailModalOpen = false;
    this.selectedPdsa = null;
  }

  canVerify(pdsa: PdsaActionDto): boolean {
    if (!this.currentUser) return false;
    const role = this.currentUser.roleName;
    return role === 'Admin' || role === 'KadeptNQ';
  }

  async executeWorkflow(action: string): Promise<void> {
    if (!this.selectedPdsa || !this.currentUser) return;

    if (action === 'revise' && !this.reviewNotes.trim()) {
      await this.notify.alert('Catatan Revisi Wajib Diisi', 'Harap berikan catatan revisi untuk Kepala Unit.', 'warning');
      return;
    }

    this.submitting = true;
    this.pdsaService.executeWorkflow(this.selectedPdsa.id, action, this.currentUser.id, this.reviewNotes).subscribe({
      next: () => {
        this.submitting = false;
        this.closeDetailModal();
        this.notify.success('Review PDSA berhasil diproses.');
        this.loadPdsaActions();
      },
      error: (err) => {
        this.submitting = false;
        this.notify.error('Gagal memproses review: ' + (err.error?.message || err.message));
      }
    });
  }

  getStatusBadgeClass(status: number): string {
    switch (status) {
      case 0: return 'badge-draft';
      case 1: return 'badge-submitted';
      case 2: return 'badge-verified';
      case 3: return 'badge-rejected';
      default: return 'badge-default';
    }
  }

  getStatusLabel(status: number): string {
    switch (status) {
      case 0: return 'Draft';
      case 1: return 'Diajukan Kanit';
      case 2: return 'Disetujui Kadept NQ';
      case 3: return 'Perlu Revisi';
      default: return 'Unknown';
    }
  }
}
