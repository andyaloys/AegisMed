import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DashboardService, DashboardData } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './main-layout.component.html',
  styleUrls: []
})
export class MainLayoutComponent implements OnInit {
  data: DashboardData | null = null;
  loading = true;
  error = false;
  errorMessage = '';

  // Theme & Sidebar States
  theme: 'light' | 'dark' = 'light';
  sidebarCollapsed = false;
  mobileMenuOpen = false;
  activeCategoryExpanded: { [key: string]: boolean } = {
    goldenHour: true,
    qualityAssurance: true
  };

  // Shared Filters
  selectedSiteId: string | undefined = undefined;

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    // Sync with global state
    this.selectedSiteId = this.dashboardService.getSelectedSiteId();
    this.theme = this.dashboardService.getTheme();

    // Subscribe to theme updates
    this.dashboardService.theme$.subscribe(t => {
      this.theme = t;
    });

    this.loadLayoutData();
  }

  loadLayoutData(): void {
    this.loading = true;
    this.dashboardService.getDashboardData(
      this.selectedSiteId,
      this.dashboardService.getFilterStartMonth(),
      this.dashboardService.getFilterEndMonth()
    ).subscribe({
      next: (res) => {
        this.data = res;
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.error = true;
        this.errorMessage = 'Gagal memuat konfigurasi layout.';
        this.loading = false;
      }
    });
  }

  onSiteFilterChange(): void {
    this.dashboardService.setSelectedSiteId(this.selectedSiteId);
    // Reload layout data to update the sidebar metrics or indicators list if needed
    this.loadLayoutData();
  }

  toggleTheme(): void {
    const nextTheme = this.theme === 'light' ? 'dark' : 'light';
    this.dashboardService.setTheme(nextTheme);
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  toggleCategory(cat: string): void {
    this.activeCategoryExpanded[cat] = !this.activeCategoryExpanded[cat];
  }

  getSelectedSiteName(): string {
    if (!this.selectedSiteId || !this.data || !this.data.siteCompliance) {
      return 'Semua Rumah Sakit';
    }
    const site = this.data.siteCompliance.find(s => s.siteId === this.selectedSiteId);
    return site ? site.siteName : 'Semua Rumah Sakit';
  }
}
