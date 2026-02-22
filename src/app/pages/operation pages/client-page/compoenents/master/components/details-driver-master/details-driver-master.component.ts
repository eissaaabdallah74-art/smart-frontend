// src/app/pages/.../client-page/components/details-driver-master/details-driver-master.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnChanges, Input, Output, EventEmitter, inject, signal, computed, SimpleChanges } from '@angular/core';
import { DriversServiceService, ApiDriver } from '../../../../../../../services/drivers/drivers-service.service';


@Component({
  selector: 'app-details-driver-master',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './details-driver-master.component.html',
  styleUrl: './details-driver-master.component.scss',
})
export class DetailsDriverMasterComponent implements OnChanges {
  @Input() driverId: number | null = null;
  @Output() requestEdit = new EventEmitter<void>();

  private driversService = inject(DriversServiceService);

  readonly loading = signal<boolean>(false);
  readonly error = signal<string>('');
  readonly driver = signal<ApiDriver | null>(null);

  readonly title = computed(() => {
    const d: any = this.driver();
    return (d?.name || '').trim() || 'Driver';
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['driverId']) {
      this.fetch();
    }
  }

  fetch(): void {
    const id = this.driverId;
    if (!id) {
      this.driver.set(null);
      this.error.set('');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.driversService.getDriver(id).subscribe({
      next: (d) => {
        this.driver.set(d);
        this.loading.set(false);
      },
      error: (e) => {
        console.error('Failed to load driver details', e);
        this.driver.set(null);
        this.loading.set(false);
        this.error.set('Failed to load driver details.');
      },
    });
  }

  safe(v: any): string {
    const s = String(v ?? '').trim();
    return s || '—';
  }

  dateOnly(v: any): string {
    if (!v) return '—';
    const s = String(v);
    return s.length >= 10 ? s.slice(0, 10) : s;
  }

  yesNo(v: any): string {
    return v ? 'Yes' : 'No';
  }

  pillClass(status: any): string {
    const s = String(status ?? '').trim().toLowerCase();
    if (!s) return 'pill pill--muted';
    if (s === 'active') return 'pill pill--success';
    if (s.includes('hold') || s.includes('pending')) return 'pill pill--warn';
    if (s.includes('inactive') || s.includes('terminated') || s.includes('rejected'))
      return 'pill pill--danger';
    return 'pill pill--info';
  }

  onEdit(): void {
    this.requestEdit.emit();
  }
}
