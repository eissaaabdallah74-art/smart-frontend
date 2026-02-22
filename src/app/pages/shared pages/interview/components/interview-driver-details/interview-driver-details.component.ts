// src/app/pages/.../interview/components/interview-driver-details/interview-driver-details.component.ts
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { InterviewRow } from '../../interview.component';
import {
  InterviewsServiceService,
  ApiInterview,
} from '../../../../../services/interviews/interviews-service.service';

type ExpiryChipClass = 'chip--ok' | 'chip--soon' | 'chip--expired' | 'chip--unknown';

@Component({
  selector: 'app-interview-driver-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './interview-driver-details.component.html',
  styleUrl: './interview-driver-details.component.scss',
})
export class InterviewDriverDetailsComponent implements OnInit {
  @Input() interview: InterviewRow | null = null;
  @Output() close = new EventEmitter<void>();

  /** Thresholds */
  private readonly SOON_DAYS = 30;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private interviewsService: InterviewsServiceService,
  ) {}

  ngOnInit(): void {
    // لو مستخدم كـ صفحة مستقلة (/interviews/:id) ومفيش @Input، هات الـ record من الـ API
    if (!this.interview) {
      const idParam = this.route.snapshot.paramMap.get('id');
      const id = idParam ? Number(idParam) : NaN;

      if (!Number.isNaN(id)) {
        this.loadInterviewById(id);
      }
    }
  }

  /** هل الكومبوننت شغال كـ صفحة مستقلة (route) ولا drawer داخل صفحة الـ Interviews */
  get isStandaloneRoute(): boolean {
    const idParam = this.route.snapshot.paramMap.get('id');
    return !!idParam && !this.close.observers.length;
  }

  /** initials للأفاتار من اسم الكورير */
  get initials(): string {
    const name = this.interview?.courierName || '';
    if (!name.trim()) return '?';
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
    return (first + last).toUpperCase();
  }

  /** كلاس الـ status pill */
  get statusClass(): string {
    const status = (this.interview?.courierStatus || '').toLowerCase().trim();

    if (status.startsWith('active')) return 'status-pill--hired';
    if (status.startsWith('unreachable') || status.includes('reschedule')) return 'status-pill--in-progress';
    if (status.startsWith('hold')) return 'status-pill--hold';
    if (status.startsWith('resigned')) return 'status-pill--rejected';

    // Backward compatibility
    if (status.includes('hire')) return 'status-pill--hired';
    if (status.includes('progress')) return 'status-pill--in-progress';
    if (status.includes('reject') || status.includes('unqualified')) return 'status-pill--rejected';
    if (status.includes('new')) return 'status-pill--new';

    return 'status-pill--new';
  }

  /** هل في أي follow up؟ */
  get hasAnyFollowups(): boolean {
    const row = this.interview;
    if (!row) return false;
    return !!(row.followUp1 || row.followUp2 || row.followUp3);
  }

  /** زرار الـ Close / Back */
  onCloseClick(): void {
    if (this.isStandaloneRoute) {
      this.router.navigate(['/interviews']);
    } else {
      this.close.emit();
    }
  }

  /* =========================
     Clipboard helpers
     ========================= */

  async copyToClipboard(text?: string | null): Promise<void> {
    const value = (text ?? '').trim();
    if (!value) return;

    try {
      // Modern clipboard API
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return;
      }

      // Fallback (older browsers)
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.top = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch {
      // intentionally silent (UI feedback optional)
    }
  }

  /* =========================
     Expiry helpers (Licenses)
     ========================= */

  /**
   * Returns days left (>=0) or negative if expired.
   * Returns null if date invalid / empty.
   */
  getDaysLeft(dateStr?: string | null): number | null {
    const d = this.parseAnyDate(dateStr);
    if (!d) return null;

    const today = this.startOfDay(new Date());
    const target = this.startOfDay(d);
    const diffMs = target.getTime() - today.getTime();
    // Convert ms to days (integer)
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  }

  getExpiryChipClass(dateStr?: string | null): ExpiryChipClass {
    const days = this.getDaysLeft(dateStr);
    if (days === null) return 'chip--unknown';
    if (days < 0) return 'chip--expired';
    if (days <= this.SOON_DAYS) return 'chip--soon';
    return 'chip--ok';
  }

  getExpiryChipLabel(dateStr?: string | null): string {
    const days = this.getDaysLeft(dateStr);
    if (days === null) return 'Unknown';
    if (days < 0) return 'Expired';
    if (days === 0) return 'Expires today';
    if (days <= this.SOON_DAYS) return 'Expiring soon';
    return 'Valid';
  }

  /**
   * Accepts:
   * - "YYYY-MM-DD"
   * - ISO: "2026-01-24T00:00:00.000Z"
   * - Any Date.parse compatible string
   */
  private parseAnyDate(dateStr?: string | null): Date | null {
    const raw = (dateStr ?? '').trim();
    if (!raw) return null;

    // Handle YYYY-MM-DD safely as local date
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]); // 1-12
      const d = Number(m[3]);  // 1-31
      const dt = new Date(y, mo - 1, d);
      // validate
      if (dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d) return dt;
      return null;
    }

    // Fallback to Date.parse
    const t = Date.parse(raw);
    if (Number.isNaN(t)) return null;
    return new Date(t);
  }

  private startOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  /* ====== Load interview when used as page ====== */

  private loadInterviewById(id: number): void {
    this.interviewsService.getInterviews().subscribe({
      next: (list: ApiInterview[]) => {
        const api = list.find((x) => x.id === id);
        if (!api) {
          this.router.navigate(['/interviews']);
          return;
        }
        this.interview = this.mapApiToRow(api);
      },
      error: () => {
        this.router.navigate(['/interviews']);
      },
    });
  }

  /** mapping لـ ApiInterview → InterviewRow */
  private mapApiToRow(api: ApiInterview): InterviewRow {
    return {
      _id: api.id ?? 0,
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

      // ✅ Licenses
      vLicenseExpiryDate: api.vLicenseExpiryDate ?? '',
      dLicenseExpiryDate: api.dLicenseExpiryDate ?? '',
      idExpiryDate: api.idExpiryDate ?? '',
    };
  }
}
