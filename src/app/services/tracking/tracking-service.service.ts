import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiDriver } from '../drivers/drivers-service.service';

export interface TrackingRow {
  id: number;
  driverId: number;
  dspShortcode: string | null;
  dasFirstName: string | null;
  dasLastName: string | null;
  dasUsername: string | null;
  visaSponsorshipOnDsp: 'yes' | 'no' | null;
  birthDate: string | null;
  vehiclePlateNumber: string | null;
  criminalRecordIssueDate: string | null;
  idExpiryDate: string | null;
  dLicenseExpiryDate: string | null;
  vLicenseExpiryDate: string | null;
  notes: string | null;
  driver?: ApiDriver;
}

export type CreateTrackingDto = Omit<TrackingRow, 'id' | 'driver'>;
export type UpdateTrackingDto = Partial<CreateTrackingDto>;

@Injectable({
  providedIn: 'root',
})
export class TrackingServiceService {
  private readonly baseUrl = `${environment.apiUrl}/tracking`;

  constructor(private http: HttpClient) {}

  getRows(params?: { q?: string; driverId?: number }): Observable<TrackingRow[]> {
    return this.http.get<TrackingRow[]>(this.baseUrl, {
      params: params as any,
    });
  }

  getRow(id: number): Observable<TrackingRow> {
    return this.http.get<TrackingRow>(`${this.baseUrl}/${id}`);
  }

  createRow(body: Partial<CreateTrackingDto>): Observable<TrackingRow> {
    return this.http.post<TrackingRow>(this.baseUrl, body);
  }

  updateRow(id: number, body: UpdateTrackingDto): Observable<TrackingRow> {
    return this.http.put<TrackingRow>(`${this.baseUrl}/${id}`, body);
  }

  deleteRow(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  bulkUpsertRows(rows: Partial<CreateTrackingDto>[]): Observable<TrackingRow[]> {
    return this.http.post<TrackingRow[]>(`${this.baseUrl}/bulk`, rows);
  }
}
