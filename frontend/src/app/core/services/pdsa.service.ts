import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PdsaActionDto {
  id: string;
  hospitalUnitId: string;
  hospitalUnitName: string;
  hospitalUnitCode: string;
  hospitalSiteId: string;
  hospitalSiteName: string;
  nsiIndicatorId: string;
  indicatorName: string;
  indicatorCode: string;
  month: string;
  achievementRate: number;
  numerator: number;
  denominator: number;
  rootCauseAnalysis: string;
  improvementPlan: string;
  pic: string;
  targetDate?: string;
  status: number;
  statusText: string;
  createdById?: string;
  createdByName?: string;
  createdDate: string;
  verifiedById?: string;
  verifiedByName?: string;
  verifiedDate?: string;
  revisionNotes?: string;
  history?: any[];
}

@Injectable({
  providedIn: 'root'
})
export class PdsaService {
  constructor(private http: HttpClient) {}

  private getApiUrl(endpoint: string): string {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseUrl = isLocal ? 'http://localhost:5000/api' : '/api';
    return `${baseUrl}/${endpoint}`;
  }

  getPdsaActions(filters?: { siteId?: string; unitId?: string; month?: string; status?: number }): Observable<PdsaActionDto[]> {
    let params = new HttpParams();
    if (filters?.siteId) params = params.set('siteId', filters.siteId);
    if (filters?.unitId) params = params.set('unitId', filters.unitId);
    if (filters?.month) params = params.set('month', filters.month);
    if (filters?.status !== undefined) params = params.set('status', filters.status.toString());

    return this.http.get<PdsaActionDto[]>(this.getApiUrl('pdsa'), { params });
  }

  getPdsaById(id: string): Observable<PdsaActionDto> {
    return this.http.get<PdsaActionDto>(this.getApiUrl(`pdsa/${id}`));
  }

  createPdsa(payload: {
    hospitalUnitId: string;
    nsiIndicatorId: string;
    month: string;
    achievementRate: number;
    numerator: number;
    denominator: number;
    rootCauseAnalysis: string;
    improvementPlan: string;
    pic: string;
    targetDate?: string;
    createdById: string;
  }): Observable<any> {
    return this.http.post(this.getApiUrl('pdsa'), payload);
  }

  executeWorkflow(id: string, action: string, actionById: string, notes?: string): Observable<any> {
    return this.http.post(this.getApiUrl(`pdsa/${id}/workflow`), {
      action,
      actionById,
      notes
    });
  }
}
