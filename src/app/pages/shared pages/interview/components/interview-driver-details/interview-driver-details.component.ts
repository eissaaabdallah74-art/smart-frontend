// src/app/pages/.../interview/components/interview-driver-details/interview-driver-details.component.ts
import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { InterviewRow } from '../../interview.component';
import {
  InterviewsServiceService,
  ApiInterview,
} from '../../../../../services/interviews/interviews-service.service';

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

    if (status.startsWith('active')) {
      return 'status-pill--hired';
    }
    if (status.startsWith('unreachable') || status.includes('reschedule')) {
      return 'status-pill--in-progress';
    }
    if (status.startsWith('hold')) {
      return 'status-pill--hold';
    }
    if (status.startsWith('resigned')) {
      return 'status-pill--rejected';
    }

    // Backward compatibility
    if (status.includes('hire')) return 'status-pill--hired';
    if (status.includes('progress')) return 'status-pill--in-progress';
    if (status.includes('reject') || status.includes('unqualified')) {
      return 'status-pill--rejected';
    }
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
    };
  }
}
