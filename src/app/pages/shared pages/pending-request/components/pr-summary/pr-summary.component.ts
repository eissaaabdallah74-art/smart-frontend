// src/app/pages/shared pages/pending-request/components/pr-summary/pr-summary.component.ts
import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

import type { ApiClient } from '../../../../../services/clients/clients-service.service';
import type {
  VehicleType,
} from '../../../../../services/pending request/pending-request-service.service';

import type { PendingRequestVM } from '../pending-request.types';

interface SummaryRow {
  date: string;
  clientId: number;
  accountName: string;
  counts: Partial<Record<VehicleType, number>>;
  total: number;
}

@Component({
  selector: 'app-pr-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pr-summary.component.html',
  styleUrls: ['./pr-summary.component.scss'],
})
export class PrSummaryComponent implements OnChanges {
  // ===== Inputs from parent =====
  @Input() rows: PendingRequestVM[] = [];
  @Input() clients: ApiClient[] = [];

  @Input() vehicleTypes: { value: VehicleType; label: string }[] = [];
  @Input() vehicleTypeColumns: VehicleType[] = [];

  // ===== Computed summary =====
  summaryRows: SummaryRow[] = [];
  summaryGrandTotals: { counts: Partial<Record<VehicleType, number>>; total: number } = {
    counts: {},
    total: 0,
  };

  summaryLastUpdatedAt: string | null = null;
  todayDate = this.formatLocalYmd(new Date());

  ngOnChanges(): void {
    this.todayDate = this.formatLocalYmd(new Date());
    this.buildSummary();
  }

  private buildSummary(): void {
    const rowsSrc = this.rows || [];

    // compute last updated
    let bestMs = 0;
    let best: PendingRequestVM | null = null;

    // build per-client rows
    const map = new Map<number, SummaryRow>();

    for (const r of rowsSrc) {
      const clientId = Number(r.clientId);
      if (!clientId) continue;

      // last updated selection
      const ms = this.getBestMs(r);
      if (ms > bestMs) {
        bestMs = ms;
        best = r;
      }

      let row = map.get(clientId);
      if (!row) {
        row = {
          date: this.todayDate,
          clientId,
          accountName: this.resolveAccountName(clientId, r),
          counts: this.initCounts(),
          total: 0,
        };
        map.set(clientId, row);
      }

      for (const it of r.items || []) {
        const t = it.vehicleType as VehicleType;
        const cnt = Number(it.vehicleCount || 0);
        if (!t || cnt <= 0) continue;

        row.counts[t] = Number(row.counts[t] || 0) + cnt;
        row.total += cnt;
      }
    }

    const out = Array.from(map.values());
    out.sort((a, b) => (a.accountName || '').localeCompare(b.accountName || ''));
    this.summaryRows = out;

    // grand totals
    this.summaryGrandTotals = this.computeGrandTotals();

    // last updated label
    this.summaryLastUpdatedAt = best?.updatedAt ?? best?.createdAt ?? null;
  }

  private computeGrandTotals(): { counts: Partial<Record<VehicleType, number>>; total: number } {
    const totals = this.initCounts();
    let total = 0;

    for (const r of this.summaryRows) {
      for (const t of this.vehicleTypeColumns) {
        totals[t] = Number(totals[t] || 0) + Number(r.counts[t] || 0);
      }
      total += Number(r.total || 0);
    }

    return { counts: totals, total };
  }

  // ===== TrackBy =====
  trackByClientId(_i: number, row: SummaryRow): number {
    return row.clientId;
  }

  // ===== Labels =====
  getVehicleLabel(t: VehicleType): string {
    return this.vehicleTypes.find((x) => x.value === t)?.label || t;
  }

  get lastUpdateLabel(): string {
    return this.formatIsoDateTime(this.summaryLastUpdatedAt);
  }

  // ===== Summary helpers =====
  private initCounts(): Partial<Record<VehicleType, number>> {
    const obj: Partial<Record<VehicleType, number>> = {};
    for (const t of this.vehicleTypeColumns) obj[t] = 0;
    return obj;
  }

  private parseMs(value?: string | null): number {
    if (!value) return 0;
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : 0;
  }

  private getBestMs(r: PendingRequestVM): number {
    return (
      this.parseMs(r.updatedAt) ||
      this.parseMs(r.createdAt) ||
      this.parseMs(r.requestDate) ||
      0
    );
  }

  private resolveAccountName(clientId: number, latestReq?: PendingRequestVM): string {
    const fromReq = latestReq?.client?.name;
    if (fromReq) return fromReq;

    const fromClients = (this.clients?.find((c) => c.id === clientId) as any)?.name;
    if (fromClients) return fromClients;

    return `Client #${clientId}`;
  }

  // ===== Date helpers =====
  private formatLocalYmd(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  formatIsoDateTime(iso?: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  }
}