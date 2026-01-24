// src/app/pages/.../drivers/components/driver-details/driver-details.component.ts
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DriversServiceService,
  ApiDriver,
} from '../../../../../services/drivers/drivers-service.service';

type DriverVm = {
  id?: number;

  name: string;
  fullNameArabic?: string;

  courierId?: string;
  courierCode?: string;

  courierPhone?: string;
  email?: string;
  residence?: string;

  clientName?: string;
  accountManager?: string;
  interviewer?: string;
  hrRepresentative?: string;
  pointOfContact?: string;

  hub?: string;
  area?: string;
  module?: string;
  vehicleType?: string;
  contractor?: string;

  hiringDate?: string;
  day1Date?: string;

  vLicenseExpiryDate?: string;
  dLicenseExpiryDate?: string;
  idExpiryDate?: string;

  liabilityAmount?: number | null;

  signed?: boolean;
  contractStatus?: string;
  hiringStatus?: string;
  securityQueryStatus?: string;
  exceptionBy?: string;

  securityQueryComment?: string;
  notes?: string;
};

@Component({
  selector: 'app-drivers-details-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './drivers-details-modal.component.html',
  styleUrls: ['./drivers-details-modal.component.scss'],
})
export class DriversDetailsModalComponent  implements OnInit {
  /** لو Drawer داخل صفحة: ابعت driver هنا */
  @Input() driver: ApiDriver | null = null;

  /** Drawer close */
  @Output() close = new EventEmitter<void>();

  vm: DriverVm | null = null;
  loading = true;
  loadError: string | null = null;

  copiedToast: string | null = null;
  private copiedToastTimer: any = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private driversService: DriversServiceService,
  ) {}

  ngOnInit(): void {
    // لو داخل كـ Drawer وجالك @Input → اعرضه فوراً
    if (this.driver) {
      this.vm = this.mapApiToVm(this.driver);
      this.loading = false;
      return;
    }

    // لو صفحة مستقلة /drivers/:id → هات من API
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam ? Number(idParam) : NaN;

    if (Number.isNaN(id) || !id) {
      this.failOrNavigate('Invalid driver id.');
      return;
    }

    this.fetchById(id);
  }

  /** هل شغال كـ صفحة route ولا drawer */
  get isStandaloneRoute(): boolean {
    const idParam = this.route.snapshot.paramMap.get('id');
    return !!idParam && !this.close.observers.length;
  }

  get initials(): string {
    const name = this.vm?.name || '';
    if (!name.trim()) return '?';
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
    return (first + last).toUpperCase();
  }

  /** Badge / Status أعلى البروفايل */
  get statusText(): string {
    const d = this.vm;
    if (!d) return '—';

    // أفضلية: hiringStatus ثم contractStatus ثم securityQueryStatus
    return (
      d.hiringStatus ||
      d.contractStatus ||
      d.securityQueryStatus ||
      'New Driver'
    );
  }

  get statusClass(): string {
    const d = this.vm;
    const raw = `${d?.hiringStatus || ''} ${d?.contractStatus || ''} ${d?.securityQueryStatus || ''}`
      .toLowerCase()
      .trim();

    if (!raw) return 'status-pill--new';

    // Success
    if (
      raw.includes('active') ||
      raw.includes('cleared') ||
      raw.includes('signed') ||
      raw.includes('approved') ||
      raw.includes('hired')
    ) {
      return 'status-pill--hired';
    }

    // Warning / In progress
    if (
      raw.includes('pending') ||
      raw.includes('progress') ||
      raw.includes('probation') ||
      raw.includes('review') ||
      raw.includes('in progress')
    ) {
      return 'status-pill--in-progress';
    }

    // Hold
    if (raw.includes('hold') || raw.includes('paused')) {
      return 'status-pill--hold';
    }

    // Danger
    if (
      raw.includes('rejected') ||
      raw.includes('terminated') ||
      raw.includes('failed') ||
      raw.includes('blocked')
    ) {
      return 'status-pill--rejected';
    }

    return 'status-pill--new';
  }

  get hasAnyNotes(): boolean {
    const d = this.vm;
    if (!d) return false;
    return !!(d.securityQueryComment || d.notes);
  }

  get hasAnyDocuments(): boolean {
    const d = this.vm;
    if (!d) return false;
    return !!(d.vLicenseExpiryDate || d.dLicenseExpiryDate || d.idExpiryDate);
  }

  onCloseClick(): void {
    if (this.isStandaloneRoute) {
      this.router.navigate(['/drivers']);
    } else {
      this.close.emit();
    }
  }

  callDriver(): void {
    const phone = this.vm?.courierPhone?.trim();
    if (!phone) return;
    window.location.href = `tel:${phone}`;
  }

  async copyText(label: string, value?: string | null): Promise<void> {
    const v = (value || '').trim();
    if (!v) return;

    try {
      await navigator.clipboard.writeText(v);
      this.showCopiedToast(`${label} copied`);
    } catch {
      // fallback
      const textarea = document.createElement('textarea');
      textarea.value = v;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        this.showCopiedToast(`${label} copied`);
      } finally {
        document.body.removeChild(textarea);
      }
    }
  }

  private showCopiedToast(text: string): void {
    this.copiedToast = text;
    if (this.copiedToastTimer) clearTimeout(this.copiedToastTimer);
    this.copiedToastTimer = setTimeout(() => (this.copiedToast = null), 1400);
  }

  private fetchById(id: number): void {
    this.loading = true;
    this.loadError = null;

    this.driversService.getDriver(id).subscribe({
      next: (api: ApiDriver) => {
        this.vm = this.mapApiToVm(api);
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load driver details', err);
        this.failOrNavigate('Failed to load driver details.');
      },
    });
  }

  private failOrNavigate(msg: string): void {
    if (this.isStandaloneRoute) {
      this.router.navigate(['/drivers']);
      return;
    }
    this.loadError = msg;
    this.loading = false;
  }

  private mapApiToVm(api: ApiDriver): DriverVm {
    return {
      id: (api as any).id,

      name: (api as any).name ?? '',
      fullNameArabic: (api as any).fullNameArabic ?? '',

      courierId: (api as any).courierId ?? '',
      courierCode: (api as any).courierCode ?? '',

      courierPhone: (api as any).courierPhone ?? '',
      email: (api as any).email ?? '',
      residence: (api as any).residence ?? '',

      clientName: (api as any).clientName ?? '',
      accountManager: (api as any).accountManager ?? '',
      interviewer: (api as any).interviewer ?? '',
      hrRepresentative: (api as any).hrRepresentative ?? '',
      pointOfContact: (api as any).pointOfContact ?? '',

      hub: (api as any).hub ?? '',
      area: (api as any).area ?? '',
      module: (api as any).module ?? '',
      vehicleType: (api as any).vehicleType ?? '',
      contractor: (api as any).contractor ?? '',

      hiringDate: (api as any).hiringDate ?? '',
      day1Date: (api as any).day1Date ?? '',

      vLicenseExpiryDate: (api as any).vLicenseExpiryDate ?? '',
      dLicenseExpiryDate: (api as any).dLicenseExpiryDate ?? '',
      idExpiryDate: (api as any).idExpiryDate ?? '',

      liabilityAmount:
        (api as any).liabilityAmount !== undefined
          ? (api as any).liabilityAmount
          : null,

      signed: !!(api as any).signed,
      contractStatus: (api as any).contractStatus ?? '',
      hiringStatus: (api as any).hiringStatus ?? '',
      securityQueryStatus: (api as any).securityQueryStatus ?? '',
      exceptionBy: (api as any).exceptionBy ?? '',

      securityQueryComment: (api as any).securityQueryComment ?? '',
      notes: (api as any).notes ?? '',
    };
  }
}
