import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DashboardService, DashboardData } from '../../../core/services/dashboard.service';
import { AuthService, UserProfile } from '../../../core/services/auth.service';
import { NsiAuditService, NsiCategoryDto } from '../../../core/services/nsi-audit.service';
import { FeedbackModalComponent } from '../../components/feedback-modal/feedback-modal.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, FormsModule, FeedbackModalComponent],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.css']
})
export class MainLayoutComponent implements OnInit {
  data: DashboardData | null = null;
  loading = true;
  error = false;
  errorMessage = '';

  // NSI Categories for Option A sidebar menu
  nsiCategories: NsiCategoryDto[] = [];
  activeNsiCategoryExpanded: { [key: string]: boolean } = {};

  // Current User & RBAC
  currentUser: UserProfile | null = null;
  demoUsers: UserProfile[] = [];

  // Theme & Sidebar States
  theme: 'light' | 'dark' = 'light';
  sidebarCollapsed = false;
  mobileMenuOpen = false;
  activeCategoryExpanded: { [key: string]: boolean } = {
    goldenHour: true,
    qualityAssurance: true,
    nsiAudit: true,
    nsiMaster: true
  };

  // Shared Filters
  selectedSiteId: string | undefined = undefined;

  // Profile Drawer & Preferences
  profileDrawerOpen = false;
  profileTheme: 'navy' | 'light' | 'dark' = 'navy';
  profileStyle: 'classic' | 'flat' = 'classic';
  profileLanguage: 'ID' | 'EN' = 'ID';

  constructor(
    private dashboardService: DashboardService,
    public authService: AuthService,
    private nsiService: NsiAuditService
  ) {}

  ngOnInit(): void {
    this.selectedSiteId = this.dashboardService.getSelectedSiteId();
    this.theme = this.dashboardService.getTheme();

    this.dashboardService.theme$.subscribe(t => {
      this.theme = t;
    });

    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });

    this.authService.getDemoUsers().subscribe(users => {
      this.demoUsers = users;
    });

    this.loadNsiCategories();
    this.loadLayoutData();
  }

  loadNsiCategories(): void {
    this.nsiService.getCategories().subscribe({
      next: (cats) => {
        // Filter the 4 standard checklist categories (sortOrder 1 to 4)
        this.nsiCategories = cats.filter(c => c.sortOrder <= 4);
        // By default expand category 1
        if (this.nsiCategories.length > 0) {
          this.activeNsiCategoryExpanded[this.nsiCategories[0].id] = true;
        }
      },
      error: (err) => console.error('Error loading NSI categories:', err)
    });
  }

  toggleNsiCategory(catId: string): void {
    this.activeNsiCategoryExpanded[catId] = !this.activeNsiCategoryExpanded[catId];
  }

  loadLayoutData(): void {
    this.loading = true;
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
        this.loading = false;
        this.error = false;
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
    const cleanSiteId = (!this.selectedSiteId || this.selectedSiteId === 'undefined' || this.selectedSiteId === 'null') 
      ? undefined 
      : this.selectedSiteId;
    this.selectedSiteId = cleanSiteId;
    this.dashboardService.setSelectedSiteId(cleanSiteId);
    this.loadLayoutData();
  }

  switchRole(userId: string): void {
    const target = this.demoUsers.find(u => u.id === userId);
    if (target) {
      this.authService.switchUser(target);
      // Auto-set site filter if user is site-bound
      if (target.roleScope !== 'Corporate' && target.hospitalSiteId) {
        this.selectedSiteId = target.hospitalSiteId;
        this.onSiteFilterChange();
      }
    }
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

  toggleProfileDrawer(): void {
    this.profileDrawerOpen = !this.profileDrawerOpen;
  }

  closeProfileDrawer(): void {
    this.profileDrawerOpen = false;
  }

  setSidebarMode(collapsed: boolean): void {
    this.sidebarCollapsed = collapsed;
  }

  setThemeOption(theme: 'navy' | 'light' | 'dark'): void {
    this.profileTheme = theme;
    if (theme === 'light') {
      this.dashboardService.setTheme('light');
    } else {
      this.dashboardService.setTheme('dark');
    }
  }

  setLanguage(lang: 'ID' | 'EN'): void {
    this.profileLanguage = lang;
  }
}
