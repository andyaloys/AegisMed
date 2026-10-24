import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  username: string;
  roleName: string;
  roleDisplayName: string;
  roleScope: string;
  roleLevel: number;
  permissionsJson: string;
  hospitalSiteId: string;
  hospitalSiteName: string;
  hospitalSiteCode: string;
  hospitalUnitId?: string;
  hospitalUnitName?: string;
  hospitalUnitCode?: string;
}

export interface LoginResponse {
  token: string;
  user: UserProfile;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly TOKEN_KEY = 'aegismed_jwt_token';
  private readonly USER_KEY = 'aegismed_user_profile';

  private currentUserSubject = new BehaviorSubject<UserProfile | null>(this.getStoredUser());
  currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    // If no user stored, fetch demo users and set Admin by default so the app is always usable out of the box
    if (!this.currentUserSubject.value) {
      this.initDefaultUser();
    }
  }

  private getApiUrl(endpoint: string): string {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseUrl = isLocal ? 'http://localhost:5000/api' : '/api';
    return `${baseUrl}/${endpoint}`;
  }

  private getStoredUser(): UserProfile | null {
    try {
      const data = localStorage.getItem(this.USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  get currentUser(): UserProfile | null {
    return this.currentUserSubject.value;
  }

  get isLoggedIn(): boolean {
    return !!this.currentUserSubject.value;
  }

  get isAdmin(): boolean {
    return this.currentUser?.roleName === 'Admin';
  }

  get isCorporate(): boolean {
    return this.currentUser?.roleScope === 'Corporate' || this.isAdmin;
  }

  get isNQCorp(): boolean {
    return this.currentUser?.roleName === 'NQCorp';
  }

  get isKadeptNQ(): boolean {
    return this.currentUser?.roleName === 'KadeptNQ';
  }

  get isKanit(): boolean {
    return this.currentUser?.roleName === 'Kanit';
  }

  get isPSQO(): boolean {
    return this.currentUser?.roleName === 'PSQO';
  }

  get canApprove(): boolean {
    const r = this.currentUser?.roleName;
    return r === 'Admin' || r === 'KadeptNQ' || r === 'Kanit' || r === 'PSQO' || r === 'NQCorp';
  }

  get canInputAudit(): boolean {
    const r = this.currentUser?.roleName;
    return r === 'Admin' || r === 'PSQO' || r === 'Kanit' || r === 'KadeptNQ';
  }

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(this.getApiUrl('auth/login'), { username, password }).pipe(
      tap(res => {
        localStorage.setItem(this.TOKEN_KEY, res.token);
        localStorage.setItem(this.USER_KEY, JSON.stringify(res.user));
        this.currentUserSubject.next(res.user);
      })
    );
  }

  switchUser(user: UserProfile) {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  getDemoUsers(): Observable<UserProfile[]> {
    return this.http.get<UserProfile[]>(this.getApiUrl('auth/demo-users'));
  }

  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUserSubject.next(null);
  }

  private initDefaultUser() {
    this.getDemoUsers().subscribe({
      next: (users) => {
        if (users && users.length > 0) {
          // Default to Admin or Fitrianti (NQ Corp)
          const admin = users.find(u => u.roleName === 'Admin') || users[0];
          this.switchUser(admin);
        }
      },
      error: () => {
        // Fallback static profile if backend not reachable yet
        const fallback: UserProfile = {
          id: 'ad000001-0000-0000-0000-000000000001',
          fullName: 'System Administrator',
          email: 'admin@aegismed.id',
          username: 'admin',
          roleName: 'Admin',
          roleDisplayName: 'System Administrator',
          roleScope: 'Corporate',
          roleLevel: 99,
          permissionsJson: '{"canInputAudit":true,"canApprove":true,"canCreatePdsa":true,"canVerifyPdsa":true,"canViewDashboardUnit":true,"canViewDashboardMH":true,"canViewDashboardCorp":true,"canExport":true,"canManageUsers":true}',
          hospitalSiteId: '11111111-1111-1111-1111-111111111111',
          hospitalSiteName: 'Mayapada Hospital Jakarta Selatan',
          hospitalSiteCode: 'MHJS'
        };
        this.currentUserSubject.next(fallback);
      }
    });
  }
}
