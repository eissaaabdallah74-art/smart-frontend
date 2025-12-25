import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { StatusMsgComponent } from '../../../components/status-msg/status-msg.component';
import { DriversServiceService, ApiDriver } from '../../../services/drivers/drivers-service.service';
import { TrackingServiceService, TrackingRow } from '../../../services/tracking/tracking-service.service';
import { ExportButtonComponent } from '../../../shared/export-button/export-button';
import { ImportButtonComponent } from '../../../shared/import-button/import-button.component';
import { TrackingFormModalComponent } from './components/tracking-form-modal/tracking-form-modal.component';



type StatusType = 'success' | 'error';

@Component({
  selector: 'app-drivers-tracker',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TrackingFormModalComponent,
    ExportButtonComponent,
    StatusMsgComponent,
    ImportButtonComponent, // 👈 مهم
  ],
  templateUrl: './drivers-tracker.component.html',
  styleUrls: ['./drivers-tracker.component.scss'],
})
export class DriversTrackerComponent implements OnInit {
  private trackingService = inject(TrackingServiceService);
  private driversService = inject(DriversServiceService);
  private router = inject(Router);

  rows = signal<TrackingRow[]>([]);
  drivers = signal<ApiDriver[]>([]);

  search = signal<string>('');
  // سيبناها لو حبيت ترجع فلتر الـ expiring بعدين
  showExpiringOnly = signal<boolean>(false);

  isModalOpen = signal<boolean>(false);
  editingRow = signal<TrackingRow | null>(null);

  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  status = signal<{ type: StatusType; message: string } | null>(null);

  ngOnInit(): void {
    this.loadDrivers();
    this.loadTracking();
  }

  private setStatus(type: StatusType, message: string): void {
    this.status.set({ type, message });
  }

  clearStatus(): void {
    this.status.set(null);
  }

  private loadDrivers(): void {
    this.driversService.getDrivers().subscribe({
      next: (list: ApiDriver[]) => this.drivers.set(list),
      error: (err: unknown) => {
        console.error('Failed to load drivers', err);
        this.setStatus('error', 'Failed to load drivers list.');
      },
    });
  }

  private loadTracking(): void {
    this.loading.set(true);
    this.error.set(null);
    this.trackingService.getRows().subscribe({
      next: (list: TrackingRow[]) => {
        this.rows.set(list);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        console.error('Failed to load tracking rows', err);
        this.error.set('Failed to load tracking data.');
        this.setStatus('error', 'Failed to load tracking data.');
        this.loading.set(false);
      },
    });
  }

  // ===== Helpers: days / labels / classes =====

  private daysUntil(dateStr?: string | null): number | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffMs = d.getTime() - today.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  expiryClass(dateStr?: string | null): string {
    const days = this.daysUntil(dateStr);
    if (days === null) return 'expiry-pill--unknown';
    if (days < 0) return 'expiry-pill--expired';
    if (days <= 30) return 'expiry-pill--danger';
    if (days <= 60) return 'expiry-pill--warning';
    return 'expiry-pill--ok';
  }

  expiryShort(dateStr?: string | null): string {
    const days = this.daysUntil(dateStr);
    if (days === null) return '—';
    if (days < 0) return `-${Math.abs(days)}d`;
    if (days === 0) return '0d';
    return `${days}d`;
  }

  expiryTooltip(dateStr?: string | null): string {
    const days = this.daysUntil(dateStr);
    if (days === null) return 'No date';
    if (days < 0) return `${Math.abs(days)} days overdue`;
    if (days === 0) return 'Expires today';
    return `${days} days left`;
  }

  // ===== Filtered rows =====
  filtered = computed<TrackingRow[]>(() => {
    const term = this.search().toLowerCase().trim();
    const onlyExpiring = this.showExpiringOnly();

    return this.rows().filter((row) => {
      const drv = row.driver;

      const matchSearch =
        !term ||
        row.dspShortcode?.toLowerCase().includes(term) ||
        row.dasUsername?.toLowerCase().includes(term) ||
        drv?.name?.toLowerCase().includes(term) ||
        drv?.clientName?.toLowerCase().includes(term) ||
        drv?.courierPhone?.toLowerCase().includes(term);

      if (!matchSearch) return false;

      if (!onlyExpiring) return true;

      const idDays = this.daysUntil(row.idExpiryDate);
      const dlDays = this.daysUntil(row.dLicenseExpiryDate);
      const vDays = this.daysUntil(row.vLicenseExpiryDate);

      return [idDays, dlDays, vDays].some((d) => d !== null && d <= 60);
    });
  });

  // ===== Import Tracking (لسه بس بنستقبل الفايل) =====
  onTrackingImport(file: File): void {
    // دلوقتي لما تدوس Import هيفتح الـ file picker
    // وهنا بيتنادى بـ file المختار
    console.log('Tracking import file selected:', file.name);
    this.setStatus('success', `File "${file.name}" selected for import.`);

    // لو حابب نعمل bulk import زي drivers
    // ممكن نضيف هنا parsing + API call بعدين
  }

  // ===== CRUD UI =====

  openCreate(): void {
    this.editingRow.set(null);
    this.isModalOpen.set(true);
  }

  openEdit(row: TrackingRow): void {
    this.editingRow.set(row);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.editingRow.set(null);
  }

  handleSubmit(value: Partial<TrackingRow>): void {
    const editing = this.editingRow();

    if (editing) {
      this.trackingService.updateRow(editing.id, value).subscribe({
        next: (updated: TrackingRow) => {
          this.rows.update((list) =>
            list.map((r) => (r.id === updated.id ? updated : r)),
          );
          this.setStatus('success', 'Tracking row updated successfully.');
          this.closeModal();
        },
        error: (err: unknown) => {
          console.error('Failed to update tracking row', err);
          this.setStatus('error', 'Failed to update tracking row.');
        },
      });
    } else if (value.driverId) {
      this.trackingService
        .createRow({ ...value, driverId: value.driverId })
        .subscribe({
          next: (created: TrackingRow) => {
            this.rows.update((list) => [...list, created]);
            this.setStatus('success', 'Tracking row created successfully.');
            this.closeModal();
          },
          error: (err: unknown) => {
            console.error('Failed to create tracking row', err);
            this.setStatus('error', 'Failed to create tracking row.');
          },
        });
    }
  }

  deleteRow(id: number): void {
    if (!confirm('Are you sure you want to delete this row?')) return;

    this.trackingService.deleteRow(id).subscribe({
      next: () => {
        this.rows.update((list) => list.filter((r) => r.id !== id));
        this.setStatus('success', 'Tracking row deleted.');
      },
      error: (err: unknown) => {
        console.error('Failed to delete tracking row', err);
        this.setStatus('error', 'Failed to delete tracking row.');
      },
    });
  }

  goToDetails(id: number): void {
    this.router.navigate(['/drivers-tracking-details', id]);
  }

  trackById(_idx: number, row: TrackingRow): number {
    return row.id;
  }
}
