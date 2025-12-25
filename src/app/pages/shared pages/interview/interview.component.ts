// src/app/pages/.../interview/interview.component.ts
import {
  Component,
  OnInit,
  computed,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ExportButtonComponent } from '../../../shared/export-button/export-button';
import { ImportButtonComponent } from '../../../shared/import-button/import-button.component';

import { InterviewFormModalComponent } from './components/interview-form-modal/interview-form-modal.component';

import {
  ApiInterview,
  CreateInterviewDto,
  UpdateInterviewDto,
  InterviewsServiceService,
} from '../../../services/interviews/interviews-service.service';

import {
  ClientsServiceService,
  ApiClient,
} from '../../../services/clients/clients-service.service';

import {
  UsersServiceService,
  ApiUser,
} from '../../../services/users/users-service.service';

// Drivers sync
import {
  DriversServiceService,
  ApiDriver,
} from '../../../services/drivers/drivers-service.service';

import { forkJoin } from 'rxjs';

export interface InterviewRow {
  _id: number; // UI only
  id?: number;

  date: string;
  ticketNo: string;
  courierName: string;
  phoneNumber: string;
  nationalId: string;

  residence: string;

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

  // حقول إضافية علشان الـ import/export
  hubId?: number | null;
  zoneId?: number | null;
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

  // services
  private interviewsService = inject(InterviewsServiceService);
  private clientsService = inject(ClientsServiceService);
  private usersService = inject(UsersServiceService);
  private driversService = inject(DriversServiceService);
  private router = inject(Router);

  // data
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
      .sort((a, b) => a.localeCompare(b)),
  );

  readonly statusOptions: string[] = [
    'Active',
    'Unreachable/Reschedule',
    'Resigned',
    'Hold zone',
  ];

  constructor() {}

  ngOnInit(): void {
    this.loadInterviews();
    this.loadClients();
    this.loadUsers();
  }

  /* ========= Load from API ========= */

  private loadInterviews(): void {
    this.interviewsService.getInterviews().subscribe({
      next: (list: ApiInterview[]) => {
        const mapped = list.map((row, index) =>
          this.mapApiToRow(row, index + 1),
        );
        this.interviews.set(mapped);
        this._nextId = mapped.length
          ? Math.max(...mapped.map((r) => r._id)) + 1
          : 1;
        this.currentPage.set(1);
      },
      error: (err: unknown) => {
        console.error(
          'Failed to load interviews, falling back to mock data',
          err,
        );
        if (!this.interviews().length) {
          this.interviews.set([...MOCK_INTERVIEWS]);
          this._nextId = MOCK_INTERVIEWS.length + 1;
        }
      },
    });
  }

  private loadClients(): void {
    this.clientsService.getClients().subscribe({
      next: (list: ApiClient[]) => this.clients.set(list),
      error: (err: unknown) => console.error('Failed to load clients', err),
    });
  }

  private loadUsers(): void {
    this.usersService.getUsers({ role: 'operation', active: true }).subscribe({
      next: (list: ApiUser[]) => this.operationUsers.set(list),
      error: (err: unknown) =>
        console.error('Failed to load operation users', err),
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

      hubId: api.hubId ?? null,
      zoneId: api.zoneId ?? null,
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
    return (
      !!this.search().trim() ||
      !!this.accountFilter() ||
      !!this.statusFilter() ||
      !!this.signedWithHrFilter()
    );
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
        return (
          row.courierName.toLowerCase().includes(term) ||
          row.phoneNumber.toLowerCase().includes(term) ||
          row.nationalId.toLowerCase().includes(term) ||
          row.residence.toLowerCase().includes(term) ||
          row.account.toLowerCase().includes(term) ||
          row.hub.toLowerCase().includes(term) ||
          row.zone.toLowerCase().includes(term) ||
          row.accountManager.toLowerCase().includes(term) ||
          row.courierStatus.toLowerCase().includes(term)
        );
      });
    }

    if (accountFilter) {
      rows = rows.filter((row) => row.account === accountFilter);
    }

    if (statusFilter) {
      rows = rows.filter((row) => row.courierStatus === statusFilter);
    }

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

  readonly totalPages = computed(() =>
    this.filtered().length
      ? Math.ceil(this.filtered().length / this.pageSize())
      : 1,
  );

  readonly startIndex = computed(
    () => (this.currentPage() - 1) * this.pageSize(),
  );

  readonly endIndex = computed(() =>
    Math.min(this.startIndex() + this.pageSize(), this.filtered().length),
  );

  readonly paginated = computed<InterviewRow[]>(() =>
    this.filtered().slice(this.startIndex(), this.endIndex()),
  );

  readonly visiblePages = computed<(number | string)[]>(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const delta = 2;
    const range: number[] = [];
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

  goToPage(page: number | string): void {
    if (typeof page !== 'number') return;
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
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
    const num = Number(size) || 10;
    this.pageSize.set(num);
    this.currentPage.set(1);
  }

  getSignedWithHrLabel(row: InterviewRow): string {
    const raw = (row.signedWithHr || '').trim();
    if (!raw) return 'Not signed';

    const lower = raw.toLowerCase();
    if (lower.startsWith('signed ')) return 'Signed with HR';
    return raw;
  }

  getSignedWithHrClass(row: InterviewRow): string {
    const raw = (row.signedWithHr || '').toLowerCase().trim();

    if (!raw) return 'status-chip--neutral';
    if (raw.startsWith('signed')) return 'status-chip--positive';
    if (raw.includes('unqualified') || raw.includes('reject')) {
      return 'status-chip--danger';
    }
    if (raw.includes('missing') || raw.includes('think')) {
      return 'status-chip--warning';
    }

    return 'status-chip--neutral';
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
      hub: r.hub,
      hub_id: r.hubId ?? '',
      zone: r.zone,
      zone_id: r.zoneId ?? '',
      position: r.position,
      vehicleType: r.vehicleType,
      accountManager: r.accountManager,
      interviewer: r.interviewer,
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
      this.interviewsService
        .updateInterview(editing.id, dto as UpdateInterviewDto)
        .subscribe({
          next: (updated: ApiInterview) => {
            this.interviews.update((list) =>
              list.map((r) =>
                r._id === editing._id
                  ? this.mapApiToRow(updated, editing._id)
                  : r,
              ),
            );

            this.syncDriverFromInterview(updated);
            this.closeModal();
          },
          error: (err: unknown) => {
            console.error('Failed to update interview', err);
          },
        });
    } else {
      this.interviewsService.createInterview(dto).subscribe({
        next: (created: ApiInterview) => {
          const newRow = this.mapApiToRow(created, this._nextId++);
          this.interviews.update((list) => [...list, newRow]);

          this.syncDriverFromInterview(created);
          this.closeModal();
        },
        error: (err: unknown) => {
          console.error('Failed to create interview', err);
        },
      });
    }
  }

  deleteInterview(id: number | undefined): void {
    if (id == null) {
      console.warn('deleteInterview called without backend id');
      return;
    }

    this.interviewsService.deleteInterview(id).subscribe({
      next: () => {
        this.interviews.update((list) => list.filter((r) => r.id !== id));
      },
      error: (err: unknown) => {
        console.error('Failed to delete interview', err);
      },
    });
  }

  trackById(_index: number, row: InterviewRow): number {
    return row.id ?? row._id;
  }

  openDetails(row: InterviewRow): void {
    if (row.id != null) {
      this.router.navigate(['/interviews', row.id]);
    } else {
      console.warn('openDetails called without backend id');
    }
  }

  /* ========= Import Logic ========= */

  onInterviewsImport(file: File | null | undefined): void {
    if (!file) {
      console.warn('onInterviewsImport: no file provided');
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const text = String(reader.result || '');
      if (!text.trim()) {
        console.warn('onInterviewsImport: empty file content');
        return;
      }

      const dtos = this.buildDtosFromCsv(text);

      if (!dtos.length) {
        console.warn('onInterviewsImport: no valid rows parsed from CSV');
        return;
      }

      const requests = dtos.map((dto) =>
        this.interviewsService.createInterview(dto),
      );

      forkJoin(requests).subscribe({
        next: (createdList: ApiInterview[]) => {
          const mapped = createdList.map((api) =>
            this.mapApiToRow(api, this._nextId++),
          );

          this.interviews.update((current) => [...current, ...mapped]);

          createdList.forEach((api) => this.syncDriverFromInterview(api));

          console.log(
            `Imported ${createdList.length} interviews from CSV successfully`,
          );
        },
        error: (err) => {
          console.error('Failed to import interviews from CSV', err);
        },
      });
    };

    reader.onerror = (err) => {
      console.error('FileReader error while importing interviews CSV', err);
    };

    reader.readAsText(file);
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
    return name.toLowerCase().replace(/[\s_]+/g, '');
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

  // معالجة الـ date علشان ما تروحش 0000-00-00 في MySQL
  private normalizeDateCell(raw: string | null | undefined): string {
    const todayIso = new Date().toISOString().slice(0, 10); // yyyy-mm-dd

    if (!raw) return todayIso;
    const v = raw.trim();
    if (!v) return todayIso;

    // جاهز أصلاً
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      return v;
    }

    // فورمات زى 29/11/2025 أو 29-11-2025
    const m = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      let d = parseInt(m[1], 10);
      let mn = parseInt(m[2], 10);
      let y = parseInt(m[3], 10);
      if (y < 100) y += 2000;
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${y}-${pad(mn)}-${pad(d)}`;
    }

    // آخر محاولة: Date(v)
    const asDate = new Date(v);
    if (!isNaN(asDate.getTime())) {
      return asDate.toISOString().slice(0, 10);
    }

    return todayIso;
  }

  private buildDtosFromCsv(csv: string): CreateInterviewDto[] {
    const lines = csv.split(/\r?\n/).filter((l) => l.trim().length);
    if (lines.length < 2) return [];

    const headerCells = this.parseCsvLine(lines[0]).map((h) => h.trim());
    const dtos: CreateInterviewDto[] = [];

    const idxDate = this.findHeaderIndex(headerCells, 'date');
    const idxCourierName = this.findHeaderIndex(
      headerCells,
      'courierName',
      'courier',
      'courier_name',
    );
    const idxPhone = this.findHeaderIndex(
      headerCells,
      'phoneNumber',
      'phone',
      'phone_number',
      'mobile',
    );
    const idxResidence = this.findHeaderIndex(
      headerCells,
      'residence',
      'area',
      'city',
    );
    const idxAccount = this.findHeaderIndex(
      headerCells,
      'account',
      'client',
      'clientName',
    );
    const idxHubName = this.findHeaderIndex(headerCells, 'hub');
    const idxZoneName = this.findHeaderIndex(headerCells, 'zone');

    const idxHubId = this.findHeaderIndex(headerCells, 'hub_id', 'hubId');
    const idxZoneId = this.findHeaderIndex(headerCells, 'zone_id', 'zoneId');

    const idxPosition = this.findHeaderIndex(headerCells, 'position');

    const idxVehicle = this.findHeaderIndex(
      headerCells,
      'vehicleType',
      'vehicle',
    );

    const idxAccountManager = this.findHeaderIndex(
      headerCells,
      'accountManager',
      'account_manager',
    );
    const idxInterviewer = this.findHeaderIndex(
      headerCells,
      'interviewer',
      'interviewerName',
    );

    const idxSignedWithHr = this.findHeaderIndex(
      headerCells,
      'signedWithHr',
      'hrContract',
    );
    const idxStatus = this.findHeaderIndex(
      headerCells,
      'courierStatus',
      'status',
    );
    const idxNationalId = this.findHeaderIndex(
      headerCells,
      'nationalId',
      'national_id',
    );
    const idxHrFeedback = this.findHeaderIndex(
      headerCells,
      'hrFeedback',
      'hr_feedback',
    );
    const idxSecurityResult = this.findHeaderIndex(
      headerCells,
      'security_result',
      'securityResult',
    );

    for (let i = 1; i < lines.length; i++) {
      const rowLine = lines[i];
      const cols = this.parseCsvLine(rowLine).map((c) => c.trim());

      if (!cols.length || cols.every((c) => !c)) continue;

      const courierName =
        idxCourierName >= 0 ? cols[idxCourierName] || '' : '';
      const phoneNumber = idxPhone >= 0 ? cols[idxPhone] || '' : '';

      if (!courierName && !phoneNumber) {
        console.warn('Skipping row without courierName/phoneNumber', rowLine);
        continue;
      }

      // clientId من اسم الـ Account
      const accountName =
        idxAccount >= 0 ? cols[idxAccount] || '' : '';
      let clientId: number | null = null;
      if (accountName) {
        const client = this.clients().find(
          (c) => (c.name || '').trim() === accountName.trim(),
        );
        if (client) clientId = client.id;
      }

      if (!clientId) {
        console.warn(
          'Skipping row: no client matched for account',
          accountName,
        );
        continue;
      }

      // Hub/Zone IDs لو موجودة hub_id / zone_id في الشيت
      let hubId: number | null = null;
      let zoneId: number | null = null;

      if (idxHubId >= 0 && cols[idxHubId]) {
        const n = Number(cols[idxHubId]);
        hubId = Number.isFinite(n) ? n : null;
      }

      if (idxZoneId >= 0 && cols[idxZoneId]) {
        const n = Number(cols[idxZoneId]);
        zoneId = Number.isFinite(n) ? n : null;
      }

      // Account Manager من operationUsers
      const accountManagerName =
        idxAccountManager >= 0 ? cols[idxAccountManager] || '' : '';
      const accountManagerUser = accountManagerName
        ? this.operationUsers().find(
            (u) => (u.fullName || '').trim() === accountManagerName.trim(),
          )
        : undefined;

      // Interviewer من operationUsers
      const interviewerName =
        idxInterviewer >= 0 ? cols[idxInterviewer] || '' : '';
      const interviewerUser = interviewerName
        ? this.operationUsers().find(
            (u) => (u.fullName || '').trim() === interviewerName.trim(),
          )
        : undefined;

      const hrFeedbackVal =
        idxHrFeedback >= 0 && cols[idxHrFeedback]
          ? cols[idxHrFeedback]
          : null;

      let securityResultVal: 'Positive' | 'Negative' | null = null;
      if (idxSecurityResult >= 0 && cols[idxSecurityResult]) {
        const raw = cols[idxSecurityResult].toLowerCase();
        if (raw.startsWith('pos')) securityResultVal = 'Positive';
        else if (raw.startsWith('neg')) securityResultVal = 'Negative';
      }

      const dto: CreateInterviewDto = {
        date: this.normalizeDateCell(
          idxDate >= 0 ? cols[idxDate] || '' : null,
        ),

        courierName,
        phoneNumber,
        nationalId:
          idxNationalId >= 0 && cols[idxNationalId]
            ? cols[idxNationalId]
            : null,
        residence:
          idxResidence >= 0 && cols[idxResidence]
            ? cols[idxResidence]
            : null,

        clientId,

        hubId,
        zoneId,

        position:
          idxPosition >= 0 && cols[idxPosition]
            ? cols[idxPosition]
            : null,

        vehicleType:
          idxVehicle >= 0 && cols[idxVehicle]
            ? cols[idxVehicle]
            : null,

        accountManagerId: accountManagerUser?.id ?? null,
        interviewerId: interviewerUser?.id ?? null,

        signedWithHr:
          idxSignedWithHr >= 0 && cols[idxSignedWithHr]
            ? cols[idxSignedWithHr]
            : null,

        feedback: null,
        hrFeedback: hrFeedbackVal,
        crmFeedback: null,
        followUp1: null,
        followUp2: null,
        followUp3: null,
        courierStatus:
          idxStatus >= 0 && cols[idxStatus]
            ? cols[idxStatus]
            : null,

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

    if (!status.startsWith('active')) {
      return;
    }

    const payload: Partial<ApiDriver> = {
      name: api.courierName ?? '',
      courierPhone: api.phoneNumber ?? '',
      clientName: api.client?.name ?? '',
      area: api.residence || api.zone?.name || api.hub?.name || '',
      hiringStatus: api.courierStatus ?? 'Active',
      contractStatus: api.signedWithHr ?? undefined,
    };

    if (!payload.name && !payload.courierPhone) {
      console.warn(
        'Skip driver sync: no name or phone on interview',
        api.id,
      );
      return;
    }

    this.driversService.bulkUpsertDrivers([payload]).subscribe({
      next: () => {
        console.log(
          'Synced interview %s to drivers as Active',
          api.id,
        );
      },
      error: (err) => {
        console.error('Failed to sync driver from interview', err);
      },
    });
  }
}
