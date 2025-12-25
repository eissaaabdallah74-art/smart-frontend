import { Component, OnInit, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  StatusType,
  StatusMsgComponent,
} from '../../../components/status-msg/status-msg.component';
import {
  ClientFormModalComponent,
  ClientFormValue,
} from './components/client-form-modal/client-form-modal';
import {
  ApiClient,
  ClientsServiceService,
  UpdateClientDto,
  CreateClientDto,
  ImportClientDto,
  BulkImportResult,
} from '../../../services/clients/clients-service.service';
import {
  ApiUser,
  UsersServiceService,
} from '../../../services/users/users-service.service';
import { ExportButtonComponent } from '../../../shared/export-button/export-button';
import { ImportButtonComponent } from '../../../shared/import-button/import-button.component';

export type UIClient = ApiClient;

interface StatusState {
  type: StatusType;
  message: string;
}

@Component({
  standalone: true,
  selector: 'app-clients',
  templateUrl: './clients.page.html',
  styleUrls: ['./clients.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ExportButtonComponent,
    ImportButtonComponent,
    ClientFormModalComponent,
    StatusMsgComponent,
  ],
})
export class ClientsPage implements OnInit {
  isAdmin = true;
  status: StatusState | null = null;

  // Signals
  clients = signal<UIClient[]>([]);
  private crmUsers = signal<ApiUser[]>([]);
  private operationUsers = signal<ApiUser[]>([]);

  // Search and Filters
  search = signal<string>('');
  statusFilter = signal<string>('');
  companyFilter = signal<string>('');
  crmFilter = signal<string>('');

  // Sorting
  sortField = signal<string>('name');
  sortDirection = signal<'asc' | 'desc'>('asc');

  // Pagination
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);

  // Modals
  isModalOpen = signal<boolean>(false);
  isViewModalOpen = signal<boolean>(false);
  clientToEdit = signal<UIClient | null>(null);
  viewingClient = signal<UIClient | null>(null);

  // Services
  private clientsService = inject(ClientsServiceService);
  private usersService = inject(UsersServiceService);

  ngOnInit(): void {
    this.loadClients();
    this.loadCrmUsers();
    this.loadOperationUsers();
  }

  // ===== تحميل البيانات =====
  private loadClients(): void {
    this.clientsService.getClients().subscribe({
      next: (list) => {
        this.clients.set(list);
      },
      error: (err) => {
        console.error('Failed to load clients', err);
        this.showStatus('error', 'Failed to load clients.');
      },
    });
  }

  private loadCrmUsers(): void {
    this.usersService.getUsers({ role: 'crm', active: true }).subscribe({
      next: (list) => {
        console.log('[CRM USERS]', list);
        this.crmUsers.set(list);
      },
      error: (err) => {
        console.error('Failed to load CRM users', err);
        this.showStatus('error', 'Failed to load CRM users.');
      },
    });
  }

  private loadOperationUsers(): void {
    this.usersService.getUsers({ role: 'operation', active: true }).subscribe({
      next: (list) => {
        console.log('[OPERATION USERS]', list);
        this.operationUsers.set(list);
      },
      error: (err) => {
        console.error('Failed to load operation users', err);
        this.showStatus('error', 'Failed to load operation users.');
      },
    });
  }

  // ===== Computed values =====
  crmNames = computed<string[]>(() =>
    this.crmUsers()
      .map((u) => u.fullName)
      .sort((a, b) => a.localeCompare(b))
  );

  accountManagerNames = computed<string[]>(() =>
    this.operationUsers()
      .map((u) => u.fullName)
      .sort((a, b) => a.localeCompare(b))
  );

  // Advanced Filtering
  filtered = computed<UIClient[]>(() => {
    const term = this.search().toLowerCase().trim();
    const status = this.statusFilter();
    const company = this.companyFilter();
    const crm = this.crmFilter();
    const sortField = this.sortField();
    const sortDirection = this.sortDirection();

    let filtered = this.clients().filter((client) => {
      // Quick search
      const matchesSearch =
        !term ||
        client.name.toLowerCase().includes(term) ||
        (client.crm ?? '').toLowerCase().includes(term) ||
        (client.pointOfContact ?? '').toLowerCase().includes(term) ||
        (client.phoneNumber ?? '').toLowerCase().includes(term) ||
        (client.contactEmail ?? '').toLowerCase().includes(term) ||
        (client.accountManager ?? '').toLowerCase().includes(term) ||
        (client.clientType ?? '').toLowerCase().includes(term) ||
        (client.company === '1'
          ? 'company 1'
          : client.company === '2'
          ? 'company 2'
          : ''
        ).includes(term) ||
        (client.isActive ? 'active' : 'inactive').includes(term);

      // Status filter
      const matchesStatus =
        !status ||
        (status === 'active' && client.isActive) ||
        (status === 'inactive' && !client.isActive);

      // Company filter
      const matchesCompany = !company || client.company === (company as any);

      // CRM filter
      const matchesCrm = !crm || client.crm === crm;

      return matchesSearch && matchesStatus && matchesCompany && matchesCrm;
    });

    // Sorting
    filtered.sort((a, b) => {
      let aValue: any = a[sortField as keyof UIClient];
      let bValue: any = b[sortField as keyof UIClient];

      // Handle boolean values for status
      if (sortField === 'isActive') {
        aValue = a.isActive ? 1 : 0;
        bValue = b.isActive ? 1 : 0;
      }

      // Handle date values
      if (sortField === 'contractDate') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      }

      // Handle string values
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = (bValue as string).toLowerCase();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  });

  // Pagination computed values
  totalPages = computed(() =>
    Math.ceil(this.filtered().length / this.pageSize())
  );
  startIndex = computed(
    () => (this.currentPage() - 1) * this.pageSize()
  );
  endIndex = computed(() =>
    Math.min(this.startIndex() + this.pageSize(), this.filtered().length)
  );

  paginatedClients = computed(() =>
    this.filtered().slice(this.startIndex(), this.endIndex())
  );

  visiblePages = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const delta = 2;
    const range: (number | string)[] = [];
    const rangeWithDots: (number | string)[] = [];

    for (
      let i = Math.max(2, current - delta);
      i <= Math.min(total - 1, current + delta);
      i++
    ) {
      range.push(i);
    }

    if (current - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (current + delta < total - 1) {
      rangeWithDots.push('...', total);
    } else if (total > 1) {
      rangeWithDots.push(total);
    }

    return rangeWithDots;
  });

  // ===== Filter methods =====
  hasActiveFilters(): boolean {
    return !!this.statusFilter() || !!this.companyFilter() || !!this.crmFilter();
  }

  clearFilters(): void {
    this.search.set('');
    this.statusFilter.set('');
    this.companyFilter.set('');
    this.crmFilter.set('');
    this.currentPage.set(1);
  }

  // ===== Sorting methods =====
  sortBy(field: string): void {
    if (this.sortField() === field) {
      this.sortDirection.set(
        this.sortDirection() === 'asc' ? 'desc' : 'asc'
      );
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
  }

  // ===== Pagination methods =====
  goToPage(page: number | string): void {
    if (typeof page === 'number' && page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  previousPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.set(this.currentPage() - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.set(this.currentPage() + 1);
    }
  }

  onPageSizeChange(size: string): void {
    this.pageSize.set(Number(size));
    this.currentPage.set(1);
  }

  // ===== Modal methods =====
  openAddModal(): void {
    this.clientToEdit.set(null);
    this.isModalOpen.set(true);
  }

  openEditModal(client: UIClient): void {
    this.clientToEdit.set(client);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.clientToEdit.set(null);
  }

  submitForm(value: ClientFormValue): void {
    const editing = this.clientToEdit();

    if (editing) {
      // تعديل
      this.clientsService
        .updateClient(editing.id, value as UpdateClientDto)
        .subscribe({
          next: (updated) => {
            this.clients.update((list) =>
              list.map((c) => (c.id === updated.id ? updated : c))
            );
            this.closeModal();
            this.showStatus('success', 'Client updated successfully.');
          },
          error: (err) => {
            console.error('Failed to update client', err);
            this.showStatus('error', 'Failed to update client.');
          },
        });
    } else {
      // إضافة – نحط الديفولت للنوع والشركة
      const payload: CreateClientDto = {
        ...(value as CreateClientDto),
        clientType: value.clientType ?? 'Class A',
        company: (value.company as '1' | '2' | null) ?? '1',
      };

      this.clientsService.createClient(payload).subscribe({
        next: (created) => {
          this.clients.update((list) => [...list, created]);
          this.closeModal();
          this.showStatus('success', 'Client added successfully.');
        },
        error: (err) => {
          console.error('Failed to create client', err);
          this.showStatus('error', 'Failed to create client.');
        },
      });
    }
  }

  openViewModal(client: UIClient): void {
    this.viewingClient.set(client);
    this.isViewModalOpen.set(true);
  }

  closeViewModal(): void {
    this.isViewModalOpen.set(false);
    this.viewingClient.set(null);
  }

  editCurrentClient(): void {
    const client = this.viewingClient();
    if (client) {
      this.closeViewModal();
      this.openEditModal(client);
    }
  }

  // ===== Client actions =====
  deleteClient(id: number): void {
    if (!confirm('Are you sure you want to delete this client?')) return;

    this.clientsService.deleteClient(id).subscribe({
      next: () => {
        this.clients.update((list) => list.filter((c) => c.id !== id));
        this.showStatus('success', 'Client deleted successfully.');
      },
      error: (err) => {
        console.error('Failed to delete client', err);
        this.showStatus('error', 'Failed to delete client.');
      },
    });
  }

  // ===== Import Clients =====
  onClientsImport(file: File): void {
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'xlsx' || ext === 'xls') {
      this.importFromXlsx(file);
    } else {
      this.importFromCsv(file);
    }
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
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, {
          defval: null,
        });

        this.applyImportedClients(json, file.name);
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
        this.applyImportedClients(rows, file.name);
      } catch (err) {
        console.error('Failed to import CSV', err);
        this.showStatus('error', 'Failed to import CSV file.');
      }
    };
    reader.readAsText(file);
  }

  // تحويل أي فورمات تاريخ من الشيت إلى YYYY-MM-DD
  private normalizeImportedDate(value: any): string | null {
    if (value === null || value === undefined || value === '') return null;

    // Excel serial number
    if (typeof value === 'number') {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // 1899-12-30
      const date = new Date(excelEpoch.getTime() + value * 86400000);
      return date.toISOString().split('T')[0];
    }

    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }

    const str = String(value).trim();
    if (!str) return null;

    const parsed = new Date(str);
    if (Number.isNaN(parsed.getTime())) return null;

    return parsed.toISOString().split('T')[0];
  }

  private applyImportedClients(rows: any[], fileName: string): void {
    if (!rows || !rows.length) {
      this.showStatus('error', 'No data found in imported file.');
      return;
    }

    // Maps من أسماء الـ CRM و Account Managers الموجودة في الـ DB
    const crmMap = new Map<string, string>();
    this.crmUsers().forEach((u) => {
      crmMap.set(this.normalizeName(u.fullName), u.fullName);
    });

    const amMap = new Map<string, string>();
    this.operationUsers().forEach((u) => {
      amMap.set(this.normalizeName(u.fullName), u.fullName);
    });

    let unknownCrmCount = 0;
    let unknownAmCount = 0;

    const payload: ImportClientDto[] = [];

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i] || {};
      const row: any = { ...raw };

      // id لو موجود في الشيت
      let id: number | undefined;
      if (row.id !== undefined && row.id !== null && row.id !== '') {
        const num = Number(row.id);
        if (!Number.isNaN(num) && num > 0) {
          id = num;
        }
      }

      // name
      if (!row.name && row['Client Name']) {
        row.name = String(row['Client Name']);
      }
      if (!row.name) {
        // من غير name مش هنسجله
        continue;
      }

      // ===== CRM mapping =====
      let rawCrm =
        row.crm ?? row.CRM ?? row['crm'] ?? row['CRM'] ?? row['Crm'];
      if (rawCrm != null && rawCrm !== '') {
        const norm = this.normalizeName(rawCrm);
        const mapped = norm ? crmMap.get(norm) : undefined;
        if (mapped) {
          row.crm = mapped; // نخليها بنفس الاسم الرسمي من الـ DB
        } else {
          unknownCrmCount++;
          row.crm = '';
        }
      } else {
        row.crm = row.crm ?? '';
      }

      // ===== Account Manager mapping =====
      let rawAm =
        row.accountManager ??
        row['Account Manager'] ??
        row['accountManager'];
      if (rawAm != null && rawAm !== '') {
        const norm = this.normalizeName(rawAm);
        const mapped = norm ? amMap.get(norm) : undefined;
        if (mapped) {
          row.accountManager = mapped;
        } else {
          unknownAmCount++;
          row.accountManager = '';
        }
      } else {
        row.accountManager = row.accountManager ?? '';
      }

      // ===== Contract dates =====
      const contractDate = this.normalizeImportedDate(
        row.contractDate ??
          row['Contract Date'] ??
          row['contract_date']
      );

      const contractTerminationDate = this.normalizeImportedDate(
        row.contractTerminationDate ??
          row['Contract Termination Date'] ??
          row['contract_termination_date']
      );

      // ===== Status / isActive =====
      let isActive: boolean | undefined;
      const rawStatus =
        row.isActive ?? row['isActive'] ?? row.Status ?? row['Status'];
      if (rawStatus !== undefined && rawStatus !== null && rawStatus !== '') {
        const s = String(rawStatus).toLowerCase().trim();
        if (['active', '1', 'true', 'yes'].includes(s)) {
          isActive = true;
        } else if (['inactive', '0', 'false', 'no'].includes(s)) {
          isActive = false;
        }
      }

      // ===== Company =====
      let company: '1' | '2' | null = null;
      const rawCompany =
        row.company ?? row.Company ?? row['Company'];
      if (rawCompany !== undefined && rawCompany !== null && rawCompany !== '') {
        const c = String(rawCompany).toLowerCase().trim();
        if (c === '1' || c === 'company 1') company = '1';
        else if (c === '2' || c === 'company 2') company = '2';
      }
      if (!company) {
        company = '1'; // default
      }

      // ===== Client Type =====
      let clientType: string | null =
        row.clientType ??
        row['Client Type'] ??
        row['client_type'] ??
        null;
      if (!clientType || String(clientType).trim() === '') {
        clientType = 'Class A';
      }

      const clientDto: ImportClientDto = {
        id,
        name: row.name ?? '',
        crm: row.crm ?? '',
        phoneNumber: row.phoneNumber ?? '',
        pointOfContact: row.pointOfContact ?? '',
        contactEmail: row.contactEmail ?? '',
        accountManager: row.accountManager ?? '',
        contractDate,
        contractTerminationDate,
        isActive,
        company,
        clientType,
      };

      payload.push(clientDto);
    }

    if (!payload.length) {
      this.showStatus('error', 'No valid clients found in imported file.');
      return;
    }

    this.clientsService.bulkImportClients(payload).subscribe({
      next: (result: BulkImportResult) => {
        this.loadClients();

        let message = `Imported ${payload.length} clients from ${fileName}.`;
        const details: string[] = [
          `Created: ${result.createdCount}, Updated: ${result.updatedCount}, Skipped: ${result.skippedCount}.`,
        ];

        if (unknownCrmCount) {
          details.push(`${unknownCrmCount} rows had unknown CRM.`);
        }
        if (unknownAmCount) {
          details.push(
            `${unknownAmCount} rows had unknown Account Manager.`
          );
        }

        message += ' ' + details.join(' ');
        this.showStatus('success', message);
      },
      error: (err) => {
        console.error('Failed to import clients to server', err);
        this.showStatus('error', 'Failed to import clients to server.');
      },
    });
  }

  private normalizeName(value: any): string {
    if (value === null || value === undefined) return '';
    return String(value).trim().toLowerCase();
  }

  // ===== أدوات CSV بسيطة =====
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
      headers.forEach((h, idx) => {
        row[h] = cols[idx] ?? '';
      });
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

  // ===== الـ Status Message =====
  showStatus(type: StatusType, message: string): void {
    this.status = { type, message };

    setTimeout(() => {
      if (
        this.status &&
        this.status.type === type &&
        this.status.message === message
      ) {
        this.status = null;
      }
    }, 3000);
  }

  clearStatus(): void {
    this.status = null;
  }

  // ===== Utility methods =====
  trackById(_index: number, item: UIClient): number {
    return item.id;
  }

  hasInactiveClients(): boolean {
    return this.filtered().some((client) => !client.isActive);
  }

  getColspan(): number {
    let baseCols = 6; // Name, Status, Contract Date, Phone, CRM, Account Manager
    if (this.hasInactiveClients()) baseCols++; // Termination Date
    baseCols++; // Actions
    return baseCols;
  }

  formatDate(dateString: string | null | undefined): string {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '-';
    }
  }
}
