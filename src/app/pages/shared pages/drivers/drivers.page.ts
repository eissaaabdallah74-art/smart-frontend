import { Component, OnInit, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ExportButtonComponent } from '../../../shared/export-button/export-button';
import { ImportButtonComponent } from '../../../shared/import-button/import-button.component'; // 👈 جديد

import {
  DriversServiceService,
  ApiDriver,
} from '../../../services/drivers/drivers-service.service';
import {
  ClientsServiceService,
  ApiClient,
} from '../../../services/clients/clients-service.service';
import {
  UsersServiceService,
  ApiUser,
} from '../../../services/users/users-service.service';
import { DriversFormModalComponent, DriverToEdit, DriverFormValue } from './components/drivers-form-modal/drivers-form-modal.component';



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
        ImportButtonComponent,   // 👈 جديد

  ],
})
export class DriversPage implements OnInit {
  // مؤقتًا: اربطها بالـ AuthService بعدين
  isAdmin = true;

  // البيانات
  drivers = signal<ApiDriver[]>([]);
  search = signal<string>('');

  // من الـ clients
  private clients = signal<ApiClient[]>([]);

  // من users
  private operationUsers = signal<ApiUser[]>([]);
  private hrUsers = signal<ApiUser[]>([]);

  // مودال الإضافة/التعديل
  isModalOpen = signal<boolean>(false);
  driverToEdit = signal<DriverToEdit | null>(null);

  // أسماء العملاء
  clientNames = computed<string[]>(() =>
    this.clients()
      .map((c) => c.name)
      .sort((a, b) => a.localeCompare(b))
  );

  // أسماء الـ operation (POC / AM / Interviewer)
  operationNames = computed<string[]>(() =>
    this.operationUsers()
      .map((u) => u.fullName)
      .sort((a, b) => a.localeCompare(b))
  );

  // أسماء الـ HR
  hrNames = computed<string[]>(() =>
    this.hrUsers()
      .map((u) => u.fullName)
      .sort((a, b) => a.localeCompare(b))
  );

  // بعد التصفية
  filtered = computed<ApiDriver[]>(() => {
    const term = this.search().toLowerCase().trim();
    if (!term) return this.drivers();

    return this.drivers().filter((d) =>
      (d.name || '').toLowerCase().includes(term) ||
      (d.courierPhone || '').toLowerCase().includes(term) ||
      (d.clientName || '').toLowerCase().includes(term) ||
      (d.area || '').toLowerCase().includes(term)
    );
  });

  private driversService = inject(DriversServiceService);
  private clientsService = inject(ClientsServiceService);
  private usersService = inject(UsersServiceService);
  private router = inject(Router);

  ngOnInit(): void {
    this.loadDrivers();
    this.loadClients();
    this.loadOperationUsers();
    this.loadHrUsers();
  }

  private loadDrivers(): void {
    this.driversService.getDrivers().subscribe({
      next: (list: ApiDriver[]) => this.drivers.set(list),
      error: (err: unknown) => console.error('Failed to load drivers', err),
    });
  }

  private loadClients(): void {
    this.clientsService.getClients().subscribe({
      next: (list: ApiClient[]) => this.clients.set(list),
      error: (err: unknown) => console.error('Failed to load clients', err),
    });
  }

  private loadOperationUsers(): void {
    this.usersService.getUsers({ role: 'operation', active: true }).subscribe({
      next: (list: ApiUser[]) => this.operationUsers.set(list),
      error: (err: unknown) => console.error('Failed to load operation users', err),
    });
  }

  private loadHrUsers(): void {
    this.usersService.getUsers({ role: 'hr', active: true }).subscribe({
      next: (list: ApiUser[]) => this.hrUsers.set(list),
      error: (err: unknown) => console.error('Failed to load hr users', err),
    });
  }

  // ===== مودال الإضافة/التعديل =====
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
      this.driversService.updateDriver(editing.id, value).subscribe({
        next: (updated: ApiDriver) => {
          this.drivers.update((list) =>
            list.map((d) => (d.id === updated.id ? updated : d))
          );
          this.closeModal();
        },
        error: (err: unknown) => console.error('Failed to update driver', err),
      });
    } else {
      this.driversService.createDriver(value as any).subscribe({
        next: (created: ApiDriver) => {
          this.drivers.update((list) => [...list, created]);
          this.closeModal();
        },
        error: (err: unknown) => console.error('Failed to create driver', err),
      });
    }
  }

  // ===== عرض التفاصيل في صفحة =====
  viewDetails(driver: ApiDriver): void {
    this.router.navigate(['/drivers', driver.id]);
  }

  deleteDriver(id: number): void {
    if (!confirm('Are you sure you want to delete this driver?')) return;

    this.driversService.deleteDriver(id).subscribe({
      next: () => {
        this.drivers.update((list) => list.filter((d) => d.id !== id));
      },
      error: (err: unknown) => console.error('Failed to delete driver', err),
    });
  }

  trackById(_index: number, item: ApiDriver): number {
    return item.id;
  }

  // ===== Import Drivers (XLSX / CSV) =====
  onDriversImport(file: File): void {
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
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, {
          defval: null,
        });

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

  /** هنا بننضف الـ rows شوية وبنبعتها للـ backend bulkUpsert */
  private applyImportedDrivers(rows: any[], fileName: string): void {
    if (!rows || !rows.length) {
      console.warn('No data found in imported file:', fileName);
      return;
    }

    const mappedRows = rows.map((raw) => {
      const row: any = { ...raw };

      // نحاول نطابق شوية أسامي أعمدة محتملة
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

      row.area =
        row.area ||
        row.Area ||
        '';

      row.hiringStatus =
        row.hiringStatus ||
        row['Hiring Status'] ||
        row.hiring_status ||
        '';

      row.contractStatus =
        row.contractStatus ||
        row['Contract Status'] ||
        row.contract_status ||
        '';

      return row as Partial<ApiDriver>;
    });

    this.driversService.bulkUpsertDrivers(mappedRows).subscribe({
      next: (updatedOrCreated: ApiDriver[]) => {
        this.drivers.update((current) => {
          const byId = new Map<number, ApiDriver>();
          current.forEach((d) => byId.set(d.id, d));
          updatedOrCreated.forEach((d) => byId.set(d.id, d));
          return Array.from(byId.values()).sort((a, b) => a.id - b.id);
        });

        console.log(
          `Imported/updated ${updatedOrCreated.length} drivers from ${fileName}.`
        );
      },
      error: (err: unknown) => {
        console.error('Failed to bulk import drivers', err);
      },
    });
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

  // 🔹 نفس اللوجيك بتاع التفاصيل – يدي لون حسب الحالة
  getBadgeClass(status?: string | null): string {
    if (!status) return 'badge--neutral';
    const s = status.toLowerCase();

    if (
      s.includes('active') ||
      s.includes('cleared') ||
      s.includes('signed') ||
      s.includes('hired') ||
      s.includes('ongoing')
    ) {
      return 'badge--success';
    }

    if (
      s.includes('pending') ||
      s.includes('probation') ||
      s.includes('in progress') ||
      s.includes('on hold')
    ) {
      return 'badge--warning';
    }

    if (
      s.includes('rejected') ||
      s.includes('terminated') ||
      s.includes('failed') ||
      s.includes('blocked') ||
      s.includes('inactive')
    ) {
      return 'badge--danger';
    }

    return 'badge--neutral';
  }
}
