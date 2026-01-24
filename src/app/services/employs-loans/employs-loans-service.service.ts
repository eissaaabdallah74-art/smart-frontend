// src/app/services/employs-loans-service/employs-loans-service.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth-service.service';

export type LoanStatus = 'pending' | 'approved' | 'rejected';

export interface LoanApiUser {
  id: number;
  fullName: string;
  email: string;
  role: string;
  position?: string | null;
  isActive: boolean;
}

export interface LoanApiRow {
  id: number;
  requesterId: number;
  amount: string | number;
  note?: string | null;
  status: LoanStatus;

  managerNote?: string | null;
  decidedAt?: string | null;
  decidedById?: number | null;

  // timestamps (حسب Sequelize underscored)
  created_at?: string;
  updated_at?: string;

  // sometimes may appear camelCase depending on your sequelize config
  createdAt?: string;
  updatedAt?: string;

  requester?: LoanApiUser;
  decidedBy?: LoanApiUser | null;
}

@Injectable({
  providedIn: 'root',
})
export class EmploysLoansServiceService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private readonly baseUrl = `${environment.apiUrl}/operations/loans`;

  private headers(): HttpHeaders {
    return new HttpHeaders(this.auth.getAuthorizationHeader());
  }

  async createLoan(amount: number, note?: string): Promise<LoanApiRow> {
    const res = await firstValueFrom(
      this.http.post<LoanApiRow>(
        `${this.baseUrl}`,
        { amount, note: note || undefined },
        { headers: this.headers() }
      )
    );
    return res;
  }

  async getMyLoans(): Promise<LoanApiRow[]> {
    const res = await firstValueFrom(
      this.http.get<LoanApiRow[]>(`${this.baseUrl}/my`, {
        headers: this.headers(),
      })
    );
    return res;
  }

  async getLoans(params?: {
    status?: LoanStatus;
    requesterId?: number;
    q?: string;
  }): Promise<LoanApiRow[]> {
    const qp = new URLSearchParams();
    if (params?.status) qp.set('status', params.status);
    if (params?.requesterId) qp.set('requesterId', String(params.requesterId));
    if (params?.q) qp.set('q', params.q);

    const url = qp.toString() ? `${this.baseUrl}?${qp.toString()}` : this.baseUrl;

    const res = await firstValueFrom(
      this.http.get<LoanApiRow[]>(url, { headers: this.headers() })
    );
    return res;
  }

  async getPendingLoans(): Promise<LoanApiRow[]> {
    const res = await firstValueFrom(
      this.http.get<LoanApiRow[]>(`${this.baseUrl}/pending`, {
        headers: this.headers(),
      })
    );
    return res;
  }

  async approve(id: number, managerNote?: string): Promise<LoanApiRow> {
    const res = await firstValueFrom(
      this.http.patch<LoanApiRow>(
        `${this.baseUrl}/${id}/approve`,
        { managerNote: managerNote || undefined },
        { headers: this.headers() }
      )
    );
    return res;
  }

  async reject(id: number, managerNote?: string): Promise<LoanApiRow> {
    const res = await firstValueFrom(
      this.http.patch<LoanApiRow>(
        `${this.baseUrl}/${id}/reject`,
        { managerNote: managerNote || undefined },
        { headers: this.headers() }
      )
    );
    return res;
  }
}
