import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

import type {
  DriverContractStatus,
  SignedWithHrStatus,
  SecurityResult as EnumSecurityResult,
} from '../../shared/enums/driver-enums';

// ✅ keep old export name used across app (so you don't break imports)
export type SecurityResult = EnumSecurityResult;

export interface ApiInterview {
  id: number;

  date: string;
  ticketNo: string | null;
  ticketExpiresAt: string | null;

  courierName: string;
  phoneNumber: string;
  nationalId: string | null;

  residence: string | null;

  clientId: number | null;
  hubId: number | null;
  zoneId: number | null;
  position: string | null;
  vehicleType: string | null;
  accountManagerId: number | null;
  interviewerId: number | null;

  // ✅ ENUM
  signedWithHr: SignedWithHrStatus | null;

  feedback: string | null;
  hrFeedback: string | null;
  crmFeedback: string | null;
  followUp1: string | null;
  followUp2: string | null;
  followUp3: string | null;

  // ✅ we unify this to DriverContractStatus (same enum as Driver.contractStatus)
  courierStatus: DriverContractStatus | null;

  securityResult: SecurityResult | null;

  notes: string | null;

  // ✅ Licenses (DATEONLY / yyyy-mm-dd)
  vLicenseExpiryDate: string | null;
  dLicenseExpiryDate: string | null;
  idExpiryDate: string | null;

  client?: { id: number; name: string };
  hub?: { id: number; name: string };
  zone?: { id: number; name: string };
  accountManager?: { id: number; fullName: string };
  interviewer?: { id: number; fullName: string };
}

// DTO المستخدم في الـ create
export type CreateInterviewDto = Omit<
  ApiInterview,
  | 'id'
  | 'client'
  | 'hub'
  | 'zone'
  | 'accountManager'
  | 'interviewer'
  | 'ticketNo'
  | 'ticketExpiresAt'
  | 'hrFeedback'
  | 'securityResult'
> & {
  // نخلي دول optional عشان مش كل الفورم بتبعتهم
  ticketNo?: string | null;
  ticketExpiresAt?: string | null;
  hrFeedback?: string | null;
  crmFeedback?: string | null;
  securityResult?: SecurityResult | null;
};

// في الـ update كل حاجة optional
export type UpdateInterviewDto = Partial<CreateInterviewDto>;

@Injectable({ providedIn: 'root' })
export class InterviewsServiceService {
  private readonly baseUrl = `${environment.apiUrl}/interviews`;

  constructor(private http: HttpClient) {}

  getInterviews(params?: { q?: string }): Observable<ApiInterview[]> {
    let httpParams = new HttpParams();
    if (params?.q) httpParams = httpParams.set('q', params.q);
    return this.http.get<ApiInterview[]>(this.baseUrl, { params: httpParams });
  }

  getInterview(id: number): Observable<ApiInterview> {
    return this.http.get<ApiInterview>(`${this.baseUrl}/${id}`);
  }

  createInterview(body: CreateInterviewDto): Observable<ApiInterview> {
    return this.http.post<ApiInterview>(this.baseUrl, body);
  }

  updateInterview(id: number, body: UpdateInterviewDto): Observable<ApiInterview> {
    return this.http.put<ApiInterview>(`${this.baseUrl}/${id}`, body);
  }

  deleteInterview(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
