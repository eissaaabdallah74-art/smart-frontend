import { Component, OnInit, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ExportButtonComponent } from '../../../shared/export-button/export-button';
import { ImportButtonComponent } from '../../../shared/import-button/import-button.component';




import {
  ClientsServiceService,
  ApiClient,
} from '../../../services/clients/clients-service.service';

import {
  UsersServiceService,
  ApiUser,
} from '../../../services/users/users-service.service';

import {
  DriversFormModalComponent,
  DriverToEdit,
  DriverFormValue,
} from './components/drivers-form-modal/drivers-form-modal.component';
import { ApiDriver, DriversServiceService, UpdateDriverDto, CreateDriverDto } from '../../../services/drivers/drivers-service.service';
import { SignedWithHrStatus, DriverContractStatus } from '../../../shared/enums/driver-enums';

@Component({
  standalone: true,
  selector: 'app-drivers',
  templateUrl: './drivers.page.html',
  styleUrls: ['./drivers.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    ExportButtonComponent,
    DriversFormModalComponent,
    ImportButtonComponent,
  ],
})
export class DriversPage implements OnInit {
  // مؤقتًا: اربطها بالـ AuthService بعدين
  isAdmin = true;

  drivers = signal<ApiDriver[]>([]);
  search = signal<string>('');

  private clients = signal<ApiClient[]>([]);
  private operationUsers = signal<ApiUser[]>([]);
  private hrUsers = signal<ApiUser[]>([]);

  isModalOpen = signal<boolean>(false);
  driverToEdit = signal<DriverToEdit | null>(null);

  clientNames = computed<string[]>(() =>
    (this.clients() || [])
      .map((c) => c.name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b)),
  );

  operationNames = computed<string[]>(() =>
    (this.operationUsers() || [])
      .map((u) => u.fullName)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b)),
  );

  hrNames = computed<string[]>(() =>
    (this.hrUsers() || [])
      .map((u) => u.fullName)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b)),
  );

  filtered = computed<ApiDriver[]>(() => {
    const term = this.search().toLowerCase().trim();
    if (!term) return this.drivers();

    const safe = (v: any) => String(v ?? '').toLowerCase();
    return this.drivers().filter(
      (d) =>
        safe(d.name).includes(term) ||
        safe(d.courierPhone).includes(term) ||
        safe(d.clientName).includes(term) ||
        safe(d.area).includes(term),
    );
  });

  // ✅ typed injections (fix TS2571 unknown)
  private driversService: DriversServiceService = inject(DriversServiceService);
  private clientsService: ClientsServiceService = inject(ClientsServiceService);
  private usersService: UsersServiceService = inject(UsersServiceService);
  private router: Router = inject(Router);

  ngOnInit(): void {
    this.loadDrivers();
    this.loadClients();
    this.loadOperationUsers();
    this.loadHrUsers();
  }

  private loadDrivers(): void {
    this.driversService.getDrivers().subscribe({
      next: (list: ApiDriver[]) => this.drivers.set(list || []),
      error: (err: unknown) => console.error('Failed to load drivers', err),
    });
  }

  private loadClients(): void {
    this.clientsService.getClients().subscribe({
      next: (list: ApiClient[]) => this.clients.set(list || []),
      error: (err: unknown) => console.error('Failed to load clients', err),
    });
  }

  private loadOperationUsers(): void {
    this.usersService.getUsers({ role: 'operation', active: true }).subscribe({
      next: (list: ApiUser[]) => this.operationUsers.set(list || []),
      error: (err: unknown) =>
        console.error('Failed to load operation users', err),
    });
  }

  private loadHrUsers(): void {
    this.usersService.getUsers({ role: 'hr', active: true }).subscribe({
      next: (list: ApiUser[]) => this.hrUsers.set(list || []),
      error: (err: unknown) => console.error('Failed to load hr users', err),
    });
  }

  // ===== Modal =====
  openAddModal(): void {
    this.driverToEdit.set(null);
    this.isModalOpen.set(true);
  }

  openEditModal(driver: ApiDriver): void {
    const { id, ...rest } = driver;
    this.driverToEdit.set({ id, ...rest } as DriverToEdit);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.driverToEdit.set(null);
  }

  submitForm(value: DriverFormValue): void {
    const editing = this.driverToEdit();

    if (editing) {
      const patch: UpdateDriverDto = this.toUpdateDto(value);

      this.driversService.updateDriver(editing.id, patch).subscribe({
        next: (updated: ApiDriver) => {
          this.drivers.update((list) =>
            (list || []).map((d) => (d.id === updated.id ? updated : d)),
          );
          this.closeModal();
        },
        error: (err: unknown) => console.error('Failed to update driver', err),
      });

      return;
    }

    const dto: CreateDriverDto = this.toCreateDto(value);

    this.driversService.createDriver(dto).subscribe({
      next: (created: ApiDriver) => {
        this.drivers.update((list) => [...(list || []), created]);
        this.closeModal();
      },
      error: (err: unknown) => console.error('Failed to create driver', err),
    });
  }

  viewDetails(driver: ApiDriver): void {
    this.router.navigate(['/drivers', driver.id]);
  }

  deleteDriver(id: number): void {
    if (!confirm('Are you sure you want to delete this driver?')) return;

    this.driversService.deleteDriver(id).subscribe({
      next: () => this.drivers.update((list) => (list || []).filter((d) => d.id !== id)),
      error: (err: unknown) => console.error('Failed to delete driver', err),
    });
  }

  trackById(_index: number, item: ApiDriver): number {
    return item.id;
  }

  // ===== Import =====
  onDriversImport(file: File): void {
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
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: null });
        this.applyImportedDrivers(json, file.name);
      } catch (err) {
        console.error('Failed to import XLSX', err);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  private importFromCsv(file: File): void {
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const text = e.target?.result as string;
        const rows = this.parseCsv(text);
        this.applyImportedDrivers(rows, file.name);
      } catch (err) {
        console.error('Failed to import CSV', err);
      }
    };
    reader.readAsText(file);
  }

  private applyImportedDrivers(rows: any[], fileName: string): void {
    if (!rows || !rows.length) {
      console.warn('No data found in imported file:', fileName);
      return;
    }

    const mappedRows: Partial<ApiDriver>[] = rows.map((raw) => {
      const row: any = { ...raw };

      row.name =
        row.name ||
        row.Name ||
        row['Driver Name'] ||
        row['Name EN'] ||
        '';

      row.courierPhone =
        row.courierPhone ||
        row['Courier Phone'] ||
        row['Phone'] ||
        row.courier_phone ||
        '';

      row.clientName =
        row.clientName ||
        row.client ||
        row.Client ||
        row['Client Name'] ||
        '';

      row.area = row.area || row.Area || '';

      row.hiringStatus =
        row.hiringStatus ||
        row['Hiring Status'] ||
        row.hiring_status ||
        null;

      row.contractStatus =
        row.contractStatus ||
        row['Contract Status'] ||
        row.contract_status ||
        null;

      row.signedWithHr =
        row.signedWithHr ||
        row['SignedWithHr'] ||
        row['Signed With HR'] ||
        null;

      // ✅ normalize / cast
      row.name = this.s(row.name);
      row.courierPhone = this.nullIfEmpty(row.courierPhone);
      row.clientName = this.nullIfEmpty(row.clientName);
      row.area = this.nullIfEmpty(row.area);

      row.hiringStatus = this.nullIfEmpty(row.hiringStatus);
      row.contractStatus = this.toDriverContractStatusOrNull(row.contractStatus);
      row.signedWithHr = this.toSignedWithHrStatusOrNull(row.signedWithHr);

      return row as Partial<ApiDriver>;
    });

    this.driversService.bulkUpsertDrivers(mappedRows).subscribe({
      next: (updatedOrCreated: ApiDriver[]) => {
        this.drivers.update((current) => {
          const byId = new Map<number, ApiDriver>();
          (current || []).forEach((d) => byId.set(d.id, d));
          (updatedOrCreated || []).forEach((d) => byId.set(d.id, d));
          return Array.from(byId.values()).sort((a, b) => a.id - b.id);
        });

        console.log(`Imported/updated ${updatedOrCreated.length} drivers from ${fileName}.`);
      },
      error: (err: unknown) => console.error('Failed to bulk import drivers', err),
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

  getBadgeClass(status?: string | null): string {
    if (!status) return 'badge--neutral';
    const s = status.toLowerCase();

    if (s.includes('active') || s.includes('cleared') || s.includes('signed') || s.includes('hired') || s.includes('ongoing')) {
      return 'badge--success';
    }

    if (s.includes('pending') || s.includes('probation') || s.includes('in progress') || s.includes('on hold')) {
      return 'badge--warning';
    }

    if (s.includes('rejected') || s.includes('terminated') || s.includes('failed') || s.includes('blocked') || s.includes('inactive')) {
      return 'badge--danger';
    }

    return 'badge--neutral';
  }

  // =====================
  // DTO builders
  // =====================

  private toCreateDto(value: DriverFormValue): CreateDriverDto {
    const v: any = value;

    // ✅ لازم يبقى موجود (على الأقل null)
    const dto: CreateDriverDto = {
      name: this.s(v.name),
      fullNameArabic: this.nullIfEmpty(v.fullNameArabic),
      email: this.nullIfEmpty(v.email),

      courierPhone: this.nullIfEmpty(v.courierPhone),
      courierId: this.nullIfEmpty(v.courierId),
      residence: this.nullIfEmpty(v.residence),
      courierCode: this.nullIfEmpty(v.courierCode),

      clientName: this.nullIfEmpty(v.clientName),
      hub: this.nullIfEmpty(v.hub),
      area: this.nullIfEmpty(v.area),
      module: this.nullIfEmpty(v.module),

      vehicleType: this.nullIfEmpty(v.vehicleType),
      contractor: this.nullIfEmpty(v.contractor),
      pointOfContact: this.nullIfEmpty(v.pointOfContact),
      accountManager: this.nullIfEmpty(v.accountManager),
      interviewer: this.nullIfEmpty(v.interviewer),
      hrRepresentative: this.nullIfEmpty(v.hrRepresentative),

      hiringDate: this.nullIfEmpty(v.hiringDate),
      day1Date: this.nullIfEmpty(v.day1Date),

      vLicenseExpiryDate: this.nullIfEmpty(v.vLicenseExpiryDate),
      dLicenseExpiryDate: this.nullIfEmpty(v.dLicenseExpiryDate),
      idExpiryDate: this.nullIfEmpty(v.idExpiryDate),

      liabilityAmount: this.toNumberOrNull(v.liabilityAmount),
      signed: !!v.signed,

      // ✅ typed unions
      signedWithHr: this.toSignedWithHrStatusOrNull(v.signedWithHr),
      contractStatus: this.toDriverContractStatusOrNull(v.contractStatus),

      hiringStatus: this.nullIfEmpty(v.hiringStatus),
      securityQueryStatus: this.nullIfEmpty(v.securityQueryStatus),
      securityQueryComment: this.nullIfEmpty(v.securityQueryComment),

      exceptionBy: this.nullIfEmpty(v.exceptionBy),
      notes: this.nullIfEmpty(v.notes),
    };

    return dto;
  }

  private toUpdateDto(value: DriverFormValue): UpdateDriverDto {
    // UpdateDriverDto = Partial<CreateDriverDto> (حسب عندك)
    // هنا نقدر نرجّع نفس create dto عادي، أو نرجّع partial.
    return this.toCreateDto(value) as unknown as UpdateDriverDto;
  }

  // =====================
  // Utils / casters
  // =====================

  private s(v: any): string {
    return String(v ?? '').trim();
  }

  private nullIfEmpty(v: any): string | null {
    const s = String(v ?? '').trim();
    return s ? s : null;
  }

  private toNumberOrNull(v: any): number | null {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  private toSignedWithHrStatusOrNull(v: any): SignedWithHrStatus | null {
    const s = String(v ?? '').trim();
    if (!s) return null;

    const allowed: readonly SignedWithHrStatus[] = [
      'Signed A Contract With HR',
      'Will Think About Our Offers',
      'Missing documents',
      'Unqualified',
    ];

    return (allowed as readonly string[]).includes(s) ? (s as SignedWithHrStatus) : null;
  }

  private toDriverContractStatusOrNull(v: any): DriverContractStatus | null {
    const s = String(v ?? '').trim();
    if (!s) return null;

    const allowed: readonly DriverContractStatus[] = [
      'Active',
      'Inactive',
      'Unreachable/Reschedule',
      'Resigned',
      'Hold zone',
    ];

    return (allowed as readonly string[]).includes(s) ? (s as DriverContractStatus) : null;
  }
}
