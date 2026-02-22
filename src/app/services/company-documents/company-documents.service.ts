import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export type CompanyDocStatus = 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'ONGOING';
export type CompanyDocSortKey = 'createdDesc' | 'expiryAsc' | 'expiryDesc';

export interface ApiOk<T> {
  ok: true;
  data: T;
  meta?: any;
}
export interface ApiErr {
  ok: false;
  message?: string;
  errors?: string[];
}

export interface CompanyRef {
  id: number;
  code?: string;
  name: string;
}

export interface CompanyDocumentType {
  id: number;
  code?: string;
  name?: string; // لو عندك قديم
  nameAr?: string; // الباك بيرجعها
  nameEn?: string | null;
  defaultSoonDays?: number | null;
}

export interface CompanyDocComputed {
  computedExpiryDate: string | null;
  remainingDays: number | null;
  status: CompanyDocStatus;
  statusLabelAr: string;
  soonDays: number;
}

export interface CompanyDocument {
  id: number;

  companyId: number;
  typeId: number;

  documentNumber?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  validityYears?: number | null;

  currentLocation?: string | null;

  custodianRole?: string | null;
  custodianName?: string | null;
  custodianPhone?: string | null;
  custodianOrganization?: string | null;

  remindAt?: string | null;
  remindNote?: string | null;

  notes?: string | null;

  company?: CompanyRef;
  type?: CompanyDocumentType;

  computed?: CompanyDocComputed;
}

export interface ListCompanyDocsParams {
  page?: number;
  limit?: number;

  companyId?: number | null;
  typeId?: number | null;

  q?: string | null;
  status?: '' | CompanyDocStatus | null;

  sort?: CompanyDocSortKey;
  expFrom?: string | null;
  expTo?: string | null;

  soonDays?: number | null;
}

export interface ListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type ListDocsOk = (ApiOk<CompanyDocument[]> & { meta: ListMeta });

@Injectable({ providedIn: 'root' })
export class CompanyDocumentsService {
  private readonly base = `${environment.apiUrl}/company-documents`;

  constructor(private http: HttpClient) {}

  // =========================
  // Helpers
  // =========================
  private unwrapOrThrow<T>(res: ApiOk<T> | ApiErr): T {
    if ((res as any)?.ok === true) return (res as ApiOk<T>).data;

    const msg =
      (res as ApiErr)?.message ||
      ((res as ApiErr)?.errors?.length ? (res as ApiErr)!.errors!.join(', ') : '') ||
      'Request failed';

    throw new Error(msg);
  }

  // =========================
  // Dropdowns
  // =========================
  listCompanies(): Observable<CompanyRef[]> {
    return this.http
      .get<ApiOk<CompanyRef[]> | ApiErr>(`${this.base}/companies`)
      .pipe(map((res) => this.unwrapOrThrow(res)));
  }

  listDocumentTypes(): Observable<CompanyDocumentType[]> {
    return this.http
      .get<ApiOk<CompanyDocumentType[]> | ApiErr>(`${this.base}/document-types`)
      .pipe(map((res) => this.unwrapOrThrow(res)));
  }

  // =========================
  // Documents (API)
  // =========================
  listDocuments(params: ListCompanyDocsParams): Observable<ListDocsOk | ApiErr> {
    let hp = new HttpParams();
    const add = (k: string, v: any) => {
      if (v === undefined || v === null || v === '') return;
      hp = hp.set(k, String(v));
    };

    add('page', params.page ?? 1);
    add('limit', params.limit ?? 20);
    add('companyId', params.companyId);
    add('typeId', params.typeId);
    add('q', (params.q ?? '').trim());
    add('status', params.status ?? '');
    add('sort', params.sort ?? 'createdDesc');
    add('expFrom', params.expFrom);
    add('expTo', params.expTo);
    add('soonDays', params.soonDays);

    return this.http.get<ListDocsOk | ApiErr>(`${this.base}`, { params: hp });
  }

  getOne(id: number): Observable<ApiOk<CompanyDocument> | ApiErr> {
    return this.http.get<ApiOk<CompanyDocument> | ApiErr>(`${this.base}/${id}`);
  }

  create(payload: Partial<CompanyDocument>): Observable<ApiOk<CompanyDocument> | ApiErr> {
    return this.http.post<ApiOk<CompanyDocument> | ApiErr>(`${this.base}`, payload);
  }

  update(id: number, payload: Partial<CompanyDocument>): Observable<ApiOk<CompanyDocument> | ApiErr> {
    return this.http.put<ApiOk<CompanyDocument> | ApiErr>(`${this.base}/${id}`, payload);
  }

  remove(id: number): Observable<ApiOk<any> | ApiErr> {
    return this.http.delete<ApiOk<any> | ApiErr>(`${this.base}/${id}`);
  }

  // =========================
  // ✅ Compatibility methods (Fix your current components)
  // =========================
  /** used by CompanyDocumentsComponent */
  list(params: ListCompanyDocsParams = {}): Observable<CompanyDocument[]> {
    return this.listDocuments(params).pipe(
      map((res) => this.unwrapOrThrow(res as any))
    );
  }

  /** used by CompanyDocumentDetailsComponent */
  getById(id: number): Observable<CompanyDocument> {
    return this.getOne(id).pipe(
      map((res) => this.unwrapOrThrow(res as any))
    );
  }
}
