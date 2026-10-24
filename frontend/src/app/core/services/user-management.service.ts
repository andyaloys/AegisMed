import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AppRoleDto {
  id: string;
  name: string;
  displayName: string;
  scope: string;
  level: number;
  permissionsJson: string;
}

export interface HospitalSiteDto {
  id: string;
  name: string;
  code: string;
  region: string;
}

export interface HospitalUnitDto {
  id: string;
  name: string;
  code: string;
  hospitalSiteId: string;
}

export interface AppUserDto {
  id: string;
  fullName: string;
  email: string;
  username: string;
  roleId: string;
  roleName: string;
  roleDisplayName: string;
  roleScope: string;
  roleLevel: number;
  hospitalSiteId: string;
  hospitalSiteName: string;
  hospitalSiteCode: string;
  hospitalUnitId?: string;
  hospitalUnitName?: string;
  hospitalUnitCode?: string;
  isActive: boolean;
  createdDate: string;
  lastLoginDate?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserManagementService {
  constructor(private http: HttpClient) {}

  private getApiUrl(endpoint: string): string {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseUrl = isLocal ? 'http://localhost:5000/api' : '/api';
    return `${baseUrl}/${endpoint}`;
  }

  getUsers(filters?: { siteId?: string; roleId?: string; search?: string }): Observable<AppUserDto[]> {
    let params = new HttpParams();
    if (filters?.siteId) params = params.set('siteId', filters.siteId);
    if (filters?.roleId) params = params.set('roleId', filters.roleId);
    if (filters?.search) params = params.set('search', filters.search);

    return this.http.get<AppUserDto[]>(this.getApiUrl('users'), { params });
  }

  getUserById(id: string): Observable<AppUserDto> {
    return this.http.get<AppUserDto>(this.getApiUrl(`users/${id}`));
  }

  createUser(payload: {
    fullName: string;
    email: string;
    username: string;
    password: string;
    roleId: string;
    hospitalSiteId: string;
    hospitalUnitId?: string;
  }): Observable<any> {
    return this.http.post(this.getApiUrl('users'), payload);
  }

  updateUser(id: string, payload: {
    fullName: string;
    email: string;
    roleId: string;
    hospitalSiteId: string;
    hospitalUnitId?: string;
    isActive: boolean;
  }): Observable<any> {
    return this.http.put(this.getApiUrl(`users/${id}`), payload);
  }

  toggleActive(id: string): Observable<any> {
    return this.http.put(this.getApiUrl(`users/${id}/toggle-active`), {});
  }

  resetPassword(id: string, newPassword: string): Observable<any> {
    return this.http.post(this.getApiUrl(`users/${id}/reset-password`), { newPassword });
  }

  getRoles(): Observable<AppRoleDto[]> {
    return this.http.get<AppRoleDto[]>(this.getApiUrl('users/roles'));
  }

  getSites(): Observable<HospitalSiteDto[]> {
    return this.http.get<HospitalSiteDto[]>(this.getApiUrl('users/sites'));
  }

  getUnits(siteId?: string): Observable<HospitalUnitDto[]> {
    let params = new HttpParams();
    if (siteId) params = params.set('siteId', siteId);
    return this.http.get<HospitalUnitDto[]>(this.getApiUrl('users/units'), { params });
  }
}
