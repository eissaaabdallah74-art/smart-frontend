import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

import type {
  DriverContractStatus,
  SignedWithHrStatus,
} from '../../shared/enums/driver-enums';

export interface ApiDriver {
  id: number;
  name: string;
  fullNameArabic: string | null;
  email: string | null;
  courierPhone: string | null;
  courierId: string | null;
  residence: string | null;
  courierCode: string | null;
  clientName: string | null;
  hub: string | null;
  area: string | null;
  module: string | null;
  vehicleType: string | null;
  contractor: string | null;
  pointOfContact: string | null;
  accountManager: string | null;
  interviewer: string | null;
  hrRepresentative: string | null;
  hiringDate: string | null;
  day1Date: string | null;
  vLicenseExpiryDate: string | null;
  dLicenseExpiryDate: string | null;
  idExpiryDate: string | null;
  liabilityAmount: number | null;

  signed: boolean;

  // ✅ NEW
  signedWithHr: SignedWithHrStatus | null;

  // ✅ enum
  contractStatus: DriverContractStatus | null;

  hiringStatus: string | null;
  securityQueryStatus: string | null;
  securityQueryComment: string | null;
  exceptionBy: string | null;
  notes: string | null;
}

export type CreateDriverDto = Omit<ApiDriver, 'id'>;
export type UpdateDriverDto = Partial<CreateDriverDto>;

@Injectable({ providedIn: 'root' })
export class DriversServiceService {
  private readonly baseUrl = `${environment.apiUrl}/drivers`;

  constructor(private http: HttpClient) {}

  getDrivers(): Observable<ApiDriver[]> {
    return this.http.get<ApiDriver[]>(this.baseUrl);
  }

  getDriver(id: number): Observable<ApiDriver> {
    return this.http.get<ApiDriver>(`${this.baseUrl}/${id}`);
  }

  createDriver(body: CreateDriverDto): Observable<ApiDriver> {
    return this.http.post<ApiDriver>(this.baseUrl, body);
  }

  updateDriver(id: number, body: UpdateDriverDto): Observable<ApiDriver> {
    return this.http.put<ApiDriver>(`${this.baseUrl}/${id}`, body);
  }

  deleteDriver(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  bulkUpsertDrivers(rows: Partial<ApiDriver>[]): Observable<ApiDriver[]> {
    return this.http.post<ApiDriver[]>(`${this.baseUrl}/bulk`, rows);
  }
}
