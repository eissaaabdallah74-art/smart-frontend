import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TrackingServiceService, TrackingRow } from '../../../../../services/tracking/tracking-service.service';


@Component({
  selector: 'app-tracking-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tracking-details.component.html',
  styleUrls: ['./tracking-details.component.scss'],
})
export class TrackingDetailsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private trackingService = inject(TrackingServiceService);
  private router = inject(Router);

  row = signal<TrackingRow | null>(null);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam ? Number(idParam) : NaN;

    if (Number.isNaN(id)) {
      this.error.set('Invalid tracking id');
      return;
    }

    this.loadRow(id);
  }

  private loadRow(id: number): void {
    this.loading.set(true);
    this.error.set(null);

    this.trackingService.getRow(id).subscribe({
      next: (row: TrackingRow) => {
        this.row.set(row);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        console.error('Failed to load tracking row', err);
        this.error.set('Failed to load tracking details.');
        this.loading.set(false);
      },
    });
  }

  // ==== Helpers for expiry ====
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

  expiryText(dateStr?: string | null): string {
    const days = this.daysUntil(dateStr);
    if (days === null) return 'No date';
    if (days < 0) return `${Math.abs(days)} days overdue`;
    if (days === 0) return 'Expires today';
    return `${days} days left`;
  }

  // نفس ألوان الـ badge في الهيدر
  expiryBadgeClass(dateStr?: string | null): string {
    const days = this.daysUntil(dateStr);
    if (days === null) return 'badge--neutral';
    if (days < 0) return 'badge--danger';
    if (days <= 30) return 'badge--danger';
    if (days <= 60) return 'badge--warning';
    return 'badge--success';
  }

  getInitials(name?: string | null): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  }

  goBack(): void {
    this.router.navigate(['/drivers-tracking']).catch(() => {
      this.router.navigate(['/drivers']);
    });
  }
}
