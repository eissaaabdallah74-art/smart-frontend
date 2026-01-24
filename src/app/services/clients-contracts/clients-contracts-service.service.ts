import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ApiContractClientRef {
  id: number;
  name: string;
}

export type ContractStatus = 'active' | 'expired' | 'terminated';

export interface ApiClientContract {
  id: number;
  clientId: number;
  contractNumber: string | null;
  startDate: string;              // YYYY-MM-DD
  endDate: string | null;         // YYYY-MM-DD
  duration: string | null;
  notes: string | null;
  status: ContractStatus;
  renewalAlertDate: string | null;

  createdAt?: string;
  updatedAt?: string;

  client?: ApiContractClientRef;  // included by backend in getAll
}

export type CreateClientContractDto = {
  clientId: number;
  contractNumber?: string | null;
  startDate: string;              // required
  endDate?: string | null;
  duration?: string | null;
  notes?: string | null;
  status?: ContractStatus;
  renewalAlertDate?: string | null;
};

export type UpdateClientContractDto = Partial<CreateClientContractDto>;

export interface ImportContractDto {
  id?: number;
  clientName: string;
  contractNumber?: string | null;
  startDate: string;              // required
  endDate?: string | null;
  duration?: string | null;
  notes?: string | null;
  status?: ContractStatus | string; // ممكن عربي
  renewalAlertDate?: string | null;
}

export interface BulkImportContractsResult {
  total: number;
  createdClients: number;
  createdContracts: number;
  updatedContracts: number;
  skipped: number;
}

@Injectable({ providedIn: 'root' })
export class ClientsContractsServiceService {
  private readonly baseUrl = `${environment.apiUrl}/client-contracts`;

  constructor(private http: HttpClient) {}

  getContracts(filters?: { q?: string; status?: ContractStatus | ''; clientId?: number | null })
    : Observable<ApiClientContract[]> {
    let params = new HttpParams();
    if (filters?.q) params = params.set('q', filters.q);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.clientId) params = params.set('clientId', String(filters.clientId));
    return this.http.get<ApiClientContract[]>(this.baseUrl, { params });
  }

  getContractById(id: number): Observable<ApiClientContract> {
    return this.http.get<ApiClientContract>(`${this.baseUrl}/${id}`);
  }

  createContract(body: CreateClientContractDto): Observable<ApiClientContract> {
    return this.http.post<ApiClientContract>(this.baseUrl, body);
  }

  updateContract(id: number, body: UpdateClientContractDto): Observable<ApiClientContract> {
    return this.http.put<ApiClientContract>(`${this.baseUrl}/${id}`, body);
  }

  deleteContract(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  bulkImportContracts(body: ImportContractDto[]): Observable<BulkImportContractsResult> {
    return this.http.post<BulkImportContractsResult>(`${this.baseUrl}/bulk-import`, body);
  }
}
