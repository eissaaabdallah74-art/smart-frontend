// src/app/services/calls report/calls-report-service.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { map } from 'rxjs/operators';

export interface ReportAssignee {
  id: number;
  fullName: string;
  email: string;
  position?: 'manager' | 'supervisor' | 'senior' | 'junior' | null;
  isActive: boolean;
}

/* ======================
   ===== Calls Report ====
   ====================== */

export type DetailsType = 'all' | 'completed' | 'converted';

export interface OperationReportDetailItem {
  phone: string;
  name: string | null;
  callId: number;
  callDate: string | null; // yyyy-MM-dd
  source: string;
  interviewDates?: string[];
}

export interface OperationReportDetails {
  completed: OperationReportDetailItem[];
  converted: OperationReportDetailItem[];
}

export interface OperationReportRow {
  assignee: ReportAssignee;
  completedCalls: number;
  convertedCalls: number;
  conversionRate: number;
  uniquePhonesCompleted: number;
  uniqueConvertedPhones: number;
  details?: OperationReportDetails;
}

export interface OperationReportResponse {
  range: { from: string; to: string; windowDays: number };
  totals: {
    completedCalls: number;
    convertedCalls: number;
    uniquePhonesCompleted: number;
    uniqueConvertedPhones: number;
  };
  rows: OperationReportRow[];
}

/* ==============================
   ===== Achievement Report ======
   ============================== */

export interface AchievementColumn {
  key: string;
  label: string;
}

export interface AchievementReportRow {
  assignee: ReportAssignee;
  metrics: Record<string, number>;
}

export interface AchievementReportResponse {
  range: { from: string; to: string };
  columns: AchievementColumn[];
  totals: Record<string, number>;
  rows: AchievementReportRow[];
}

/* =========================================
   ✅ Fulfillment (Account Managers) Report
   ========================================= */

export interface FulfillmentTotals {
  fulfilled: number;
  companyA: number;
  companyB: number;
}

export interface FulfillmentAccountManager {
  id: number | null;
  fullName: string;
  email: string | null;
  role?: string | null;
  position?: string | null;
  isActive?: boolean | null;
}

export interface FulfillmentClientRef {
  id: number;
  name: string | null;
  company?: string | null;
}

export interface FulfillmentHubRef {
  id: number;
  name: string | null;
}

export interface FulfillmentZoneRef {
  id: number;
  name: string | null;
}

export interface FulfillmentRequestInfo {
  id: number;
  requestDate: string | null;
  status: string | null;
  priority: string | null;
  billingMonth: string | null;
  client: FulfillmentClientRef | null;
  hub: FulfillmentHubRef | null;
  zone: FulfillmentZoneRef | null;
}

export interface FulfillmentItemInfo {
  id: number;
  vehicleType: string | null;
  remainingVehicleCount: number;
}

export interface FulfillmentInterviewDetail {
  interviewId: number;
  courierName: string | null;
  phoneNumber: string | null;
  vehicleType: string | null;
  courierStatus: string | null;
  inventoryAppliedAt: string | null;
}

export interface FulfillmentRequestBucket {
  pendingRequestId: number | null;
  pendingRequestItemId: number | null;
  request: FulfillmentRequestInfo | null;
  item: FulfillmentItemInfo | null;
  fulfilled: number;
  details?: FulfillmentInterviewDetail[];
}

export interface FulfillmentWeek {
  weekStart: string;
  weekEnd: string;
  totals: FulfillmentTotals;
  requests: FulfillmentRequestBucket[];
}

export interface FulfillmentRow {
  accountManager: FulfillmentAccountManager;
  totals: FulfillmentTotals;
  weeks: FulfillmentWeek[];
}

export interface FulfillmentReportResponse {
  range: { from: string; to: string };
  totals: FulfillmentTotals;
  rows: FulfillmentRow[];
}

@Injectable({ providedIn: 'root' })
export class OperationsTeamReportService {
  private http = inject(HttpClient);

  private callsReportUrl = `${environment.apiUrl}/reports/operation-calls-interviews`;
  private achievementsReportUrl = `${environment.apiUrl}/reports/operation-achievements`;

  // ✅ NEW
  private fulfillmentUrl = `${environment.apiUrl}/reports/account-managers-fulfillment`;

  /** Calls report */
  getCallsReport(params?: {
    from?: string;
    to?: string;
    windowDays?: number;
    includeInactive?: boolean;

    includeDetails?: boolean;
    detailsLimit?: number;
    detailsType?: DetailsType;
    assigneeId?: number;
  }) {
    let httpParams = new HttpParams();

    if (params?.from) httpParams = httpParams.set('from', params.from);
    if (params?.to) httpParams = httpParams.set('to', params.to);

    if (params?.windowDays != null) {
      httpParams = httpParams.set('windowDays', String(params.windowDays));
    }

    if (params?.includeInactive) {
      httpParams = httpParams.set('includeInactive', '1');
    }

    if (params?.assigneeId != null) {
      httpParams = httpParams.set('assigneeId', String(params.assigneeId));
    }

    if (params?.includeDetails) {
      httpParams = httpParams.set('includeDetails', '1');

      if (params?.detailsLimit != null) {
        httpParams = httpParams.set('detailsLimit', String(params.detailsLimit));
      }

      if (params?.detailsType) {
        httpParams = httpParams.set('detailsType', params.detailsType);
      }
    }

    return this.http.get<OperationReportResponse>(this.callsReportUrl, {
      params: httpParams,
    });
  }

  /** Backward-compatible alias */
  getReport(params?: Parameters<OperationsTeamReportService['getCallsReport']>[0]) {
    return this.getCallsReport(params);
  }

  /** Achievements report */
  getAchievementsReport(params?: {
    from?: string;
    to?: string;
    includeInactive?: boolean;
    assigneeId?: number;
  }) {
    let httpParams = new HttpParams();

    if (params?.from) httpParams = httpParams.set('from', params.from);
    if (params?.to) httpParams = httpParams.set('to', params.to);

    if (params?.includeInactive) {
      httpParams = httpParams.set('includeInactive', '1');
    }

    if (params?.assigneeId != null) {
      httpParams = httpParams.set('assigneeId', String(params.assigneeId));
    }

    return this.http.get<any>(this.achievementsReportUrl, { params: httpParams }).pipe(
      map((raw) => this.normalizeAchievementResponse(raw))
    );
  }

  /** Backward-compatible alias */
  getAchievementReport(
    params?: Parameters<OperationsTeamReportService['getAchievementsReport']>[0]
  ) {
    return this.getAchievementsReport(params);
  }

  private normalizeAchievementResponse(raw: any): AchievementReportResponse {
    const safeObj = (x: any) => (x && typeof x === 'object' ? x : {});
    const safeArr = (x: any) => (Array.isArray(x) ? x : []);

    const rangeRaw = safeObj(raw?.range);
    const totalsRaw = safeObj(raw?.totals?.metrics ?? raw?.totals);
    const rowsRaw = safeArr(raw?.rows);

    const totals: Record<string, number> = {};
    for (const k of Object.keys(totalsRaw)) {
      const v = Number(totalsRaw[k]);
      totals[k] = Number.isFinite(v) ? v : 0;
    }

    const columnsFromApi = safeArr(raw?.columns)
      .map((c: any) => ({
        key: String(c?.key ?? ''),
        label: String(c?.label ?? c?.key ?? ''),
      }))
      .filter((c: AchievementColumn) => !!c.key);

    const columns: AchievementColumn[] =
      columnsFromApi.length > 0
        ? columnsFromApi
        : Object.keys(totals).map((k) => ({ key: k, label: k }));

    const rows: AchievementReportRow[] = rowsRaw.map((r: any) => {
      const metricsRaw = safeObj(r?.metrics);
      const metrics: Record<string, number> = {};
      for (const c of columns) {
        const v = Number(metricsRaw?.[c.key]);
        metrics[c.key] = Number.isFinite(v) ? v : 0;
      }
      return {
        assignee: r?.assignee,
        metrics,
      };
    });

    return {
      range: {
        from: String(rangeRaw?.from ?? ''),
        to: String(rangeRaw?.to ?? ''),
      },
      columns,
      totals,
      rows,
    };
  }

  /** ✅ Fulfillment report */
  getFulfillmentReport(params?: {
    from?: string;
    to?: string;
    accountManagerId?: number;

    includeDetails?: boolean;
    detailsLimit?: number;
  }) {
    let httpParams = new HttpParams();

    if (params?.from) httpParams = httpParams.set('from', params.from);
    if (params?.to) httpParams = httpParams.set('to', params.to);

    if (params?.accountManagerId != null) {
      httpParams = httpParams.set('accountManagerId', String(params.accountManagerId));
    }

    if (params?.includeDetails) {
      httpParams = httpParams.set('includeDetails', '1');
      if (params?.detailsLimit != null) {
        httpParams = httpParams.set('detailsLimit', String(params.detailsLimit));
      }
    }

    return this.http.get<FulfillmentReportResponse>(this.fulfillmentUrl, {
      params: httpParams,
    });
  }
}
