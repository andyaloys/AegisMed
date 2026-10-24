export interface EdDashboardDto {
  totalCases: number;
  compliantCases: number;
  overdueCases: number;
  complianceRate: number;
  averageMinutes: number;
  fastestMinutes: number;
  slowestMinutes: number;
  approvalBreakdown: {
    submitted: number;
    approvedL1: number;
    approvedL2: number;
    verified: number;
    rejected: number;
  };
  indicators: {
    indicatorId: string;
    indicatorName: string;
    targetMinutes: number;
    targetDescription: string;
    totalCases: number;
    compliantCases: number;
    overdueCases: number;
    complianceRate: number;
    averageMinutes: number;
    fastestMinutes: number;
    slowestMinutes: number;
    isTargetMet: boolean;
  }[];
  siteRankings: {
    siteId: string;
    siteName: string;
    siteCode: string;
    totalCases: number;
    compliantCases: number;
    complianceRate: number;
    averageMinutes: number;
    isTargetMet: boolean;
  }[];
  monthlyTrends: {
    month: string;
    totalCases: number;
    compliantCases: number;
    complianceRate: number;
    averageMinutes: number;
  }[];
}

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SummaryMetrics {
  totalAudits: number;
  averageAuditScore: number;
  totalCapa: number;
  openCapa: number;
  overdueCapa: number;
  inProgressCapa: number;
  resolvedCapa: number;
  criticalIssues: number;
}

export interface SiteComplianceDto {
  siteId: string;
  siteName: string;
  siteCode: string;
  averageScore: number;
  auditsCount: number;
  openCapaCount: number;
  complianceRate: number;
}

export interface CapaStatusBreakdown {
  status: string;
  count: number;
  severity: string;
}

export interface RecentAuditDto {
  id: string;
  title: string;
  siteName: string;
  auditDate: string;
  score: number;
  status: string;
}

export interface RecentCapaDto {
  id: string;
  title: string;
  siteName: string;
  dueDate: string;
  severity: string;
  status: string;
}

export interface IndicatorSummaryDto {
  name: string;
  category: string;
  currentValue: number;
  target: number;
  unit: string;
  performanceStatus: string;
}

export interface EdIndicatorComplianceDto {
  indicatorName: string;
  category: string;
  totalCases: number;
  compliantCases: number;
  complianceRate: number;
  targetDescription: string;
}

export interface EdIndicatorDto {
  id: string;
  name: string;
  targetDescription: string;
  targetMinutes: number;
}

export interface DashboardData {
  summary: SummaryMetrics;
  siteCompliance: SiteComplianceDto[];
  capaBreakdown: CapaStatusBreakdown[];
  recentAudits: RecentAuditDto[];
  recentCapas: RecentCapaDto[];
  keyIndicators: IndicatorSummaryDto[];
  edCompliance: EdIndicatorComplianceDto[];
  edIndicators: EdIndicatorDto[];
}

import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private selectedSiteIdSource = new BehaviorSubject<string | undefined>(undefined);
  selectedSiteId$ = this.selectedSiteIdSource.asObservable();

  private dateFilterSource = new BehaviorSubject<{start: string, end: string}>({start: '2026-01', end: '2026-12'});
  dateFilter$ = this.dateFilterSource.asObservable();

  private themeSource = new BehaviorSubject<'light' | 'dark'>('light');
  theme$ = this.themeSource.asObservable();

  setSelectedSiteId(siteId: string | undefined) {
    const clean = (!siteId || siteId === 'undefined' || siteId === 'null' || siteId.trim() === '') ? undefined : siteId;
    this.selectedSiteIdSource.next(clean);
  }
  getSelectedSiteId(): string | undefined {
    const val = this.selectedSiteIdSource.value;
    return (!val || val === 'undefined' || val === 'null' || val.trim() === '') ? undefined : val;
  }

  private isValidGuid(val?: string): boolean {
    if (!val || val === 'undefined' || val === 'null' || val.trim() === '') return false;
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val);
  }

  setDateFilters(start: string, end: string) {
    this.dateFilterSource.next({ start, end });
  }
  getFilterStartMonth(): string {
    return this.dateFilterSource.value.start;
  }

  getFilterEndMonth(): string {
    return this.dateFilterSource.value.end;
  }

  setTheme(theme: 'light' | 'dark') {
    this.themeSource.next(theme);
    if (theme === 'dark') {
      document.body.setAttribute('data-theme', 'dark');
    } else {
      document.body.removeAttribute('data-theme');
    }
  }
  getTheme(): 'light' | 'dark' {
    return this.themeSource.value;
  }

  private getApiUrl(endpoint: string): string {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseUrl = isLocal ? 'http://localhost:5000/api' : '/api';
    return `${baseUrl}/${endpoint}`;
  }

  constructor(private http: HttpClient) {
    // Initialize theme based on body attribute if already set, otherwise default light
    const currentTheme = document.body.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    this.setTheme(currentTheme);
  }

  getDashboardData(siteId?: string, startDate?: string, endDate?: string): Observable<DashboardData> {
    let url = this.getApiUrl('dashboard');
    const params: string[] = [];
    if (this.isValidGuid(siteId)) params.push(`siteId=${siteId}`);
    if (startDate) params.push(`startDate=${startDate}`);
    if (endDate) params.push(`endDate=${endDate}`);
    
    if (params.length > 0) {
      url += '?' + params.join('&');
    }
    return this.http.get<DashboardData>(url);
  }

  getEdSubmissions(siteId?: string, month?: string, indicatorId?: string, startDate?: string, endDate?: string): Observable<any[]> {
    let url = this.getApiUrl('edsubmissions');
    const params: string[] = [];
    if (this.isValidGuid(siteId)) params.push(`siteId=${siteId}`);
    if (month) params.push(`month=${month}`);
    if (indicatorId) params.push(`indicatorId=${indicatorId}`);
    if (startDate) params.push(`startDate=${startDate}`);
    if (endDate) params.push(`endDate=${endDate}`);
    
    if (params.length > 0) {
      url += '?' + params.join('&');
    }
    return this.http.get<any[]>(url);
  }

  submitEdCase(caseData: any): Observable<any> {
    return this.http.post<any>(this.getApiUrl('edsubmissions'), caseData);
  }

  getEdSubmissionById(id: string): Observable<any> {
    return this.http.get<any>(this.getApiUrl(`edsubmissions/${id}`));
  }

  updateEdCase(id: string, caseData: any): Observable<any> {
    return this.http.put<any>(this.getApiUrl(`edsubmissions/${id}`), caseData);
  }

  deleteEdCase(id: string, actionById?: string): Observable<any> {
    let url = this.getApiUrl(`edsubmissions/${id}`);
    if (actionById) {
      url += `?actionById=${actionById}`;
    }
    return this.http.delete<any>(url);
  }

  executeEdWorkflow(id: string, action: string, actionById: string, notes?: string): Observable<any> {
    return this.http.post<any>(this.getApiUrl(`edsubmissions/${id}/workflow`), {
      action,
      actionById,
      notes
    });
  }

  // ── CAPA ACTIONS CRUD ───────────────────────────────────────────
  getCapaActions(siteId?: string): Observable<any[]> {
    let url = this.getApiUrl('capaactions');
    if (this.isValidGuid(siteId)) {
      url += `?siteId=${siteId}`;
    }
    return this.http.get<any[]>(url);
  }

  createCapaAction(capaData: any): Observable<any> {
    return this.http.post<any>(this.getApiUrl('capaactions'), capaData);
  }

  updateCapaAction(id: string, capaData: any): Observable<any> {
    return this.http.put<any>(this.getApiUrl(`capaactions/${id}`), capaData);
  }

  deleteCapaAction(id: string): Observable<any> {
    return this.http.delete<any>(this.getApiUrl(`capaactions/${id}`));
  }

  generateCapas(siteId: string, month: string): Observable<any> {
    return this.http.post<any>(this.getApiUrl('capaactions/generate'), { hospitalSiteId: siteId, month });
  }
  getEdDashboard(siteId?: string, startDate?: string, endDate?: string): Observable<EdDashboardDto> {
    let url = this.getApiUrl('edsubmissions/dashboard');
    const params: string[] = [];
    if (this.isValidGuid(siteId)) params.push(`siteId=${siteId}`);
    if (startDate) params.push(`startDate=${startDate}`);
    if (endDate) params.push(`endDate=${endDate}`);
    if (params.length > 0) {
      url += '?' + params.join('&');
    }
    return this.http.get<EdDashboardDto>(url);
  }
}
