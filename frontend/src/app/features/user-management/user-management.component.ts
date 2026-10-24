import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserManagementService, AppUserDto, AppRoleDto, HospitalSiteDto, HospitalUnitDto } from '../../core/services/user-management.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.css']
})
export class UserManagementComponent implements OnInit {
  loading = false;
  submitting = false;

  users: AppUserDto[] = [];
  roles: AppRoleDto[] = [];
  sites: HospitalSiteDto[] = [];
  units: HospitalUnitDto[] = [];

  // Filters
  filterSiteId = '';
  filterRoleId = '';
  searchQuery = '';

  // Create Modal
  createModalOpen = false;
  newUser = {
    fullName: '',
    email: '',
    username: '',
    password: '',
    roleId: '',
    hospitalSiteId: '',
    hospitalUnitId: ''
  };

  // Reset Password Modal
  resetModalOpen = false;
  selectedUserForReset: AppUserDto | null = null;
  newPasswordInput = '';

  constructor(
    private userService: UserManagementService,
    public authService: AuthService,
    private notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadMetadata();
    this.loadUsers();
  }

  loadMetadata(): void {
    this.userService.getRoles().subscribe(roles => {
      this.roles = roles;
      if (roles.length > 0 && !this.newUser.roleId) {
        this.newUser.roleId = roles[0].id;
      }
    });

    this.userService.getSites().subscribe(sites => {
      this.sites = sites;
      if (sites.length > 0 && !this.newUser.hospitalSiteId) {
        this.newUser.hospitalSiteId = sites[0].id;
        this.onSiteChange(this.newUser.hospitalSiteId);
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
      if (units.length > 0) {
        this.newUser.hospitalUnitId = units[0].id;
      } else {
        this.newUser.hospitalUnitId = '';
      }
    });
  }

  loadUsers(): void {
    this.loading = true;
    const filters: any = {};
    if (this.filterSiteId) filters.siteId = this.filterSiteId;
    if (this.filterRoleId) filters.roleId = this.filterRoleId;
    if (this.searchQuery) filters.search = this.searchQuery;

    this.userService.getUsers(filters).subscribe({
      next: (data) => {
        this.users = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  openCreateModal(): void {
    this.createModalOpen = true;
    if (this.newUser.hospitalSiteId) {
      this.onSiteChange(this.newUser.hospitalSiteId);
    }
  }

  closeCreateModal(): void {
    this.createModalOpen = false;
  }

  async createUser(): Promise<void> {
    if (!this.newUser.fullName.trim() || !this.newUser.username.trim() || !this.newUser.password.trim() || !this.newUser.roleId || !this.newUser.hospitalSiteId) {
      await this.notify.alert('Form Belum Lengkap', 'Nama, Username, Password, Role, dan Rumah Sakit wajib diisi.', 'warning');
      return;
    }

    this.submitting = true;
    this.userService.createUser({
      fullName: this.newUser.fullName.trim(),
      email: this.newUser.email.trim(),
      username: this.newUser.username.trim(),
      password: this.newUser.password.trim(),
      roleId: this.newUser.roleId,
      hospitalSiteId: this.newUser.hospitalSiteId,
      hospitalUnitId: this.newUser.hospitalUnitId || undefined
    }).subscribe({
      next: () => {
        this.submitting = false;
        this.closeCreateModal();
        this.notify.success('Pengguna baru berhasil ditambahkan.');
        this.loadUsers();
        // Reset form
        this.newUser.fullName = '';
        this.newUser.email = '';
        this.newUser.username = '';
        this.newUser.password = '';
      },
      error: (err) => {
        this.submitting = false;
        this.notify.error('Gagal membuat user: ' + (err.error?.message || err.message));
      }
    });
  }

  toggleActive(user: AppUserDto): void {
    this.userService.toggleActive(user.id).subscribe({
      next: (res) => {
        user.isActive = res.isActive;
        this.notify.info(`Status akun ${user.fullName} diubah ke ${user.isActive ? 'Aktif' : 'Non-aktif'}.`);
      },
      error: (err) => {
        this.notify.error('Gagal mengubah status: ' + (err.error?.message || err.message));
      }
    });
  }

  openResetModal(user: AppUserDto): void {
    this.selectedUserForReset = user;
    this.newPasswordInput = '';
    this.resetModalOpen = true;
  }

  closeResetModal(): void {
    this.resetModalOpen = false;
    this.selectedUserForReset = null;
  }

  async resetPassword(): Promise<void> {
    if (!this.selectedUserForReset || !this.newPasswordInput || this.newPasswordInput.length < 6) {
      await this.notify.alert('Password Terlalu Pendek', 'Password baru minimal 6 karakter.', 'warning');
      return;
    }

    this.submitting = true;
    this.userService.resetPassword(this.selectedUserForReset.id, this.newPasswordInput).subscribe({
      next: () => {
        this.submitting = false;
        this.notify.success('Password pengguna berhasil direset.');
        this.closeResetModal();
      },
      error: (err) => {
        this.submitting = false;
        this.notify.error('Gagal reset password: ' + (err.error?.message || err.message));
      }
    });
  }

  switchToUser(user: AppUserDto): void {
    this.authService.switchUser({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      username: user.username,
      roleName: user.roleName,
      roleDisplayName: user.roleDisplayName,
      roleScope: user.roleScope,
      roleLevel: user.roleLevel,
      permissionsJson: '',
      hospitalSiteId: user.hospitalSiteId,
      hospitalSiteName: user.hospitalSiteName,
      hospitalSiteCode: user.hospitalSiteCode,
      hospitalUnitId: user.hospitalUnitId,
      hospitalUnitName: user.hospitalUnitName,
      hospitalUnitCode: user.hospitalUnitCode
    });
    this.notify.success(`Simulasi peran aktif: ${user.fullName} (${user.roleDisplayName})`, 'Peran Diperbarui');
  }

  getRoleBadgeClass(scope: string): string {
    switch (scope.toLowerCase()) {
      case 'corporate': return 'badge-corp';
      case 'hospital': return 'badge-hosp';
      case 'unit': return 'badge-unit';
      default: return 'badge-default';
    }
  }
}
