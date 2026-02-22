import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';

import {
  CompanyDocumentsService,
  CompanyDocument,
  CompanyDocStatus,
} from '../../../services/company-documents/company-documents.service';

import {
  StatusMsgComponent,
  StatusType,
} from '../../../components/status-msg/status-msg.component';

import { ExportButtonComponent } from '../../../shared/export-button/export-button';
import { CompanyDocumentModalComponent } from './compoenets/company-document-modal/company-document-modal.component';

type LoadState = 'idle' | 'loading' | 'success' | 'error';
type RowStatus = CompanyDocStatus | 'NEW';
type StatusFilter = 'ALL' | RowStatus;

type ModalMode = 'CREATE' | 'EDIT' | 'VIEW';

type CompanyRef = { id: number; code?: string; name: string };
type CompanyDocumentType = {
  id: number;
  code?: string;
  name?: string;
  nameAr?: string;
  nameEn?: string | null;
  defaultSoonDays?: number | null;
};

interface StatusState {
  type: StatusType;
  message: string;
}

@Component({
  selector: 'app-company-documents',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ExportButtonComponent,
    StatusMsgComponent,
    CompanyDocumentModalComponent,
  ],
  templateUrl: './company-documents.component.html',
  styleUrls: ['./company-documents.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanyDocumentsComponent implements OnInit, OnDestroy {
  /** مؤقتاً */
  isAdmin = true;

  private statusTimer: any = null;

  statusMsg: StatusState | null = null;

  state = signal<LoadState>('idle');
  errorMsg = signal<string>('');

  rows = signal<CompanyDocument[]>([]);

  // Meta
  companies = signal<CompanyRef[]>([]);
  types = signal<CompanyDocumentType[]>([]);

  // Filters
  q = signal<string>('');
  filterStatus = signal<StatusFilter>('ALL');
  typeIdFilter = signal<string>('');
  companyIdFilter = signal<string>('');

  // Pagination
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);
  pageSizes = signal<number[]>([5, 10, 20, 50]);

  // Modal
  isModalOpen = signal<boolean>(false);
  modalMode = signal<ModalMode>('CREATE');
  activeRow = signal<CompanyDocument | null>(null);
  busy = signal<boolean>(false);

  constructor(private svc: CompanyDocumentsService, private router: Router) {}

  ngOnInit(): void {
    this.loadMeta();
    this.load();
  }

  ngOnDestroy(): void {
    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }
  }

  // ===== Helpers (robust service method calling) =====
  private callSvc<T>(names: string[], ...args: any[]): Observable<T> | null {
    const api: any = this.svc;
    for (const n of names) {
      if (typeof api?.[n] === 'function') return api[n](...args);
    }
    return null;
  }

  // ===== Data / Filtering =====
  filtered = computed<CompanyDocument[]>(() => {
    const q = this.q().trim().toLowerCase();
    const st = this.filterStatus();
    const typeId = (this.typeIdFilter() || '').trim();
    const companyId = (this.companyIdFilter() || '').trim();

    return this.rows().filter((r) => {
      const rs = this.rowStatus(r);

      if (st !== 'ALL' && rs !== st) return false;
      if (typeId && String(r.typeId ?? '') !== typeId) return false;
      if (companyId && String(r.companyId ?? '') !== companyId) return false;

      if (!q) return true;

      const hay = [
        r.documentNumber,
        r.company?.code,
        r.company?.name,
        r.type?.code,
        r.type?.name,
        r.type?.nameAr,
        r.type?.nameEn,
        r.currentLocation,
        (r as any)?.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return hay.includes(q);
    });
  });

  paginatedRows = computed<CompanyDocument[]>(() => {
    const startIndex = (this.currentPage() - 1) * this.pageSize();
    return this.filtered().slice(startIndex, startIndex + this.pageSize());
  });

  paginationStats = computed(() => {
    const totalItems = this.filtered().length;
    const totalPages = Math.max(1, Math.ceil(totalItems / this.pageSize()));
    const currentPage = Math.min(this.currentPage(), totalPages);

    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * this.pageSize() + 1;
    const endItem = totalItems === 0 ? 0 : Math.min(currentPage * this.pageSize(), totalItems);

    return {
      totalItems,
      totalPages,
      currentPage,
      startItem,
      endItem,
      hasPrevious: currentPage > 1,
      hasNext: currentPage < totalPages,
    };
  });

  visiblePages = computed<(number | string)[]>(() => {
    const stats = this.paginationStats();
    const totalPages = stats.totalPages;
    const currentPage = stats.currentPage;

    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

    if (currentPage <= 4) return [1, 2, 3, 4, 5, '...', totalPages];

    if (currentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  });

  numberPages = computed<number[]>(() => {
    return this.visiblePages().filter((p) => typeof p === 'number') as number[];
  });

  applyFilters(): void {
    this.currentPage.set(1);
  }

  clearFilters(): void {
    this.q.set('');
    this.filterStatus.set('ALL');
    this.typeIdFilter.set('');
    this.companyIdFilter.set('');
    this.currentPage.set(1);
  }

  // ===== Pagination actions =====
  goToPage(page: number): void {
    const max = this.paginationStats().totalPages;
    if (page >= 1 && page <= max) this.currentPage.set(page);
  }

  nextPage(): void {
    if (this.paginationStats().hasNext) this.currentPage.update((p) => p + 1);
  }

  previousPage(): void {
    if (this.paginationStats().hasPrevious) this.currentPage.update((p) => p - 1);
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(Number(size));
    this.currentPage.set(1);
  }

  // ===== Status msg =====
  private setStatus(type: StatusType, message: string): void {
    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }

    this.statusMsg = { type, message };
    this.statusTimer = setTimeout(() => {
      this.statusMsg = null;
      this.statusTimer = null;
    }, 3000);
  }

  private setSuccess(msg: string) {
    this.setStatus('success', msg);
  }

  private setError(msg: string) {
    this.setStatus('error', msg);
  }

  clearStatus(): void {
    this.statusMsg = null;
    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }
  }

  // ===== Load data =====
  loadMeta(): void {
    const companies$ = this.callSvc<CompanyRef[]>(['listCompanies', 'getCompanies', 'companies', 'getCompaniesRef']);
    const types$ = this.callSvc<CompanyDocumentType[]>(['listDocumentTypes', 'listTypes', 'getTypes', 'types', 'getDocumentTypes']);

    companies$?.subscribe({
      next: (list) => this.companies.set(list || []),
      error: () => this.companies.set([]),
    });

    types$?.subscribe({
      next: (list) => this.types.set(list || []),
      error: () => this.types.set([]),
    });
  }

  load(): void {
    this.state.set('loading');
    this.errorMsg.set('');

    this.svc.list().subscribe({
      next: (rows: CompanyDocument[]) => {
        this.rows.set(rows || []);
        this.state.set('success');

        const max = this.paginationStats().totalPages;
        if (this.currentPage() > max) this.currentPage.set(max);
      },
      error: (err) => {
        this.state.set('error');
        this.errorMsg.set(err?.error?.message || err?.message || 'Failed to load documents.');
      },
    });
  }

  // ===== Table helpers =====
  trackById = (_: number, r: CompanyDocument) => r.id;

  formatDate(dateString: string | null | undefined): string {
    if (!dateString) return '—';
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return String(dateString);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  rowStatus(r: CompanyDocument): RowStatus {
    return ((r as any)?.computed?.status as CompanyDocStatus) || 'NEW';
  }

  statusLabel(s: RowStatus): string {
    switch (s) {
      case 'ACTIVE': return 'Active';
      case 'EXPIRING_SOON': return 'Expiring Soon';
      case 'EXPIRED': return 'Expired';
      case 'ONGOING': return 'Ongoing';
      case 'NEW': return 'New';
      default: return String(s);
    }
  }

  statusIcon(s: RowStatus): string {
    switch (s) {
      case 'ACTIVE': return 'ri-check-line';
      case 'EXPIRING_SOON': return 'ri-alarm-warning-line';
      case 'EXPIRED': return 'ri-error-warning-line';
      case 'ONGOING': return 'ri-infinity-line';
      case 'NEW': return 'ri-sparkling-2-line';
      default: return 'ri-information-line';
    }
  }

  // ✅ Navigate to details
  goToDetails(r: CompanyDocument): void {
    this.router.navigate(['/hr/company-documents', r.id]);
  }

  // ===== Modal actions (Add/Edit only) =====
  openAddModal(): void {
    this.activeRow.set(null);
    this.modalMode.set('CREATE');
    this.isModalOpen.set(true);
    this.clearStatus();
  }

  openEditModal(r: CompanyDocument): void {
    this.activeRow.set(r);
    this.modalMode.set('EDIT');
    this.isModalOpen.set(true);
    this.clearStatus();
  }

  closeModal(): void {
    if (this.busy()) return;
    this.isModalOpen.set(false);
    this.activeRow.set(null);
  }

  onModalSaved(payload: Partial<CompanyDocument>): void {
    if (this.busy()) return;

    const mode = this.modalMode();

    const apiCreate = () =>
      this.callSvc<CompanyDocument>(['create', 'createDocument', 'add', 'addDocument'], payload);

    const apiUpdate = (id: number) =>
      this.callSvc<CompanyDocument>(['update', 'updateDocument', 'edit', 'editDocument'], id, payload);

    this.busy.set(true);

    if (mode === 'CREATE') {
      const req = apiCreate();
      if (!req) {
        this.busy.set(false);
        this.setError('Create API method is not wired in CompanyDocumentsService.');
        return;
      }

      req.subscribe({
        next: (created) => {
          this.rows.update((list) => [created as any, ...list]);
          this.closeModal();
          this.setSuccess('Document created successfully.');
          this.busy.set(false);
        },
        error: (err) => {
          this.busy.set(false);
          this.setError(err?.error?.message || 'Failed to create document.');
        },
      });

      return;
    }

    // EDIT
    const current = this.activeRow();
    const id = current?.id;
    if (!id) {
      this.busy.set(false);
      this.setError('Missing document id for update.');
      return;
    }

    const req = apiUpdate(id);
    if (!req) {
      this.busy.set(false);
      this.setError('Update API method is not wired in CompanyDocumentsService.');
      return;
    }

    req.subscribe({
      next: (updated) => {
        this.rows.update((list) =>
          list.map((x) => (x.id === id ? ({ ...x, ...(updated as any) } as any) : x))
        );
        this.closeModal();
        this.setSuccess('Document updated successfully.');
        this.busy.set(false);
      },
      error: (err) => {
        this.busy.set(false);
        this.setError(err?.error?.message || 'Failed to update document.');
      },
    });
  }

  deleteRow(r: CompanyDocument): void {
    if (!this.isAdmin) return;
    if (!confirm('Are you sure you want to delete this document?')) return;

    const req = this.callSvc<void>(['remove', 'removeDocument', 'delete', 'deleteDocument'], r.id);

    if (!req) {
      this.setError('Delete API method is not wired in CompanyDocumentsService.');
      return;
    }

    this.busy.set(true);
    req.subscribe({
      next: () => {
        this.rows.update((list) => list.filter((x) => x.id !== r.id));
        this.setSuccess('Document deleted successfully.');
        this.busy.set(false);

        const max = this.paginationStats().totalPages;
        if (this.currentPage() > max) this.currentPage.set(max);
      },
      error: (err) => {
        this.busy.set(false);
        this.setError(err?.error?.message || 'Failed to delete document.');
      },
    });
  }
}
