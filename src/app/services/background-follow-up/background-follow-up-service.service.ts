import { Injectable, computed, signal, inject } from '@angular/core';
import { ApiInterview, InterviewsServiceService } from '../interviews/interviews-service.service';

@Injectable({ providedIn: 'root' })
export class BackgroundFollowUpService {
  private interviewsService = inject(InterviewsServiceService);

  // raw from API
  private readonly _list = signal<ApiInterview[]>([]);
  private readonly _loading = signal<boolean>(false);

  readonly loading = computed(() => this._loading());

  // filter: security = Negative AND status != Active
  readonly pendingList = computed<ApiInterview[]>(() => {
    const list = this._list();

    return list.filter((i) => {
      const sec = (i.securityResult || '').toLowerCase().trim();
      const status = (i.courierStatus || '').toLowerCase().trim();

      const isNegative = sec === 'negative';
      const isActive = status.startsWith('active');

      return isNegative && !isActive;
    });
  });

  readonly pendingCount = computed<number>(() => this.pendingList().length);

  refresh(): void {
    this._loading.set(true);

    this.interviewsService.getInterviews().subscribe({
      next: (list) => {
        this._list.set(list || []);
        this._loading.set(false);
      },
      error: (err) => {
        console.error('BackgroundFollowUpService.refresh failed', err);
        this._loading.set(false);
      },
    });
  }
}
