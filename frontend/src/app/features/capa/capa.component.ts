import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DashboardService, DashboardData } from '../../core/services/dashboard.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-capa',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './capa.component.html',
  styleUrls: []
})
export class CapaComponent implements OnInit, OnDestroy {
  data: DashboardData | null = null;
  loading = true;
  error = false;
  errorMessage = '';

  // Active site filter
  selectedSiteId: string | undefined = undefined;

  // CAPA actions list
  capaActions: any[] = [];
  loadingCapas = false;

  // Filter & Search
  searchQuery = '';
  statusFilter: 'ALL' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CRITICAL' = 'ALL';

  private filterSub: Subscription | null = null;

  // Generate CAPA Modal State
  showGenerateCapaModal = false;
  generatingCapa = false;
  genCapaSiteId = '';
  genCapaMonth = '';
  genCapaSuccess = false;
  genCapaError = false;
  genCapaMessage = '';

  // Edit / Input CAPA Modal State
  showCapaFormModal = false;
  editingCapa: any = null;
  submittingCapa = false;
  capaSuccess = false;
  capaError = false;

  // CAPA Form Fields
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

  constructor(
    private dashboardService: DashboardService,
    private notify: NotificationService
  ) {}

  ngOnInit(): void {
    // Reactively subscribe to sidebar site filter changes
    this.filterSub = this.dashboardService.selectedSiteId$.subscribe(siteId => {
      this.selectedSiteId = (!siteId || siteId === 'undefined' || siteId === 'null') ? undefined : siteId;
      this.loadLayoutData();
      this.loadCapaActions();
    });
  }

  ngOnDestroy(): void {
    if (this.filterSub) {
      this.filterSub.unsubscribe();
    }
  }

  loadLayoutData(): void {
    const cleanSiteId = (!this.selectedSiteId || this.selectedSiteId === 'undefined' || this.selectedSiteId === 'null') 
      ? undefined 
      : this.selectedSiteId;
    this.selectedSiteId = cleanSiteId;

    this.dashboardService.getDashboardData(
      cleanSiteId,
      this.dashboardService.getFilterStartMonth(),
      this.dashboardService.getFilterEndMonth()
    ).subscribe({
      next: (res) => {
        this.data = res;
      },
      error: (err) => console.error(err)
    });
  }

  loadCapaActions(): void {
    this.loadingCapas = true;
    const cleanSiteId = (!this.selectedSiteId || this.selectedSiteId === 'undefined' || this.selectedSiteId === 'null') 
      ? undefined 
      : this.selectedSiteId;
    this.selectedSiteId = cleanSiteId;

    this.dashboardService.getCapaActions(cleanSiteId).subscribe({
      next: (res) => {
        this.capaActions = res;
        this.loadingCapas = false;
        this.loading = false;
        this.error = false;
      },
      error: (err) => {
        console.error(err);
        this.error = true;
        this.errorMessage = 'Gagal memuat daftar tindakan CAPA.';
        this.loadingCapas = false;
        this.loading = false;
      }
    });
  }

  // CAPA actions methods
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

  editCapaAction(capa: any): void {
    this.showCapaFormModal = true;
    this.editingCapa = capa;
    this.newCapaTitle = capa.title;
    this.newCapaDescription = capa.description;
    this.newCapaSeverity = capa.severity;
    this.newCapaStatus = capa.status;
    this.newCapaDueDate = capa.dueDate ? capa.dueDate.split('T')[0] : '';
    this.newCapaAssignedTo = capa.assignedTo;
    this.newCapaSiteId = capa.hospitalSiteId;
    this.newCapaRootCause = capa.rootCause || '';
    this.newCapaCorrectiveAction = capa.correctiveAction || '';
    this.newCapaPreventiveAction = capa.preventiveAction || '';
    this.newCapaActionPlan = capa.actionPlan || '';
    this.capaSuccess = false;
    this.capaError = false;
  }

  saveCapaAction(): void {
    if (!this.newCapaTitle || !this.newCapaDescription || !this.newCapaSiteId) {
      this.capaError = true;
      return;
    }

    const payload = {
      title: this.newCapaTitle,
      description: this.newCapaDescription,
      severity: this.newCapaSeverity,
      status: this.newCapaStatus,
      dueDate: this.newCapaDueDate ? new Date(this.newCapaDueDate).toISOString() : new Date().toISOString(),
      assignedTo: this.newCapaAssignedTo,
      hospitalSiteId: this.newCapaSiteId,
      rootCause: this.newCapaRootCause,
      correctiveAction: this.newCapaCorrectiveAction,
      preventiveAction: this.newCapaPreventiveAction,
      actionPlan: this.newCapaActionPlan
    };

    this.submittingCapa = true;
    this.capaSuccess = false;
    this.capaError = false;

    if (this.editingCapa) {
      // Update
      this.dashboardService.updateCapaAction(this.editingCapa.id, payload).subscribe({
        next: () => {
          this.submittingCapa = false;
          this.capaSuccess = true;
          this.showCapaFormModal = false;
          this.loadCapaActions();
        },
        error: (err) => {
          console.error(err);
          this.submittingCapa = false;
          this.capaError = true;
        }
      });
    } else {
      // Create (Manual - kept for service completeness, but button hidden)
      this.dashboardService.createCapaAction(payload).subscribe({
        next: () => {
          this.submittingCapa = false;
          this.capaSuccess = true;
          this.showCapaFormModal = false;
          this.loadCapaActions();
        },
        error: (err) => {
          console.error(err);
          this.submittingCapa = false;
          this.capaError = true;
        }
      });
    }
  }

  async deleteCapaAction(id: string): Promise<void> {
    const confirmed = await this.notify.confirm({
      title: 'Hapus Tindakan CAPA',
      message: 'Apakah Anda yakin ingin menghapus tindakan CAPA ini? Spreadsheet UGD pada periode & site terkait otomatis akan terbuka kembali.',
      confirmText: 'Ya, Hapus CAPA',
      cancelText: 'Batal',
      type: 'error'
    });

    if (confirmed) {
      this.dashboardService.deleteCapaAction(id).subscribe({
        next: () => {
          this.notify.success('Tindakan CAPA berhasil dihapus.');
          this.loadCapaActions();
        },
        error: (err) => {
          this.notify.error('Gagal menghapus tindakan CAPA: ' + (err.error?.message || err.message));
        }
      });
    }
  }

  // Monthly CAPA Generator modal
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

  getMaxMonthForGeneration(): string {
    const today = new Date();
    const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const year = prevMonthDate.getFullYear();
    const month = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  executeGenerateCapas(): void {
    if (!this.genCapaSiteId || !this.genCapaMonth) {
      this.genCapaError = true;
      this.genCapaMessage = 'Mohon isi seluruh bidang wajib (Rumah Sakit dan Bulan).';
      return;
    }

    const stringToMonthValue = (str: string) => {
      const parts = str.split('-');
      return parseInt(parts[0]) * 12 + parseInt(parts[1]);
    };

    const maxMonth = this.getMaxMonthForGeneration();
    if (stringToMonthValue(this.genCapaMonth) > stringToMonthValue(maxMonth)) {
      this.genCapaError = true;
      this.genCapaMessage = 'Anda hanya dapat meng-generate CAPA untuk bulan yang sudah lewat saja.';
      return;
    }

    this.generatingCapa = true;
    this.genCapaSuccess = false;
    this.genCapaError = false;

    this.dashboardService.generateCapas(this.genCapaSiteId, this.genCapaMonth).subscribe({
      next: (res: any) => {
        this.generatingCapa = false;
        this.genCapaSuccess = true;
        this.genCapaMessage = res.message || 'CAPA berhasil digenerate!';
        this.loadCapaActions();
      },
      error: (err: any) => {
        console.error(err);
        this.generatingCapa = false;
        this.genCapaError = true;
        this.genCapaMessage = err.error || 'Terjadi kesalahan sistem saat men-generate CAPA.';
      }
    });
  }

  // UI Helpers
  getScoreClass(score: number): string {
    if (score >= 90) return 'score-green';
    if (score >= 80) return 'score-amber';
    return 'score-red';
  }

  getSelectedSiteName(): string {
    if (!this.selectedSiteId || !this.data || !this.data.siteCompliance) {
      return 'Semua Rumah Sakit';
    }
    const site = this.data.siteCompliance.find(s => s.siteId === this.selectedSiteId);
    return site ? site.siteName : 'Semua Rumah Sakit';
  }

  getFilteredCapas(): any[] {
    if (!Array.isArray(this.capaActions)) return [];
    let list = this.capaActions;

    if (this.statusFilter === 'OPEN') {
      list = list.filter(c => c.status && c.status.toLowerCase() === 'open');
    } else if (this.statusFilter === 'IN_PROGRESS') {
      list = list.filter(c => c.status && c.status.toLowerCase() === 'inprogress');
    } else if (this.statusFilter === 'RESOLVED') {
      list = list.filter(c => c.status && c.status.toLowerCase() === 'resolved');
    } else if (this.statusFilter === 'CRITICAL') {
      list = list.filter(c => c.severity && c.severity.toLowerCase() === 'critical');
    }

    if (this.searchQuery && this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter(c => 
        (c.title && c.title.toLowerCase().includes(q)) ||
        (c.description && c.description.toLowerCase().includes(q)) ||
        (c.assignedTo && c.assignedTo.toLowerCase().includes(q)) ||
        (c.siteName && c.siteName.toLowerCase().includes(q))
      );
    }

    return list;
  }

  getTotalCount(): number {
    return Array.isArray(this.capaActions) ? this.capaActions.length : 0;
  }

  getOpenCount(): number {
    return Array.isArray(this.capaActions) ? this.capaActions.filter(c => c.status && c.status.toLowerCase() === 'open').length : 0;
  }

  getInProgressCount(): number {
    return Array.isArray(this.capaActions) ? this.capaActions.filter(c => c.status && c.status.toLowerCase() === 'inprogress').length : 0;
  }

  getResolvedCount(): number {
    return Array.isArray(this.capaActions) ? this.capaActions.filter(c => c.status && c.status.toLowerCase() === 'resolved').length : 0;
  }

  getCriticalCount(): number {
    return Array.isArray(this.capaActions) ? this.capaActions.filter(c => c.severity && c.severity.toLowerCase() === 'critical').length : 0;
  }
}
