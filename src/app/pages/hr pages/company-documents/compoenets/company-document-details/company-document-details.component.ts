import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import {
  CompanyDocumentsService,
  CompanyDocument,
  CompanyDocStatus,
} from '../../../../../services/company-documents/company-documents.service';

type LoadState = 'loading' | 'success' | 'error';
type ExpiryChipClass = 'chip--ok' | 'chip--soon' | 'chip--expired' | 'chip--unknown';

@Component({
  selector: 'app-company-document-details-page',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './company-document-details.component.html',
  styleUrls: ['./company-document-details.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanyDocumentDetailsComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private svc = inject(CompanyDocumentsService);

  state = signal<LoadState>('loading');
  errorMsg = signal<string>('');
  doc = signal<CompanyDocument | null>(null);

  // default fallback if API doesn't provide soonDays
  private readonly SOON_DAYS = 30;

  ngOnInit() {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam ? Number(idParam) : NaN;

    if (Number.isNaN(id)) {
      this.router.navigate(['/hr/company-documents']);
      return;
    }

    this.load(id);
  }

  load(id: number) {
    this.state.set('loading');
    this.errorMsg.set('');

    this.svc.getById(id).subscribe({
      next: (row: CompanyDocument) => {
        this.doc.set(this.enrich(row));
        this.state.set('success');
      },
      error: (err) => {
        this.state.set('error');
        this.errorMsg.set(err?.message || 'Document not found or failed to load.');
      },
    });
  }

  back() {
    this.router.navigate(['/hr/company-documents']);
  }

  // ========= UI helpers =========

  initials(row: CompanyDocument): string {
    const base =
      row.type?.nameEn ||
      row.type?.nameAr ||
      row.type?.name ||
      row.type?.code ||
      row.company?.code ||
      row.documentNumber ||
      'D';

    const s = String(base).trim();
    if (!s) return '?';
    const parts = s.split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
    return (first + last).toUpperCase() || s.slice(0, 2).toUpperCase();
  }

  displayType(row: CompanyDocument): string {
    return row.type?.nameEn || row.type?.name || row.type?.code || 'Document';
  }

  displayCompany(row: CompanyDocument): string {
    const code = row.company?.code || '—';
    const name = row.company?.name || 'Company';
    return `${code} — ${name}`;
  }

  // format any date-like string to readable
  fmt(dateStr?: string | null): string {
    const d = this.parseAnyDate(dateStr);
    if (!d) return dateStr?.trim() ? String(dateStr) : '—';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  statusClass(row: CompanyDocument): string {
    const s = (row.computed?.status || 'ONGOING') as CompanyDocStatus;
    if (s === 'ACTIVE') return 'status-pill--active';
    if (s === 'EXPIRING_SOON') return 'status-pill--soon';
    if (s === 'EXPIRED') return 'status-pill--expired';
    if (s === 'ONGOING') return 'status-pill--ongoing';
    return 'status-pill--ongoing';
  }

  statusLabel(row: CompanyDocument): string {
    const s = (row.computed?.status || 'ONGOING') as CompanyDocStatus;
    if (s === 'ACTIVE') return 'Active';
    if (s === 'EXPIRING_SOON') return 'Expiring Soon';
    if (s === 'EXPIRED') return 'Expired';
    return 'Ongoing';
  }

  computedExpiry(row: CompanyDocument): string | null {
    const v =
      row.computed?.computedExpiryDate ||
      row.expiryDate ||
      this.deriveExpiryFromIssue(row.issueDate, row.validityYears);

    const s = (v ?? '').toString().trim();
    return s ? s : null;
  }

  private deriveExpiryFromIssue(issueDate?: string | null, validityYears?: number | null): string | null {
    const raw = (issueDate ?? '').trim();
    if (!raw || !validityYears || validityYears <= 0) return null;
    const d = this.parseAnyDate(raw);
    if (!d) return null;
    const x = new Date(d);
    x.setFullYear(x.getFullYear() + validityYears);
    return this.toYmd(x);
  }

  async copyToClipboard(text?: string | null): Promise<void> {
    const value = (text ?? '').trim();
    if (!value) return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return;
      }
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch {}
  }

  getDaysLeft(dateStr?: string | null): number | null {
    const d = this.parseAnyDate(dateStr);
    if (!d) return null;
    const today = this.startOfDay(new Date());
    const target = this.startOfDay(d);
    const diffMs = target.getTime() - today.getTime();
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

  private statusLabelArFrom(status: CompanyDocStatus): string {
    if (status === 'ACTIVE') return 'سارية';
    if (status === 'EXPIRING_SOON') return 'قارب الانتهاء';
    if (status === 'EXPIRED') return 'منتهية';
    return 'مستمر';
  }

  private enrich(row: CompanyDocument): CompanyDocument {
    const exp = this.computedExpiry(row);
    const days = this.getDaysLeft(exp);

    const derivedStatus: CompanyDocStatus =
      days === null ? 'ONGOING' :
      days < 0 ? 'EXPIRED' :
      days <= this.SOON_DAYS ? 'EXPIRING_SOON' :
      'ACTIVE';

    const finalStatus: CompanyDocStatus = (row.computed?.status as CompanyDocStatus) ?? derivedStatus;

    return {
      ...row,
      computed: {
        ...(row.computed || {}),
        computedExpiryDate: exp,
        remainingDays: days,
        status: finalStatus,
        statusLabelAr: row.computed?.statusLabelAr ?? this.statusLabelArFrom(finalStatus),
        soonDays: row.computed?.soonDays ?? this.SOON_DAYS,
      },
    };
  }

  private parseAnyDate(dateStr?: string | null): Date | null {
    const raw = (dateStr ?? '').trim();
    if (!raw) return null;

    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      const dt = new Date(y, mo - 1, d);
      if (dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d) return dt;
      return null;
    }

    const t = Date.parse(raw);
    if (Number.isNaN(t)) return null;
    return new Date(t);
  }

  private startOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  private toYmd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
