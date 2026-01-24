import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';


import { FormModalClientContractsComponent, ContractFormValue, ContractToEdit } from './components/form-modal-client-contracts/form-modal-client-contracts.component';
import { StatusType, StatusMsgComponent } from '../../../components/status-msg/status-msg.component';
import { ApiClientContract, ContractStatus, ClientsContractsServiceService, UpdateClientContractDto, CreateClientContractDto, ImportContractDto, BulkImportContractsResult } from '../../../services/clients-contracts/clients-contracts-service.service';
import { ApiClient, ClientsServiceService } from '../../../services/clients/clients-service.service';
import { ExportButtonComponent } from '../../../shared/export-button/export-button';
import { ImportButtonComponent } from '../../../shared/import-button/import-button.component';

type UIContract = ApiClientContract;

interface StatusState {
  type: StatusType;
  message: string;
}

@Component({
  selector: 'app-clients-contracts',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ImportButtonComponent,
    ExportButtonComponent,
    StatusMsgComponent,
    FormModalClientContractsComponent,
  ],
  templateUrl: './clients-contracts.component.html',
  styleUrl: './clients-contracts.component.scss',
})
export class ClientsContractsComponent implements OnInit {
  status: StatusState | null = null;

  // data
  contracts = signal<UIContract[]>([]);
  clients = signal<ApiClient[]>([]);

  // filters
  search = signal<string>('');
  statusFilter = signal<ContractStatus | ''>('');
  clientFilter = signal<number | null>(null);

  // sorting
  sortField = signal<'clientName' | 'startDate' | 'endDate' | 'status'>('startDate');
  sortDirection = signal<'asc' | 'desc'>('desc');

  // pagination
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);

  // modals
  isModalOpen = signal<boolean>(false);
  contractToEdit = signal<UIContract | null>(null);

  // view modal (اختياري سريع)
  isViewModalOpen = signal<boolean>(false);
  viewingContract = signal<UIContract | null>(null);

  private contractsService = inject(ClientsContractsServiceService);
  private clientsService = inject(ClientsServiceService);

  ngOnInit(): void {
    this.loadClients();
    this.loadContracts();
  }

  private loadClients(): void {
    this.clientsService.getClients().subscribe({
      next: (list) => this.clients.set(list),
      error: (err) => {
        console.error('Failed to load clients', err);
        this.showStatus('error', 'Failed to load clients list.');
      },
    });
  }

  private loadContracts(): void {
    // هنجيبها كاملة ونفلتر على الفرونت زي clients
    this.contractsService.getContracts().subscribe({
      next: (list) => this.contracts.set(list),
      error: (err) => {
        console.error('Failed to load contracts', err);
        this.showStatus('error', 'Failed to load contracts.');
      },
    });
  }

  // ===== Computed =====
  clientOptions = computed(() =>
    this.clients()
      .map((c) => ({ id: c.id, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  );

  filtered = computed<UIContract[]>(() => {
    const term = this.search().toLowerCase().trim();
    const st = this.statusFilter();
    const clientId = this.clientFilter();
    const sortField = this.sortField();
    const sortDirection = this.sortDirection();

    let list = this.contracts().filter((c) => {
      const clientName = (c.client?.name ?? '').toLowerCase();
      const contractNo = (c.contractNumber ?? '').toLowerCase();
      const notes = (c.notes ?? '').toLowerCase();

      const matchesSearch =
        !term ||
        clientName.includes(term) ||
        contractNo.includes(term) ||
        notes.includes(term) ||
        (c.status ?? '').includes(term);

      const matchesStatus = !st || c.status === st;
      const matchesClient = !clientId || c.clientId === clientId;

      return matchesSearch && matchesStatus && matchesClient;
    });

    list.sort((a, b) => {
      let av: any = '';
      let bv: any = '';

      if (sortField === 'clientName') {
        av = (a.client?.name ?? '').toLowerCase();
        bv = (b.client?.name ?? '').toLowerCase();
      } else if (sortField === 'status') {
        av = a.status;
        bv = b.status;
      } else if (sortField === 'startDate') {
        av = a.startDate ? new Date(a.startDate).getTime() : 0;
        bv = b.startDate ? new Date(b.startDate).getTime() : 0;
      } else if (sortField === 'endDate') {
        av = a.endDate ? new Date(a.endDate).getTime() : 0;
        bv = b.endDate ? new Date(b.endDate).getTime() : 0;
      }

      if (av < bv) return sortDirection === 'asc' ? -1 : 1;
      if (av > bv) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  });

  totalPages = computed(() => Math.ceil(this.filtered().length / this.pageSize()));
  startIndex = computed(() => (this.currentPage() - 1) * this.pageSize());
  endIndex = computed(() => Math.min(this.startIndex() + this.pageSize(), this.filtered().length));

  paginatedContracts = computed(() =>
    this.filtered().slice(this.startIndex(), this.endIndex())
  );

  visiblePages = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const delta = 2;
    const range: (number | string)[] = [];
    const out: (number | string)[] = [];

    for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
      range.push(i);
    }

    if (current - delta > 2) out.push(1, '...');
    else out.push(1);

    out.push(...range);

    if (current + delta < total - 1) out.push('...', total);
    else if (total > 1) out.push(total);

    return out;
  });

  // ===== Filters =====
  hasActiveFilters(): boolean {
    return !!this.statusFilter() || !!this.clientFilter();
  }

  clearFilters(): void {
    this.search.set('');
    this.statusFilter.set('');
    this.clientFilter.set(null);
    this.currentPage.set(1);
  }

  // ===== Sorting =====
  sortBy(field: 'clientName' | 'startDate' | 'endDate' | 'status'): void {
    if (this.sortField() === field) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
  }

  // ===== Pagination =====
  goToPage(page: number | string): void {
    if (typeof page === 'number' && page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  previousPage(): void {
    if (this.currentPage() > 1) this.currentPage.set(this.currentPage() - 1);
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) this.currentPage.set(this.currentPage() + 1);
  }

  onPageSizeChange(size: string): void {
    this.pageSize.set(Number(size));
    this.currentPage.set(1);
  }

  // ===== Modals =====
  openAddModal(): void {
    this.contractToEdit.set(null);
    this.isModalOpen.set(true);
  }

  openEditModal(contract: UIContract): void {
    this.contractToEdit.set(contract);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.contractToEdit.set(null);
  }

  submitForm(value: ContractFormValue): void {
    const editing = this.contractToEdit();

    if (!value.clientId || !value.startDate) {
      this.showStatus('error', 'Client and start date are required.');
      return;
    }

    if (editing) {
      const payload: UpdateClientContractDto = {
        contractNumber: value.contractNumber ?? null,
        startDate: value.startDate,
        endDate: value.endDate ?? null,
        duration: value.duration ?? null,
        notes: value.notes ?? null,
        status: value.status,
        renewalAlertDate: value.renewalAlertDate ?? null,
      };

      this.contractsService.updateContract(editing.id, payload).subscribe({
        next: (updated) => {
          this.contracts.update((list) =>
            list.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
          );
          this.closeModal();
          this.showStatus('success', 'Contract updated successfully.');
          this.loadContracts();
        },
        error: (err) => {
          console.error('Failed to update contract', err);
          this.showStatus('error', 'Failed to update contract.');
        },
      });
    } else {
      const payload: CreateClientContractDto = {
        clientId: value.clientId,
        contractNumber: value.contractNumber ?? null,
        startDate: value.startDate,
        endDate: value.endDate ?? null,
        duration: value.duration ?? null,
        notes: value.notes ?? null,
        status: value.status ?? 'active',
        renewalAlertDate: value.renewalAlertDate ?? null,
      };

      this.contractsService.createContract(payload).subscribe({
        next: () => {
          this.closeModal();
          this.showStatus('success', 'Contract added successfully.');
          this.loadContracts();
        },
        error: (err) => {
          console.error('Failed to create contract', err);
          this.showStatus('error', 'Failed to create contract.');
        },
      });
    }
  }

  // view modal سريع
  openViewModal(c: UIContract): void {
    this.viewingContract.set(c);
    this.isViewModalOpen.set(true);
  }
  closeViewModal(): void {
    this.isViewModalOpen.set(false);
    this.viewingContract.set(null);
  }

  // ===== Actions =====
  deleteContract(id: number): void {
    if (!confirm('Are you sure you want to delete this contract?')) return;

    this.contractsService.deleteContract(id).subscribe({
      next: () => {
        this.contracts.update((list) => list.filter((c) => c.id !== id));
        this.showStatus('success', 'Contract deleted successfully.');
      },
      error: (err) => {
        console.error('Failed to delete contract', err);
        this.showStatus('error', 'Failed to delete contract.');
      },
    });
  }

  // ===== Import =====
  onContractsImport(file: File): void {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') this.importFromXlsx(file);
    else this.importFromCsv(file);
  }

  private importFromXlsx(file: File): void {
    const XLSX: any = (window as any)?.XLSX;
    if (!XLSX?.read || !XLSX?.utils) {
      console.warn('XLSX library not found on window, falling back to CSV.');
      this.importFromCsv(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: null });
        this.applyImportedContracts(json, file.name);
      } catch (err) {
        console.error('Failed to import XLSX', err);
        this.showStatus('error', 'Failed to import Excel file.');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  private importFromCsv(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const rows = this.parseCsv(text);
        this.applyImportedContracts(rows, file.name);
      } catch (err) {
        console.error('Failed to import CSV', err);
        this.showStatus('error', 'Failed to import CSV file.');
      }
    };
    reader.readAsText(file);
  }

  private normalizeImportedDate(value: any): string | null {
    if (value === null || value === undefined || value === '') return null;

    if (typeof value === 'number') {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const date = new Date(excelEpoch.getTime() + value * 86400000);
      return date.toISOString().split('T')[0];
    }

    if (value instanceof Date) return value.toISOString().split('T')[0];

    const str = String(value).trim();
    if (!str) return null;

    // يدعم 2024/02/15
    const normalized = str.replace(/\//g, '-');
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) return null;

    return parsed.toISOString().split('T')[0];
  }

  private mapStatus(value: any): ContractStatus {
    if (!value) return 'active';
    const s = String(value).trim().toLowerCase();
    if (s.includes('ساري')) return 'active';
    if (s.includes('منتهي')) return 'expired';
    if (s.includes('فسخ')) return 'terminated';

    if (['active'].includes(s)) return 'active';
    if (['expired', 'ended', 'finished'].includes(s)) return 'expired';
    if (['terminated', 'canceled', 'cancelled'].includes(s)) return 'terminated';
    return 'active';
  }

  private applyImportedContracts(rows: any[], fileName: string): void {
    if (!rows || !rows.length) {
      this.showStatus('error', 'No data found in imported file.');
      return;
    }

    const payload: ImportContractDto[] = [];

    for (const raw of rows) {
      if (!raw) continue;

      // يدعم headers عربي أو إنجليزي
      const clientName =
        raw.clientName ??
        raw['اسم الشركة'] ??
        raw['Client Name'] ??
        raw['Company Name'] ??
        raw['name'];

      const contractNumber =
        raw.contractNumber ??
        raw['رقم العقد'] ??
        raw['Contract Number'];

      const startDate = this.normalizeImportedDate(
        raw.startDate ?? raw['تاريخ بداية العقد'] ?? raw['Start Date']
      );

      const endDate = this.normalizeImportedDate(
        raw.endDate ?? raw['تاريخ نهاية العقد'] ?? raw['End Date']
      );

      const duration = raw.duration ?? raw['مدة العقد'] ?? raw['Duration'];
      const notes = raw.notes ?? raw['ملاحظات'] ?? raw['Notes'];
      const statusRaw = raw.status ?? raw['حالة العقد'] ?? raw['Status'];
      const renewalAlertDate = this.normalizeImportedDate(
        raw.renewalAlertDate ?? raw['تنبيه التجديد'] ?? raw['Renewal Alert']
      );

      if (!clientName || !startDate) continue;

      payload.push({
        clientName: String(clientName).trim(),
        contractNumber: contractNumber ? String(contractNumber).trim() : null,
        startDate,
        endDate: endDate ?? null,
        duration: duration ? String(duration).trim() : null,
        notes: notes ? String(notes).trim() : null,
        status: this.mapStatus(statusRaw),
        renewalAlertDate: renewalAlertDate ?? null,
      });
    }

    if (!payload.length) {
      this.showStatus('error', 'No valid contracts found in imported file.');
      return;
    }

    this.contractsService.bulkImportContracts(payload).subscribe({
      next: (result: BulkImportContractsResult) => {
        this.loadContracts();

        const msg =
          `Imported ${payload.length} contracts from ${fileName}. ` +
          `Clients created: ${result.createdClients}. ` +
          `Contracts created: ${result.createdContracts}, updated: ${result.updatedContracts}, skipped: ${result.skipped}.`;

        this.showStatus('success', msg);
      },
      error: (err) => {
        console.error('Failed to import contracts', err);
        this.showStatus('error', 'Failed to import contracts to server.');
      },
    });
  }

  private parseCsv(text: string): any[] {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length);

    if (!lines.length) return [];
    const headers = this.parseCsvLine(lines[0]);
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = this.parseCsvLine(lines[i]);
      const row: any = {};
      headers.forEach((h, idx) => (row[h] = cols[idx] ?? ''));
      rows.push(row);
    }

    return rows;
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur);
    return result;
  }

  // ===== Status msg =====
  showStatus(type: StatusType, message: string): void {
    this.status = { type, message };
    setTimeout(() => {
      if (this.status?.type === type && this.status?.message === message) this.status = null;
    }, 3000);
  }

  clearStatus(): void {
    this.status = null;
  }

  formatDate(dateString: string | null | undefined): string {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return '-';
    }
  }

  statusLabel(s: ContractStatus): string {
    if (s === 'active') return 'Active';
    if (s === 'expired') return 'Expired';
    return 'Terminated';
  }

  statusClass(s: ContractStatus): string {
    if (s === 'active') return 'status-active';
    if (s === 'expired') return 'status-expired';
    return 'status-terminated';
  }
}
