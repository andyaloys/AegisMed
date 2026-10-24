import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface NsiIndicatorDto {
  id: string;
  name: string;
  code: string;
  categoryId?: string;
  categoryName?: string;
  categoryCode?: string;
  auditType: string;
  measurementType: string;
  targetMinutes?: number;
  targetPercentage: number;
  sortOrder: number;
}

export interface NsiCategoryDto {
  id: string;
  name: string;
  code: string;
  sortOrder: number;
  indicators: NsiIndicatorDto[];
}

export interface NsiAuditItemDto {
  id?: string;
  itemNumber?: number;
  patientIdentifier: string;
  isCompliant: boolean;
  notes?: string;
  doorTime?: string;
  eventTime?: string;
  minutesElapsed?: number;
  customFieldsJson?: string;
}

export interface ApprovalHistoryDto {
  id: string;
  fromStatus: string;
  toStatus: string;
  actionById: string;
  actionByName: string;
  actionDate: string;
  notes?: string;
}

export interface NsiAuditSubmissionDto {
  id: string;
  hospitalUnitId: string;
  hospitalUnitName: string;
  hospitalUnitCode: string;
  hospitalSiteId: string;
  hospitalSiteName: string;
  hospitalSiteCode: string;
  nsiIndicatorId: string;
  indicatorName: string;
  indicatorCode: string;
  auditType: string;
  measurementType?: string;
  targetPercentage?: number;
  submissionMonth: string;
  auditDate: string;
  status: number;
  statusText: string;
  submittedById?: string;
  submittedByName?: string;
  submittedDate?: string;
  approvedById?: string;
  approvedByName?: string;
  approvedDate?: string;
  rejectionNotes?: string;
  denominator: number;
  numerator: number;
  achievementRate: number;
  isTargetMet: boolean;
  totalItems: number;
  items?: NsiAuditItemDto[];
  history?: ApprovalHistoryDto[];
}

export interface NsiSummaryItemDto {
  indicatorId: string;
  indicatorName: string;
  indicatorCode: string;
  categoryId: string;
  categoryName: string;
  auditType: string;
  measurementType: string;
  targetPercentage: number;
  numerator: number;
  denominator: number;
  achievementPercentage: number;
  isTargetMet: boolean;
  needsPdsa: boolean;
  submissionsCount: number;
}

export interface NsiDashboardDto {
  periodMonth: string;
  totalAudits: number;
  totalPatients: number;
  compliantPatients: number;
  overallComplianceRate: number;
  targetMetCount: number;
  needPdsaCount: number;
  indicators: {
    indicatorId: string;
    indicatorName: string;
    indicatorCode: string;
    categoryId: string;
    categoryName: string;
    categoryCode: string;
    auditType: string;
    targetPercentage: number;
    numerator: number;
    denominator: number;
    achievementRate: number;
    isTargetMet: boolean;
    needsPdsa: boolean;
    submissionsCount: number;
  }[];
  categoryBreakdown: {
    categoryId: string;
    categoryName: string;
    categoryCode: string;
    numerator: number;
    denominator: number;
    achievementRate: number;
    indicatorCount: number;
  }[];
  approvalBreakdown: {
    submitted: number;
    approvedL1: number;
    approvedL2: number;
    verified: number;
    rejected: number;
  };
  monthlyTrends: {
    month: string;
    monthLabel: string;
    totalAudits: number;
    totalPatients: number;
    complianceRate: number;
  }[];
  unitRankings: {
    unitId: string;
    unitName: string;
    siteCode: string;
    totalAudits: number;
    totalPatients: number;
    complianceRate: number;
    isTargetMet: boolean;
  }[];
  availableMonths?: string[];
  auditAnalytics?: {
    patientType: {
      title: string;
      inPatientCount: number;
      inPatientPct: number;
      outPatientCount: number;
      outPatientPct: number;
      total: number;
    };
    riskScreening: {
      title: string;
      yesCount: number;
      yesPct: number;
      noCount: number;
      noPct: number;
      total: number;
    };
    initialAssessment: {
      title: string;
      yesCount: number;
      yesPct: number;
      noCount: number;
      noPct: number;
      total: number;
    };
    reAssessment: {
      title: string;
      yesCount: number;
      yesPct: number;
      noCount: number;
      noPct: number;
      total: number;
    };
  };
}

export interface NsiSummaryDto {
  periodMonth: string;
  totalSubmissions: number;
  indicators: NsiSummaryItemDto[];
}

export interface CreateAuditSubmissionPayload {
  hospitalUnitId: string;
  nsiIndicatorId: string;
  submissionMonth: string;
  auditDate: string;
  submittedById: string;
  notes?: string;
  items: {
    patientIdentifier: string;
    isCompliant: boolean;
    notes?: string;
    doorTime?: string;
    eventTime?: string;
    minutesElapsed?: number;
    customFieldsJson?: string;
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class NsiAuditService {
  constructor(private http: HttpClient) {}

  private getApiUrl(endpoint: string): string {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseUrl = isLocal ? 'http://localhost:5000/api' : '/api';
    return `${baseUrl}/${endpoint}`;
  }

  getCategories(): Observable<NsiCategoryDto[]> {
    return this.http.get<NsiCategoryDto[]>(this.getApiUrl('nsiaudit/categories'));
  }

  getIndicators(auditType?: string): Observable<NsiIndicatorDto[]> {
    let params = new HttpParams();
    if (auditType) params = params.set('auditType', auditType);
    return this.http.get<NsiIndicatorDto[]>(this.getApiUrl('nsiaudit/indicators'), { params });
  }

  getSubmissions(filters?: { siteId?: string; unitId?: string; indicatorId?: string; month?: string; status?: number }): Observable<NsiAuditSubmissionDto[]> {
    let params = new HttpParams();
    if (filters?.siteId) params = params.set('siteId', filters.siteId);
    if (filters?.unitId) params = params.set('unitId', filters.unitId);
    if (filters?.indicatorId) params = params.set('indicatorId', filters.indicatorId);
    if (filters?.month) params = params.set('month', filters.month);
    if (filters?.status !== undefined) params = params.set('status', filters.status.toString());

    return this.http.get<NsiAuditSubmissionDto[]>(this.getApiUrl('nsiaudit/submissions'), { params });
  }

  getSubmissionById(id: string): Observable<NsiAuditSubmissionDto> {
    return this.http.get<NsiAuditSubmissionDto>(this.getApiUrl(`nsiaudit/submissions/${id}`));
  }

  getIndicatorById(id: string): Observable<NsiIndicatorDto> {
    return this.http.get<NsiIndicatorDto>(this.getApiUrl(`nsiaudit/indicators/${id}`));
  }

  createSubmission(payload: CreateAuditSubmissionPayload): Observable<any> {
    return this.http.post(this.getApiUrl('nsiaudit/submissions'), payload);
  }

  updateSubmission(id: string, payload: CreateAuditSubmissionPayload): Observable<any> {
    return this.http.put(this.getApiUrl(`nsiaudit/submissions/${id}`), payload);
  }

  executeWorkflow(id: string, action: string, actionById: string, notes?: string): Observable<any> {
    return this.http.post(this.getApiUrl(`nsiaudit/submissions/${id}/workflow`), {
      action,
      actionById,
      notes
    });
  }

  deleteSubmission(id: string, actionById?: string): Observable<any> {
    let params = new HttpParams();
    if (actionById) params = params.set('actionById', actionById);
    return this.http.delete(this.getApiUrl(`nsiaudit/submissions/${id}`), { params });
  }

  getSummary(month?: string, siteId?: string, unitId?: string): Observable<NsiSummaryDto> {
    let params = new HttpParams();
    if (month) params = params.set('month', month);
    if (siteId) params = params.set('siteId', siteId);
    if (unitId) params = params.set('unitId', unitId);

    return this.http.get<NsiSummaryDto>(this.getApiUrl('nsiaudit/summary'), { params });
  }
  getNsiDashboard(month?: string, siteId?: string, unitId?: string): Observable<NsiDashboardDto> {
    let params = new HttpParams();
    if (month) params = params.set('month', month);
    if (siteId) params = params.set('siteId', siteId);
    if (unitId) params = params.set('unitId', unitId);

    return this.http.get<NsiDashboardDto>(this.getApiUrl('nsiaudit/dashboard'), { params });
  }
}
