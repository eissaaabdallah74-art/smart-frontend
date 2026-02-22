import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AttendanceRequest, CreateRequestDto, HrListFilter } from '../../models/attendance-request.model';

@Injectable({ providedIn: 'root' })
export class AttendanceRequestsService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/attendance/requests`;

  // ===== Employee =====
  createMine(dto: CreateRequestDto): Observable<AttendanceRequest> {
    return this.http.post<AttendanceRequest>(`${this.base}/mine`, dto);
  }

  listMine(month?: string): Observable<AttendanceRequest[]> {
    let params = new HttpParams();
    if (month) params = params.set('month', month);
    return this.http.get<AttendanceRequest[]>(`${this.base}/mine`, { params });
  }

  cancelMine(id: number): Observable<any> {
    return this.http.delete(`${this.base}/${id}`);
  }

  // ===== HR/Admin =====
  listAll(filter: HrListFilter): Observable<AttendanceRequest[]> {
    let params = new HttpParams();
    if (filter.month) params = params.set('month', filter.month);
    if (filter.status) params = params.set('status', filter.status);
    if (filter.employeeId) params = params.set('employeeId', String(filter.employeeId));
    return this.http.get<AttendanceRequest[]>(`${this.base}`, { params });
  }

approve(id: number, decisionNote?: string) {
  return this.http.patch(`${this.base}/${id}/decision`, {
    status: 'approved',
    decisionNote: decisionNote?.trim() ? decisionNote.trim() : null,
  });
}

reject(id: number, decisionNote?: string) {
  return this.http.patch(`${this.base}/${id}/decision`, {
    status: 'rejected',
    decisionNote: decisionNote?.trim() ? decisionNote.trim() : null,
  });
}
}
