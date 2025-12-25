import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ApiClient {
  id: number;
  name: string;
  crm: string | null;
  phoneNumber: string | null;
  pointOfContact: string | null;
  contactEmail: string | null;
  accountManager: string | null;
  // الحقول الجديدة
  contractDate: string | null;
  contractTerminationDate: string | null;
  isActive: boolean;
  company: '1' | '2' | null;
  clientType: string | null;
}

// DTO للإنشاء – name required والباقي optional
export type CreateClientDto = {
  name: string;
  crm?: string | null;
  phoneNumber?: string | null;
  pointOfContact?: string | null;
  contactEmail?: string | null;
  accountManager?: string | null;
  contractDate?: string | null;
  contractTerminationDate?: string | null;
  isActive?: boolean;
  company?: '1' | '2' | null;
  clientType?: string | null;
};

export type UpdateClientDto = Partial<CreateClientDto>;

export interface ImportClientDto {
  id?: number;
  name: string;
  crm?: string | null;
  phoneNumber?: string | null;
  pointOfContact?: string | null;
  contactEmail?: string | null;
  accountManager?: string | null;
  // الحقول الجديدة
  contractDate?: string | null;
  contractTerminationDate?: string | null;
  isActive?: boolean;
  company?: '1' | '2' | null;
  clientType?: string | null;
}

export interface BulkImportResult {
  total: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
}

@Injectable({
  providedIn: 'root',
})
export class ClientsServiceService {
  private readonly baseUrl = `${environment.apiUrl}/clients`;

  constructor(private http: HttpClient) {}

  getClients(): Observable<ApiClient[]> {
    return this.http.get<ApiClient[]>(this.baseUrl);
  }

  getClientById(id: number): Observable<ApiClient> {
    return this.http.get<ApiClient>(`${this.baseUrl}/${id}`);
  }

  createClient(body: CreateClientDto): Observable<ApiClient> {
    return this.http.post<ApiClient>(this.baseUrl, body);
  }

  updateClient(id: number, body: UpdateClientDto): Observable<ApiClient> {
    return this.http.put<ApiClient>(`${this.baseUrl}/${id}`, body);
  }

  deleteClient(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  bulkImportClients(body: ImportClientDto[]): Observable<BulkImportResult> {
    return this.http.post<BulkImportResult>(`${this.baseUrl}/bulk-import`, body);
  }
}
