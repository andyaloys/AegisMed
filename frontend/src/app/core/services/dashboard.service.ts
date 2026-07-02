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

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private getApiUrl(endpoint: string): string {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseUrl = isLocal ? 'http://localhost:5000/api' : '/api';
    return `${baseUrl}/${endpoint}`;
  }

  constructor(private http: HttpClient) { }

  getDashboardData(siteId?: string): Observable<DashboardData> {
    let url = this.getApiUrl('dashboard');
    if (siteId) {
      url += `?siteId=${siteId}`;
    }
    return this.http.get<DashboardData>(url);
  }

  getEdSubmissions(siteId?: string, month?: string, indicatorId?: string): Observable<any[]> {
    let url = this.getApiUrl('edsubmissions');
    const params: string[] = [];
    if (siteId) params.push(`siteId=${siteId}`);
    if (month) params.push(`month=${month}`);
    if (indicatorId) params.push(`indicatorId=${indicatorId}`);
    
    if (params.length > 0) {
      url += '?' + params.join('&');
    }
    return this.http.get<any[]>(url);
  }

  submitEdCase(caseData: any): Observable<any> {
    return this.http.post<any>(this.getApiUrl('edsubmissions'), caseData);
  }
}
