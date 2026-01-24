import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  HttpEvent,
  HttpEventType,
} from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AttendanceDeductionsService } from '../../../../services/attendance/attendance-deductions.service';
import { AttendanceImportDto } from '../../../../models/attendance/attendance.models';

type UiState = 'idle' | 'uploading' | 'success' | 'error';

@Component({
  selector: 'app-hr-attendance-import',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hr-attendance-import.component.html',
  styleUrls: ['./hr-attendance-import.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HrAttendanceImportComponent {
  private svc = inject(AttendanceDeductionsService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  // UX state
  readonly state = signal<UiState>('idle');
  readonly errorMsg = signal<string | null>(null);

  readonly dragActive = signal(false);
  readonly selectedFile = signal<File | null>(null);

  readonly progress = signal<number>(0);
  readonly importing = computed(() => this.state() === 'uploading');

  // Result
  readonly importResult = signal<AttendanceImportDto | null>(null);
  readonly unmatchedRows = signal<any[]>([]);

  // Recent imports (global)
  readonly recentImports = signal<AttendanceImportDto[]>([]);
  readonly hasUnmatched = computed(() => {
    const r = this.importResult();
    return !!r && Number(r.unmatchedRowsCount || 0) > 0;
  });

  // Limits (backend JSON limit 10mb عندك)
  readonly maxBytes = 10 * 1024 * 1024;

  constructor() {
    this.loadRecentImports();
  }

  // --------- Navigation (هنفعل routes بعدين بس الكود جاهز) ----------
  goToOverview(): void {
    this.router.navigateByUrl('/hr/attendance');
  }

  goToMapping(): void {
    this.router.navigateByUrl('/hr/attendance/mapping');
  }

  // --------- Recent imports ----------
  async loadRecentImports(): Promise<void> {
    try {
      const rows = await this.svc.listImports().toPromise();
      const sorted = (rows || []).slice().sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
      this.recentImports.set(sorted.slice(0, 8));
    } catch (e) {
      // لو فشلنا نجيب recent imports ما نوقفش الصفحة
      this.recentImports.set([]);
    }
  }

  // --------- File handlers ----------
  openFilePicker(inputEl: HTMLInputElement): void {
    inputEl.click();
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0] ? input.files[0] : null;
    if (file) this.setFile(file);
    input.value = '';
  }

  onDragOver(ev: DragEvent): void {
    ev.preventDefault();
    this.dragActive.set(true);
  }

  onDragLeave(ev: DragEvent): void {
    ev.preventDefault();
    this.dragActive.set(false);
  }

  onDrop(ev: DragEvent): void {
    ev.preventDefault();
    this.dragActive.set(false);

    const file = ev.dataTransfer?.files?.[0] || null;
    if (file) this.setFile(file);
  }

  clearFile(): void {
    this.selectedFile.set(null);
  }

  private setFile(file: File): void {
    this.errorMsg.set(null);
    this.importResult.set(null);
    this.unmatchedRows.set([]);
    this.state.set('idle');
    this.progress.set(0);

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const okExt = ext === 'xls' || ext === 'xlsx';

    if (!okExt) {
      this.errorMsg.set('File type not supported. Please upload .xls or .xlsx');
      this.selectedFile.set(null);
      return;
    }

    if (file.size > this.maxBytes) {
      this.errorMsg.set('File is too large. Max size is 10 MB.');
      this.selectedFile.set(null);
      return;
    }

    this.selectedFile.set(file);
  }

  // --------- Import ----------
  importNow(): void {
    const file = this.selectedFile();
    if (!file || this.importing()) return;

    this.state.set('uploading');
    this.errorMsg.set(null);
    this.importResult.set(null);
    this.unmatchedRows.set([]);
    this.progress.set(0);

    this.svc
      .importSheetWithProgress(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (event: HttpEvent<any>) => {
          if (event.type === HttpEventType.Sent) {
            this.progress.set(2);
          }

          if (event.type === HttpEventType.UploadProgress) {
            const total = event.total || file.size || 1;
            const pct = Math.round((event.loaded / total) * 100);
            this.progress.set(Math.min(Math.max(pct, 2), 98));
          }

          if (event.type === HttpEventType.Response) {
            this.progress.set(100);

            // نتسامح مع شكل response (backend ممكن يرجع import أو fields مباشرة)
            const body = event.body || {};
            const importObj: AttendanceImportDto =
              body.import || body.data || body;

            // unmatched sample (اختياري)
            const unmatched =
              body.unmatchedRows ||
              importObj.unmatchedSampleJson ||
              [];

            this.importResult.set(importObj || null);
            this.unmatchedRows.set(Array.isArray(unmatched) ? unmatched : []);
            this.state.set('success');

            // refresh recent
            this.loadRecentImports();
          }
        },
        error: (e: any) => {
          console.error('Import error:', e);
          this.state.set('error');
          this.progress.set(0);
          this.errorMsg.set(
            e?.error?.message ||
              e?.message ||
              'Import failed. Please check the file and try again.'
          );
        },
      });
  }

  resetForAnotherImport(): void {
    this.state.set('idle');
    this.errorMsg.set(null);
    this.importResult.set(null);
    this.unmatchedRows.set([]);
    this.progress.set(0);
    this.selectedFile.set(null);
  }

  // --------- UI helpers ----------
  formatBytes(bytes: number): string {
    const b = Number(bytes || 0);
    if (!Number.isFinite(b) || b <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let v = b;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i++;
    }
    return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }

  formatDateTime(v?: string): string {
    if (!v) return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return v;
    return d.toLocaleString();
  }
}
