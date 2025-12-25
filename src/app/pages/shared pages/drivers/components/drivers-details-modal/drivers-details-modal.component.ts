import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DriversServiceService, ApiDriver } from '../../../../../services/drivers/drivers-service.service';


@Component({
  selector: 'app-drivers-details-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './drivers-details-modal.component.html',
  styleUrls: ['./drivers-details-modal.component.scss'],
})
export class DriversDetailsModalComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private driversService = inject(DriversServiceService);

  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  driver = signal<ApiDriver | null>(null);

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = Number(idParam);

    if (!id || Number.isNaN(id)) {
      this.error.set('Invalid driver id.');
      this.loading.set(false);
      return;
    }

    this.driversService.getDriver(id).subscribe({
      next: (d) => {
        this.driver.set(d);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load driver details', err);
        this.error.set('Failed to load driver details.');
        this.loading.set(false);
      },
    });
  }

  /** للباك تاني للـ /drivers صراحة */
  goBack(): void {
    this.router.navigate(['/drivers']);
  }

  getInitials(name?: string | null): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  }

  getBadgeClass(status?: string | null): string {
    if (!status) return 'badge--neutral';
    const s = status.toLowerCase();

    if (s.includes('active') || s.includes('cleared') || s.includes('signed')) {
      return 'badge--success';
    }
    if (s.includes('pending') || s.includes('progress') || s.includes('probation')) {
      return 'badge--warning';
    }
    if (s.includes('rejected') || s.includes('terminated') || s.includes('failed') || s.includes('blocked')) {
      return 'badge--danger';
    }
    return 'badge--neutral';
  }
}
