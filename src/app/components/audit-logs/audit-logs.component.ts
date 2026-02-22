import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  signal,
  inject,
  OnChanges,
  SimpleChanges,
} from '@angular/core';

import {
  ApiAuditLog,
  ApiAuditChange,
  AuditLogsServiceService,
} from '../../services/audit-logs/audit-logs-service.service';

type IdName = { id: number; name?: string | null; fullName?: string | null };

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './audit-logs.component.html',
  styleUrls: ['./audit-logs.component.scss'],
})
export class AuditLogsComponent implements OnChanges {
  private api = inject(AuditLogsServiceService);

  @Input({ required: true }) entity!: string;
  @Input({ required: true }) entityId!: number;
  @Input() title = 'Audit Logs';
  @Input() limit = 15;

  // ✅ NEW: Lists to resolve Ids -> Names (optional)
  @Input() users: IdName[] = [];   // ApiUser[] works
  @Input() clients: IdName[] = []; // ApiClient[] works
  @Input() hubs: IdName[] = [];    // optional
  @Input() zones: IdName[] = [];   // optional

  @Output() close = new EventEmitter<void>();

  readonly loading = signal<boolean>(true);
  readonly error = signal<string>('');
  readonly items = signal<ApiAuditLog[]>([]);
  readonly hasItems = computed(() => (this.items()?.length || 0) > 0);

  private usersById = new Map<number, string>();
  private clientsById = new Map<number, string>();
  private hubsById = new Map<number, string>();
  private zonesById = new Map<number, string>();

  ngOnChanges(changes: SimpleChanges): void {
    // ✅ rebuild lookups if lists changed
    if (changes['users'] || changes['clients'] || changes['hubs'] || changes['zones']) {
      this.rebuildLookups();
    }

    if (!this.entity || !this.entityId) return;

    const shouldFetch =
      !!changes['entity'] || !!changes['entityId'] || !!changes['limit'];

    if (shouldFetch) {
      this.fetch(this.entity, this.entityId, this.limit);
    }
  }

  private rebuildLookups(): void {
    this.usersById.clear();
    this.clientsById.clear();
    this.hubsById.clear();
    this.zonesById.clear();

    for (const u of this.users || []) {
      const label = String(u.fullName || u.name || '').trim();
      if (u?.id != null && label) this.usersById.set(u.id, label);
    }
    for (const c of this.clients || []) {
      const label = String(c.name || '').trim();
      if (c?.id != null && label) this.clientsById.set(c.id, label);
    }
    for (const h of this.hubs || []) {
      const label = String(h.name || '').trim();
      if (h?.id != null && label) this.hubsById.set(h.id, label);
    }
    for (const z of this.zones || []) {
      const label = String(z.name || '').trim();
      if (z?.id != null && label) this.zonesById.set(z.id, label);
    }
  }

  fetch(entity: string, entityId: number, limit: number) {
    this.loading.set(true);
    this.error.set('');

    this.api.getLogs({ entity, entityId, limit }).subscribe({
      next: (res) => {
        const normalized = this.normalizeLogs(res?.items || []);
        this.items.set(normalized);
        this.loading.set(false);
      },
      error: (err: any) => {
        console.error('Failed to load audit logs', err);
        this.items.set([]);
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Failed to load audit logs');
      },
    });
  }

  onBackdropClick(ev: MouseEvent) {
    if ((ev.target as HTMLElement)?.classList?.contains('modal-backdrop')) {
      this.close.emit();
    }
  }

  formatDate(value?: string) {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;

    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d);
  }

  actorDisplay(it: ApiAuditLog): string {
    return (
      it.actorName ||
      it.actor?.fullName ||
      (it.actorId != null ? `#${it.actorId}` : 'System')
    );
  }

  actionBadgeClass(action: string) {
    const a = (action || '').toUpperCase();
    if (a === 'CREATE') return 'badge badge--create';
    if (a === 'UPDATE') return 'badge badge--update';
    if (a === 'DELETE') return 'badge badge--delete';
    if (a.includes('INVENTORY')) return 'badge badge--inventory';
    return 'badge badge--neutral';
  }

  prettyAction(action: string) {
    const a = (action || '').toUpperCase();
    if (a === 'CREATE') return 'CREATE';
    if (a === 'UPDATE') return 'UPDATE';
    if (a === 'DELETE') return 'DELETE';
    if (a === 'INVENTORY_DECREMENT') return 'INVENTORY';
    return action || '-';
  }

  visibleChanges(it: ApiAuditLog): ApiAuditChange[] {
    const list = Array.isArray(it.changeList) ? it.changeList : [];
    return list.filter((c) => !!c?.field && c.field !== '__before__' && c.field !== '__after__');
  }

  hasVisibleChanges(it: ApiAuditLog): boolean {
    return this.visibleChanges(it).length > 0;
  }

  fieldLabel(entity: string, field: string): string {
    const map: Record<string, Record<string, string>> = {
      Interview: {
        accountManagerId: 'Account Manager',
        interviewerId: 'Interviewer',
        clientId: 'Client',
        hubId: 'Hub',
        zoneId: 'Zone',
        date: 'Date',
      },
    };
    return map?.[entity]?.[field] || field;
  }

  // ✅ هنا السحر: لو القيمة Id نعرض الاسم
  valuePreview(v: any, field?: string): string {
    if (v === null || v === undefined || v === '') return '—';

    const resolved = this.resolveIdToName(field || '', v);
    if (resolved) return resolved;

    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);

    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }

  private resolveIdToName(field: string, raw: any): string | null {
    const f = (field || '').trim();
    if (!f) return null;

    const n =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw))
          ? Number(raw)
          : null;

    if (n == null) return null;

    const key = f.toLowerCase().replace(/[_\s]+/g, '');

    // Interview user refs
    if (key === 'accountmanagerid' || key === 'interviewerid') {
      return this.usersById.get(n) || `#${n}`;
    }

    // Generic refs (لو حبيت)
    if (key === 'clientid') return this.clientsById.get(n) || `#${n}`;
    if (key === 'hubid') return this.hubsById.get(n) || `#${n}`;
    if (key === 'zoneid') return this.zonesById.get(n) || `#${n}`;

    return null;
  }

  // ===== normalizeLogs (زي اللي عندك) =====
  private normalizeLogs(items: ApiAuditLog[]): ApiAuditLog[] {
    return (items || []).map((it) => {
      if (Array.isArray(it.changeList) && it.changeList.length) return it;

      const parsedChanges = this.parseChanges(it.changes);
      const before = (parsedChanges as any)?.before;
      const after = (parsedChanges as any)?.after;

      if (before && after && typeof before === 'object' && typeof after === 'object') {
        const list = this.diffBeforeAfter(before, after);
        return { ...it, changes: parsedChanges, changeList: list };
      }

      return { ...it, changes: parsedChanges };
    });
  }

  private parseChanges(raw: any): any {
    if (raw == null) return null;
    if (typeof raw === 'string') {
      const s = raw.trim();
      if (!s) return null;
      try {
        return JSON.parse(s);
      } catch {
        return raw;
      }
    }
    return raw;
  }

  private diffBeforeAfter(before: any, after: any): ApiAuditChange[] {
    const b = before && typeof before === 'object' ? before : {};
    const a = after && typeof after === 'object' ? after : {};

    const ignored = new Set<string>(['updatedAt', 'createdAt', 'deletedAt']);
    const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)])).filter(
      (k) => !ignored.has(k),
    );

    const list: ApiAuditChange[] = [];
    for (const k of keys) {
      if (!this.deepEqual(b[k], a[k])) {
        list.push({ field: k, before: b[k], after: a[k] });
      }
    }
    return list;
  }

  private deepEqual(x: any, y: any): boolean {
    if (x === y) return true;
    if (x == null || y == null) return x === y;
    if (typeof x !== typeof y) return false;
    if (typeof x !== 'object') return String(x) === String(y);

    try {
      return JSON.stringify(x) === JSON.stringify(y);
    } catch {
      return false;
    }
  }
}
