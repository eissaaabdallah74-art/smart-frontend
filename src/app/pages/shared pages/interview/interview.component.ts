import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import * as XLSX from 'xlsx';
import { forkJoin } from 'rxjs';

import { ExportButtonComponent } from '../../../shared/export-button/export-button';
import { ImportButtonComponent } from '../../../shared/import-button/import-button.component';
import { InterviewFormModalComponent } from './components/interview-form-modal/interview-form-modal.component';

import {
  ApiInterview,
  CreateInterviewDto,
  UpdateInterviewDto,
  InterviewsServiceService,
} from '../../../services/interviews/interviews-service.service';

import { ApiClient, ClientsServiceService } from '../../../services/clients/clients-service.service';
import { ApiUser, UsersServiceService } from '../../../services/users/users-service.service';

import { ApiDriver, DriversServiceService } from '../../../services/drivers/drivers-service.service';

export interface InterviewRow {
  _id: number; // UI-only
  id?: number;

  date: string;
  ticketNo: string;

  courierName: string;
  phoneNumber: string;

  nationalId: string;
  residence: string;

  // display fields
  account: string;
  hub: string;
  zone: string;
  position: string;
  vehicleType: string;

  accountManager: string;
  interviewer: string;

  signedWithHr: string;
  feedback: string;
  hrFeedback: string;
  crmFeedback: string;
  followUp1: string;
  followUp2: string;
  followUp3: string;

  courierStatus: string;
  notes: string;

  // ids for edit/import/export
  clientId?: number | null;
  hubId?: number | null;
  zoneId?: number | null;

  accountManagerId?: number | null;
  interviewerId?: number | null;

  securityResult?: string | null;
}

const MOCK_INTERVIEWS: InterviewRow[] = [];

@Component({
  selector: 'app-interview',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ExportButtonComponent,
    ImportButtonComponent,
    InterviewFormModalComponent,
  ],
  templateUrl: './interview.component.html',
  styleUrls: ['./interview.component.scss'],
})
export class InterviewComponent implements OnInit {
  private _nextId = 1;

  private interviewsService = inject(InterviewsServiceService);
  private clientsService = inject(ClientsServiceService);
  private usersService = inject(UsersServiceService);
  private driversService = inject(DriversServiceService);
  private router = inject(Router);

  readonly interviews = signal<InterviewRow[]>([]);

  // search + filters
  readonly search = signal<string>('');
  readonly accountFilter = signal<string>('');
  readonly statusFilter = signal<string>('');
  readonly signedWithHrFilter = signal<string>('');

  // pagination
  readonly pageSize = signal<number>(10);
  readonly currentPage = signal<number>(1);

  readonly isModalOpen = signal<boolean>(false);
  readonly interviewToEdit = signal<InterviewRow | null>(null);

  // dropdown sources
  readonly clients = signal<ApiClient[]>([]);
  readonly operationUsers = signal<ApiUser[]>([]);

  readonly accounts = computed<string[]>(() =>
    this.clients()
      .map((c) => c.name)
      .filter((n) => !!n && n.trim() !== '')
      .sort((a, b) => a.localeCompare(b)),
  );

  readonly operationNames = computed<string[]>(() =>
    this.operationUsers()
      .map((u) => u.fullName)
      .filter((n) => !!n)
      .sort((a, b) => a.localeCompare(b)),
  );

  readonly statusOptions: string[] = ['Active', 'Unreachable/Reschedule', 'Resigned', 'Hold zone'];

  ngOnInit(): void {
    this.loadClients();
    this.loadUsers();
    this.loadInterviews();
  }

  /* ========= Load from API ========= */

  private loadInterviews(): void {
    this.interviewsService.getInterviews().subscribe({
      next: (list: ApiInterview[]) => {
        const mapped = (list || []).map((row, index) => this.mapApiToRow(row, index + 1));
        this.interviews.set(mapped);

        this._nextId = mapped.length ? Math.max(...mapped.map((r) => r._id)) + 1 : 1;
        this.currentPage.set(1);
      },
      error: (err: unknown) => {
        console.error('Failed to load interviews, falling back to mock data', err);
        if (!this.interviews().length) {
          this.interviews.set([...MOCK_INTERVIEWS]);
          this._nextId = MOCK_INTERVIEWS.length + 1;
        }
      },
    });
  }

  private loadClients(): void {
    this.clientsService.getClients().subscribe({
      next: (list: ApiClient[]) => this.clients.set(list || []),
      error: (err: unknown) => console.error('Failed to load clients', err),
    });
  }

  private loadUsers(): void {
    this.usersService.getUsers({ role: 'operation', active: true }).subscribe({
      next: (list: ApiUser[]) => this.operationUsers.set(list || []),
      error: (err: unknown) => console.error('Failed to load operation users', err),
    });
  }

  private mapApiToRow(api: ApiInterview, uiId: number): InterviewRow {
    return {
      _id: uiId,
      id: api.id,

      date: api.date ?? '',
      ticketNo: api.ticketNo ?? '',

      courierName: api.courierName ?? '',
      phoneNumber: api.phoneNumber ?? '',

      nationalId: api.nationalId ?? '',
      residence: api.residence ?? '',

      account: api.client?.name ?? '',
      hub: api.hub?.name ?? '',
      zone: api.zone?.name ?? '',
      position: api.position ?? '',
      vehicleType: api.vehicleType ?? '',

      accountManager: api.accountManager?.fullName ?? '',
      interviewer: api.interviewer?.fullName ?? '',

      signedWithHr: api.signedWithHr ?? '',

      feedback: api.feedback ?? '',
      hrFeedback: api.hrFeedback ?? '',
      crmFeedback: api.crmFeedback ?? '',
      followUp1: api.followUp1 ?? '',
      followUp2: api.followUp2 ?? '',
      followUp3: api.followUp3 ?? '',
      courierStatus: api.courierStatus ?? '',
      notes: api.notes ?? '',

      clientId: (api as any).clientId ?? api.client?.id ?? null,
      hubId: api.hubId ?? null,
      zoneId: api.zoneId ?? null,
      accountManagerId: (api as any).accountManagerId ?? api.accountManager?.id ?? null,
      interviewerId: (api as any).interviewerId ?? api.interviewer?.id ?? null,

      securityResult: api.securityResult ?? null,
    };
  }

  /* ========= Search + Filters ========= */

  onSearchChange(value: string): void {
    this.search.set(value);
    this.currentPage.set(1);
  }

  onAccountFilterChange(value: string): void {
    this.accountFilter.set(value);
    this.currentPage.set(1);
  }

  onStatusFilterChange(value: string): void {
    this.statusFilter.set(value);
    this.currentPage.set(1);
  }

  onSignedWithHrFilterChange(value: string): void {
    this.signedWithHrFilter.set(value);
    this.currentPage.set(1);
  }

  hasActiveFilters(): boolean {
    return !!this.search().trim() || !!this.accountFilter() || !!this.statusFilter() || !!this.signedWithHrFilter();
  }

  clearFilters(): void {
    this.search.set('');
    this.accountFilter.set('');
    this.statusFilter.set('');
    this.signedWithHrFilter.set('');
    this.currentPage.set(1);
  }

  readonly filtered = computed<InterviewRow[]>(() => {
    const term = this.search().toLowerCase().trim();
    const accountFilter = this.accountFilter();
    const statusFilter = this.statusFilter();
    const hrFilter = this.signedWithHrFilter();

    let rows = this.interviews();

    if (term) {
      rows = rows.filter((row) => {
        const safe = (v: any) => String(v ?? '').toLowerCase();
        return (
          safe(row.courierName).includes(term) ||
          safe(row.phoneNumber).includes(term) ||
          safe(row.nationalId).includes(term) ||
          safe(row.residence).includes(term) ||
          safe(row.account).includes(term) ||
          safe(row.hub).includes(term) ||
          safe(row.zone).includes(term) ||
          safe(row.accountManager).includes(term) ||
          safe(row.courierStatus).includes(term)
        );
      });
    }

    if (accountFilter) rows = rows.filter((row) => row.account === accountFilter);
    if (statusFilter) rows = rows.filter((row) => row.courierStatus === statusFilter);

    if (hrFilter) {
      rows = rows.filter((row) => {
        const s = (row.signedWithHr || '').toLowerCase().trim();
        if (hrFilter === 'signed') return s.startsWith('signed');
        if (hrFilter === 'not_signed') return !s;
        if (hrFilter === 'other') return !!s && !s.startsWith('signed');
        return true;
      });
    }

    return rows;
  });

  /* ========= Pagination ========= */

  readonly totalPages = computed(() => (this.filtered().length ? Math.ceil(this.filtered().length / this.pageSize()) : 1));

  readonly startIndex = computed(() => (this.currentPage() - 1) * this.pageSize());

  readonly endIndex = computed(() => Math.min(this.startIndex() + this.pageSize(), this.filtered().length));

  readonly paginated = computed<InterviewRow[]>(() => this.filtered().slice(this.startIndex(), this.endIndex()));

  readonly visiblePages = computed<(number | string)[]>(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const delta = 2;
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];

    for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
      range.push(i);
    }

    rangeWithDots.push(1);

    if (current - delta > 2) rangeWithDots.push('...');
    rangeWithDots.push(...range);
    if (current + delta < total - 1) rangeWithDots.push('...');

    if (total > 1) rangeWithDots.push(total);
    return rangeWithDots;
  });

  goToPage(page: number | string): void {
    if (typeof page !== 'number') return;
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
  }

  previousPage(): void {
    if (this.currentPage() > 1) this.currentPage.set(this.currentPage() - 1);
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) this.currentPage.set(this.currentPage() + 1);
  }

  onPageSizeChange(size: string): void {
    const num = Number(size) || 10;
    this.pageSize.set(num);
    this.currentPage.set(1);
  }

  /* ========= Status UI helpers ========= */

  getSignedWithHrLabel(row: InterviewRow): string {
    const raw = (row.signedWithHr || '').trim();
    if (!raw) return 'Not signed';
    const lower = raw.toLowerCase();
    if (lower.startsWith('signed')) return 'Signed with HR';
    return raw;
  }

  getSignedWithHrClass(row: InterviewRow): string {
    const raw = (row.signedWithHr || '').toLowerCase().trim();
    if (!raw) return 'status-chip--neutral';
    if (raw.startsWith('signed')) return 'status-chip--positive';
    if (raw.includes('unqualified') || raw.includes('reject')) return 'status-chip--danger';
    if (raw.includes('missing') || raw.includes('think')) return 'status-chip--warning';
    return 'status-chip--neutral';
  }

  getCourierStatusLabel(row: InterviewRow): string {
    const raw = (row.courierStatus || '').trim();
    return raw || 'PENDING';
  }

  getCourierStatusClass(row: InterviewRow): string {
    const v = this.getCourierStatusLabel(row).toLowerCase();

    if (v === 'active') return 'status--active';
    if (v === 'unreachable/reschedule' || v === 'unreachable' || v.includes('reschedule')) {
      return 'status--unreachable-reschedule';
    }
    if (v === 'resigned') return 'status--resigned';
    if (v === 'hold zone' || v === 'hold' || v.includes('hold')) return 'status--hold-zone';
    if (v === 'pending') return 'status--pending';

    return 'status--unknown';
  }

  /* ========= Export Data ========= */

  readonly exportData = computed<any[]>(() =>
    this.filtered().map((r) => ({
      date: r.date,
      ticketNo: r.ticketNo,
      courierName: r.courierName,
      phoneNumber: r.phoneNumber,
      nationalId: r.nationalId,
      residence: r.residence,
      account: r.account,

      clientId: r.clientId ?? '',
      hub: r.hub,
      hub_id: r.hubId ?? '',
      zone: r.zone,
      zone_id: r.zoneId ?? '',

      position: r.position,
      vehicleType: r.vehicleType,

      accountManager: r.accountManager,
      accountManagerId: r.accountManagerId ?? '',

      interviewer: r.interviewer,
      interviewerId: r.interviewerId ?? '',

      signedWithHr: r.signedWithHr,
      hrFeedback: r.hrFeedback,
      security_result: r.securityResult ?? '',
      crmFeedback: r.crmFeedback,

      followUp1: r.followUp1,
      followUp2: r.followUp2,
      followUp3: r.followUp3,

      courierStatus: r.courierStatus,
      notes: r.notes,
    })),
  );

  /* ========= Actions ========= */

  openAddModal(): void {
    this.interviewToEdit.set(null);
    this.isModalOpen.set(true);
  }

  openEditModal(row: InterviewRow): void {
    this.interviewToEdit.set(row);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.interviewToEdit.set(null);
  }

  onFormSubmit(dto: CreateInterviewDto): void {
    const editing = this.interviewToEdit();

    if (editing && editing.id != null) {
      this.interviewsService.updateInterview(editing.id, dto as UpdateInterviewDto).subscribe({
        next: (updated: ApiInterview) => {
          this.interviews.update((list) =>
            list.map((r) => (r._id === editing._id ? this.mapApiToRow(updated, editing._id) : r)),
          );

          this.syncDriverFromInterview(updated);
          this.closeModal();
        },
        error: (err: unknown) => console.error('Failed to update interview', err),
      });
    } else {
      this.interviewsService.createInterview(dto).subscribe({
        next: (created: ApiInterview) => {
          const newRow = this.mapApiToRow(created, this._nextId++);
          this.interviews.update((list) => [...list, newRow]);

          this.syncDriverFromInterview(created);
          this.closeModal();
        },
        error: (err: unknown) => console.error('Failed to create interview', err),
      });
    }
  }

  deleteInterview(id: number | undefined): void {
    if (id == null) {
      console.warn('deleteInterview called without backend id');
      return;
    }

    const ok = window.confirm(`Delete interview #${id}?`);
    if (!ok) return;

    this.interviewsService.deleteInterview(id).subscribe({
      next: () => this.interviews.update((list) => list.filter((r) => r.id !== id)),
      error: (err: unknown) => console.error('Failed to delete interview', err),
    });
  }

  trackById(_index: number, row: InterviewRow): number {
    return row.id ?? row._id;
  }

  openDetails(row: InterviewRow): void {
    if (row.id != null) this.router.navigate(['/interviews', row.id]);
  }

  /* ========= Import (CSV/XLSX) ========= */

  onInterviewsImport(file: File | null | undefined): void {
    if (!file) return;

    const name = (file.name || '').toLowerCase();
    if (name.endsWith('.csv')) {
      this.importFromCsv(file);
      return;
    }

    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      this.importFromXlsx(file);
      return;
    }

    console.warn('Unsupported file type for import:', file.name);
  }

  private importFromCsv(file: File): void {
    const reader = new FileReader();

    reader.onload = () => {
      const text = String(reader.result || '');
      if (!text.trim()) return;

      const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
      if (lines.length < 2) return;

      const headers = this.parseCsvLine(lines[0]).map((h) => h.trim());
      const data = lines.slice(1).map((ln) => this.parseCsvLine(ln).map((c) => c.trim()));

      this.importFromTable(headers, data);
    };

    reader.readAsText(file);
  }

  private importFromXlsx(file: File): void {
    const reader = new FileReader();

    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer;
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheetName = wb.SheetNames?.[0];
      if (!sheetName) return;

      const ws = wb.Sheets[sheetName];
      const table = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
      if (!table.length || table.length < 2) return;

      const headers = (table[0] || []).map((x) => String(x ?? '').trim());
      const data = table.slice(1).map((row) => (row || []).map((x) => String(x ?? '').trim()));

      this.importFromTable(headers, data);
    };

    reader.readAsArrayBuffer(file);
  }

  private importFromTable(headers: string[], rows: string[][]): void {
    const dtos = this.buildDtosFromTable(headers, rows);
    if (!dtos.length) return;

    const requests = dtos.map((dto) => this.interviewsService.createInterview(dto));
    forkJoin(requests).subscribe({
      next: (createdList: ApiInterview[]) => {
        const mapped = createdList.map((api) => this.mapApiToRow(api, this._nextId++));
        this.interviews.update((current) => [...current, ...mapped]);
        createdList.forEach((api) => this.syncDriverFromInterview(api));
        console.log(`Imported ${createdList.length} interviews successfully`);
      },
      error: (err) => console.error('Failed to import interviews', err),
    });
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

  private normalizeHeader(name: string): string {
    return String(name || '').toLowerCase().replace(/[\s_]+/g, '');
  }

  private findHeaderIndex(headers: string[], ...candidates: string[]): number {
    const normalized = headers.map((h) => this.normalizeHeader(h));
    for (const c of candidates) {
      const needle = this.normalizeHeader(c);
      const idx = normalized.indexOf(needle);
      if (idx !== -1) return idx;
    }
    return -1;
  }

  // Handles strings + dd/mm/yyyy + Excel serial-ish numeric strings
  private normalizeDateCell(raw: any): string {
    const todayIso = new Date().toISOString().slice(0, 10); // yyyy-mm-dd
    if (raw == null) return todayIso;

    const asString = String(raw).trim();
    if (!asString) return todayIso;

    // ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(asString)) return asString;

    // dd/mm/yyyy or dd-mm-yyyy
    const m = asString.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      let d = parseInt(m[1], 10);
      let mn = parseInt(m[2], 10);
      let y = parseInt(m[3], 10);
      if (y < 100) y += 2000;

      const pad = (n: number) => String(n).padStart(2, '0');
      return `${y}-${pad(mn)}-${pad(d)}`;
    }

    // Excel serial date stored as number or numeric string
    const n = Number(asString);
    if (Number.isFinite(n) && n > 20000 && n < 80000) {
      const epoch = Date.UTC(1899, 11, 30); // Excel epoch
      const dt = new Date(epoch + n * 86400000);
      if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
    }

    // Last try
    const asDate = new Date(asString);
    if (!isNaN(asDate.getTime())) return asDate.toISOString().slice(0, 10);

    return todayIso;
  }

  private buildDtosFromTable(headers: string[], dataRows: string[][]): CreateInterviewDto[] {
    const dtos: CreateInterviewDto[] = [];

    const idxDate = this.findHeaderIndex(headers, 'date');
    const idxCourierName = this.findHeaderIndex(headers, 'courierName', 'courier', 'courier_name');
    const idxPhone = this.findHeaderIndex(headers, 'phoneNumber', 'phone', 'phone_number', 'mobile');
    const idxNationalId = this.findHeaderIndex(headers, 'nationalId', 'national_id', 'nid');
    const idxResidence = this.findHeaderIndex(headers, 'residence', 'area', 'city');

    // account/client can be either name or numeric id
    const idxAccount = this.findHeaderIndex(headers, 'account', 'client', 'clientName', 'clientId', 'client_id');

    const idxHubId = this.findHeaderIndex(headers, 'hub_id', 'hubId');
    const idxZoneId = this.findHeaderIndex(headers, 'zone_id', 'zoneId');

    const idxPosition = this.findHeaderIndex(headers, 'position');
    const idxVehicle = this.findHeaderIndex(headers, 'vehicleType', 'vehicle');

    const idxAccountManager = this.findHeaderIndex(headers, 'accountManager', 'account_manager');
    const idxInterviewer = this.findHeaderIndex(headers, 'interviewer', 'interviewerName');

    const idxSignedWithHr = this.findHeaderIndex(headers, 'signedWithHr', 'hrContract');
    const idxStatus = this.findHeaderIndex(headers, 'courierStatus', 'status');
    const idxHrFeedback = this.findHeaderIndex(headers, 'hrFeedback', 'hr_feedback');

    const idxSecurityResult = this.findHeaderIndex(headers, 'security_result', 'securityResult');

    for (let i = 0; i < dataRows.length; i++) {
      const cols = dataRows[i] || [];
      const courierName = idxCourierName >= 0 ? (cols[idxCourierName] || '').trim() : '';
      const phoneNumber = idxPhone >= 0 ? (cols[idxPhone] || '').trim() : '';

      if (!courierName && !phoneNumber) continue;

      // clientId from account cell (id or name)
      const accCell = idxAccount >= 0 ? (cols[idxAccount] || '').trim() : '';
      let clientId: number | null = null;

      if (accCell) {
        const maybeId = Number(accCell);
        if (Number.isFinite(maybeId) && maybeId > 0) {
          clientId = maybeId;
        } else {
          const client = this.clients().find((c) => (c.name || '').trim() === accCell);
          if (client) clientId = client.id;
        }
      }

      if (!clientId) {
        console.warn('Skipping row: no client matched for account', accCell);
        continue;
      }

      let hubId: number | null = null;
      let zoneId: number | null = null;

      if (idxHubId >= 0 && cols[idxHubId]) {
        const hn = Number(cols[idxHubId]);
        hubId = Number.isFinite(hn) ? hn : null;
      }

      if (idxZoneId >= 0 && cols[idxZoneId]) {
        const zn = Number(cols[idxZoneId]);
        zoneId = Number.isFinite(zn) ? zn : null;
      }

      const accountManagerName = idxAccountManager >= 0 ? (cols[idxAccountManager] || '').trim() : '';
      const accountManagerUser = accountManagerName
        ? this.operationUsers().find((u) => (u.fullName || '').trim() === accountManagerName)
        : undefined;

      const interviewerName = idxInterviewer >= 0 ? (cols[idxInterviewer] || '').trim() : '';
      const interviewerUser = interviewerName
        ? this.operationUsers().find((u) => (u.fullName || '').trim() === interviewerName)
        : undefined;

      let securityResultVal: 'Positive' | 'Negative' | null = null;
      if (idxSecurityResult >= 0 && cols[idxSecurityResult]) {
        const raw = String(cols[idxSecurityResult] || '').toLowerCase().trim();
        if (raw.startsWith('pos')) securityResultVal = 'Positive';
        else if (raw.startsWith('neg')) securityResultVal = 'Negative';
      }

      const dto: CreateInterviewDto = {
        date: this.normalizeDateCell(idxDate >= 0 ? cols[idxDate] : null),

        courierName,
        phoneNumber,

        nationalId: idxNationalId >= 0 && cols[idxNationalId] ? cols[idxNationalId] : null,
        residence: idxResidence >= 0 && cols[idxResidence] ? cols[idxResidence] : null,

        clientId,

        hubId,
        zoneId,

        position: idxPosition >= 0 && cols[idxPosition] ? cols[idxPosition] : null,
        vehicleType: idxVehicle >= 0 && cols[idxVehicle] ? cols[idxVehicle] : null,

        accountManagerId: accountManagerUser?.id ?? null,
        interviewerId: interviewerUser?.id ?? null,

        signedWithHr: idxSignedWithHr >= 0 && cols[idxSignedWithHr] ? cols[idxSignedWithHr] : null,

        feedback: null,
        hrFeedback: idxHrFeedback >= 0 && cols[idxHrFeedback] ? cols[idxHrFeedback] : null,
        crmFeedback: null,
        followUp1: null,
        followUp2: null,
        followUp3: null,

        courierStatus: idxStatus >= 0 && cols[idxStatus] ? cols[idxStatus] : null,
        securityResult: securityResultVal,
        notes: null,

        ticketNo: undefined,
        ticketExpiresAt: undefined,
      };

      dtos.push(dto);
    }

    return dtos;
  }

  /* ========= Sync Interview → Driver (Active only) ========= */

  private syncDriverFromInterview(api: ApiInterview): void {
    const status = (api.courierStatus || '').toLowerCase().trim();
    if (!status.startsWith('active')) return;

    const payload: Partial<ApiDriver> = {
      name: api.courierName ?? '',
      courierPhone: api.phoneNumber ?? '',
      clientName: api.client?.name ?? '',
      area: api.residence || api.zone?.name || api.hub?.name || '',
      hiringStatus: api.courierStatus ?? 'Active',
      contractStatus: api.signedWithHr ?? undefined,
    };

    if (!payload.name && !payload.courierPhone) return;

    this.driversService.bulkUpsertDrivers([payload]).subscribe({
      next: () => console.log('Synced interview %s to drivers as Active', api.id),
      error: (err) => console.error('Failed to sync driver from interview', err),
    });
  }
}
