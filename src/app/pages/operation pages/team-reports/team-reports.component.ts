// src/app/pages/.../team-reports/team-reports.component.ts
import { Component, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../../services/auth/auth-service.service';
import { ExportButtonComponent } from '../../../shared/export-button/export-button';
import { OperationsTeamReportService, OperationReportResponse, OperationReportRow, AchievementReportResponse, AchievementReportRow, AchievementColumn, OperationReportDetailItem, DetailsType, FulfillmentReportResponse, FulfillmentRow } from '../../../services/calls report/calls-report-service.service';



type SelectedKey = 'all' | number | 'unassigned';
type ActiveTab = 'calls' | 'achievements' | 'fulfillment';
type DetailsTab = 'completed' | 'converted';

@Component({
  selector: 'app-team-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, ExportButtonComponent],
  templateUrl: './team-reports.component.html',
  styleUrls: ['./team-reports.component.scss'],
})
export class TeamReportsComponent implements OnInit {
  private auth = inject(AuthService);
  private api = inject(OperationsTeamReportService);

  activeTab: ActiveTab = 'calls';

  // ✅ فصل الـ selection لكل tab
  private selectedByTab: Record<ActiveTab, SelectedKey> = {
    calls: 'all',
    achievements: 'all',
    fulfillment: 'all',
  };

  selected: SelectedKey = 'all';

  loadingCalls = false;
  loadingAchievements = false;
  loadingFulfillment = false;

  errorCalls = '';
  errorAchievements = '';
  errorFulfillment = '';

  // ===== Calls =====
  report: OperationReportResponse | null = null;
  rows: OperationReportRow[] = [];

  // ===== Achievements (Operation statuses) =====
  achievementReport: AchievementReportResponse | null = null;
  achievementRows: AchievementReportRow[] = [];
  achievementColumns: AchievementColumn[] = [];

  // ===== Fulfillment (Account Managers) =====
  fulfillmentReport: FulfillmentReportResponse | null = null;
  fulfillmentRows: FulfillmentRow[] = [];

  // ===== Shared Filters =====
  filterFromDate: string | null = null; // yyyy-MM-dd
  filterToDate: string | null = null; // yyyy-MM-dd
  windowDays = 14; // Calls only
  includeInactive = false; // team mode only (calls/achievements)

  // Fulfillment details (optional fetch for selected manager)
  fulfillmentIncludeDetails = false;
  fulfillmentDetailsLimit = 200;
  fulfillmentDetailsLoading = false;
  fulfillmentDetailsError = '';

  // Week accordion state (fulfillment)
  openWeekStart: string | null = null;

  currentUser = computed(() => this.auth.currentUser());

  isTeamMode = computed(() => {
    const u = this.currentUser();
    if (!u) return false;

    if (u.role === 'admin') return true;

    return (
      u.role === 'operation' &&
      (u.position === 'manager' || u.position === 'supervisor')
    );
  });

  get loading(): boolean {
    if (this.activeTab === 'calls') return this.loadingCalls;
    if (this.activeTab === 'achievements') return this.loadingAchievements;
    return this.loadingFulfillment;
  }

  get errorMsg(): string {
    if (this.activeTab === 'calls') return this.errorCalls;
    if (this.activeTab === 'achievements') return this.errorAchievements;
    return this.errorFulfillment;
  }

  // ===== Selected rows =====
  get selectedRow(): OperationReportRow | null {
    if (this.selected === 'all' || this.selected === 'unassigned') return null;
    return this.rows.find((r) => r.assignee.id === this.selected) || null;
  }

  get selectedAchievementRow(): AchievementReportRow | null {
    if (this.selected === 'all' || this.selected === 'unassigned') return null;
    return this.achievementRows.find((r) => r.assignee.id === this.selected) || null;
  }

  get selectedFulfillmentRow(): FulfillmentRow | null {
    if (this.selected === 'all') return null;

    if (this.selected === 'unassigned') {
      return this.fulfillmentRows.find((r) => r.accountManager?.id == null) || null;
    }

    return (
      this.fulfillmentRows.find((r) => r.accountManager?.id === this.selected) ||
      null
    );
  }

  // =========================
  // ===== Calls Details Modal
  // =========================
  detailsOpen = false;
  detailsLoading = false;
  detailsError = '';

  detailsTab: DetailsTab = 'completed';
  detailsLimit = 100;
  detailsSearch = '';

  detailsCompleted: OperationReportDetailItem[] = [];
  detailsConverted: OperationReportDetailItem[] = [];

  get canShowDetails(): boolean {
    return (
      this.activeTab === 'calls' &&
      this.isTeamMode() &&
      this.selected !== 'all' &&
      this.selected !== 'unassigned' &&
      !!this.selectedRow
    );
  }

  get filteredDetailsList(): OperationReportDetailItem[] {
    const term = (this.detailsSearch || '').toLowerCase().trim();
    const list =
      this.detailsTab === 'completed'
        ? this.detailsCompleted
        : this.detailsConverted;

    if (!term) return list;

    return list.filter((x) => {
      const phone = (x.phone || '').toLowerCase();
      const name = (x.name || '').toLowerCase();
      return phone.includes(term) || name.includes(term);
    });
  }

  openDetailsModal(tab?: DetailsTab): void {
    if (!this.canShowDetails) return;

    this.detailsError = '';
    this.detailsSearch = '';
    this.detailsTab = tab || 'completed';

    const sr = this.selectedRow;
    const cached = sr?.details;

    this.detailsCompleted = cached?.completed || [];
    this.detailsConverted = cached?.converted || [];

    this.detailsOpen = true;

    if (!cached || (!this.detailsCompleted.length && !this.detailsConverted.length)) {
      this.loadSelectedDetails();
    }
  }

  closeDetailsModal(): void {
    this.detailsOpen = false;
    this.detailsLoading = false;
    this.detailsError = '';
    this.detailsSearch = '';
  }

  setDetailsTab(t: DetailsTab): void {
    this.detailsTab = t;
  }

  onDetailsLimitChange(v: string): void {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return;
    this.detailsLimit = Math.max(10, Math.min(500, n));
  }

  reloadDetails(): void {
    if (!this.canShowDetails) return;
    this.loadSelectedDetails(true);
  }

  private loadSelectedDetails(force = false): void {
    const sr = this.selectedRow;
    if (!sr) return;

    if (
      !force &&
      sr.details &&
      (sr.details.completed?.length || sr.details.converted?.length)
    ) {
      this.detailsCompleted = sr.details.completed || [];
      this.detailsConverted = sr.details.converted || [];
      return;
    }

    this.detailsLoading = true;
    this.detailsError = '';

    const detailsType: DetailsType = 'all';

    this.api
      .getCallsReport({
        from: this.filterFromDate || undefined,
        to: this.filterToDate || undefined,
        windowDays: this.windowDays || 14,
        includeInactive: this.includeInactive,
        assigneeId: sr.assignee.id,

        includeDetails: true,
        detailsLimit: this.detailsLimit,
        detailsType,
      })
      .subscribe({
        next: (res) => {
          const row = (res?.rows || [])[0];
          const details = row?.details;

          this.detailsCompleted = details?.completed || [];
          this.detailsConverted = details?.converted || [];

          if (row?.assignee?.id != null) {
            this.rows = this.rows.map((r) => {
              if (r.assignee.id !== row.assignee.id) return r;
              return { ...r, details: details || { completed: [], converted: [] } };
            });
          }

          this.detailsLoading = false;
        },
        error: (err) => {
          console.error('[TeamReports] loadSelectedDetails error', err);
          this.detailsError = 'Failed to load details';
          this.detailsLoading = false;
        },
      });
  }

  async copyPhone(phone: string): Promise<void> {
    const v = String(phone || '').trim();
    if (!v) return;

    try {
      await navigator.clipboard.writeText(v);
      alert('Copied');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = v;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      alert('Copied');
    }
  }

  // =====================
  // ===== Stats (Calls)
  // =====================
  get currentStats(): {
    completedCalls: number;
    convertedCalls: number;
    conversionRate: number;
    uniquePhonesCompleted: number;
    uniqueConvertedPhones: number;
  } {
    if (!this.report) {
      return {
        completedCalls: 0,
        convertedCalls: 0,
        conversionRate: 0,
        uniquePhonesCompleted: 0,
        uniqueConvertedPhones: 0,
      };
    }

    if (this.selected === 'all') {
      const c = this.report.totals.completedCalls || 0;
      const i = this.report.totals.convertedCalls || 0;
      return {
        completedCalls: c,
        convertedCalls: i,
        conversionRate: c ? i / c : 0,
        uniquePhonesCompleted: this.report.totals.uniquePhonesCompleted || 0,
        uniqueConvertedPhones: this.report.totals.uniqueConvertedPhones || 0,
      };
    }

    const r = this.selectedRow;
    if (!r) {
      return {
        completedCalls: 0,
        convertedCalls: 0,
        conversionRate: 0,
        uniquePhonesCompleted: 0,
        uniqueConvertedPhones: 0,
      };
    }

    return {
      completedCalls: r.completedCalls || 0,
      convertedCalls: r.convertedCalls || 0,
      conversionRate: r.conversionRate || 0,
      uniquePhonesCompleted: r.uniquePhonesCompleted || 0,
      uniqueConvertedPhones: r.uniqueConvertedPhones || 0,
    };
  }

  // =====================
  // ===== Cards (Achievements)
  // =====================
  get achievementCards(): { label: string; value: number }[] {
    if (!this.achievementReport) return [];

    const source =
      this.selected === 'all'
        ? this.achievementReport.totals
        : this.selectedAchievementRow?.metrics || {};

    return this.achievementColumns.map((c) => ({
      label: c.label,
      value: Number(source[c.key] || 0),
    }));
  }

  // =====================
  // ===== Cards (Fulfillment)
  // =====================
  get fulfillmentCards(): { label: string; value: number }[] {
    const rep = this.fulfillmentReport;
    if (!rep) return [];

    const src =
      this.selected === 'all'
        ? rep.totals
        : this.selectedFulfillmentRow?.totals || { fulfilled: 0, companyA: 0, companyB: 0 };

    return [
      { label: 'Fulfilled', value: Number(src.fulfilled || 0) },
      { label: 'Company A', value: Number(src.companyA || 0) },
      { label: 'Company B', value: Number(src.companyB || 0) },
    ];
  }

  // =====================
  // ===== Export
  // =====================
  get exportData(): any[] {
    return this.rows.map((r) => ({
      Staff: r.assignee.fullName,
      Email: r.assignee.email,
      Position: r.assignee.position || '',
      Active: r.assignee.isActive ? 'Yes' : 'No',
      Completed: r.completedCalls,
      Converted: r.convertedCalls,
      Rate: Number((r.conversionRate * 100).toFixed(2)) + '%',
      'Unique phones (C)': r.uniquePhonesCompleted,
      'Unique phones (I)': r.uniqueConvertedPhones,
    }));
  }

  get achievementExportData(): any[] {
    const cols = this.achievementColumns;
    return this.achievementRows.map((r) => {
      const base: any = {
        Staff: r.assignee.fullName,
        Email: r.assignee.email,
        Position: r.assignee.position || '',
        Active: r.assignee.isActive ? 'Yes' : 'No',
      };
      for (const c of cols) base[c.label] = Number(r.metrics[c.key] || 0);
      return base;
    });
  }

  get fulfillmentExportData(): any[] {
    return this.fulfillmentRows.map((r) => ({
      'Account Manager': r.accountManager?.fullName || 'Unassigned',
      Email: r.accountManager?.email || '',
      Position: r.accountManager?.position || '',
      Fulfilled: Number(r.totals?.fulfilled || 0),
      'Company A': Number(r.totals?.companyA || 0),
      'Company B': Number(r.totals?.companyB || 0),
    }));
  }

  ngOnInit(): void {
    const u = this.currentUser();
    if (!u) return;

    const { from, to } = this.defaultLast30Days();
    this.filterFromDate = from;
    this.filterToDate = to;

    if (!this.isTeamMode()) {
      // single mode
      this.selectedByTab.calls = u.id;
      this.selectedByTab.achievements = u.id;
      this.selectedByTab.fulfillment = u.id;
      this.selected = u.id;
      this.includeInactive = false;
    } else {
      this.selectedByTab.calls = 'all';
      this.selectedByTab.achievements = 'all';
      this.selectedByTab.fulfillment = 'all';
      this.selected = 'all';
    }

    this.loadCallsReport();
    this.loadAchievementReport();
    this.loadFulfillmentReport();
  }

  onTab(tab: ActiveTab): void {
    // احفظ selection الحالي
    this.selectedByTab[this.activeTab] = this.selected;

    this.activeTab = tab;

    // رجّع selection للتاب الجديد
    this.selected = this.selectedByTab[tab] ?? 'all';

    // single mode enforced
    const u = this.currentUser();
    if (!this.isTeamMode() && u) {
      this.selected = u.id;
      this.selectedByTab.calls = u.id;
      this.selectedByTab.achievements = u.id;
      this.selectedByTab.fulfillment = u.id;
    }

    // close calls details if leaving calls
    if (tab !== 'calls') this.closeDetailsModal();

    // validate selection for active tab
    this.ensureSelectionValidForActiveTab();
  }

  onSelectAll(): void {
    if (!this.isTeamMode()) return;
    this.selected = 'all';
    this.selectedByTab[this.activeTab] = this.selected;
    this.closeDetailsModal();

    // reset fulfillment details UI
    this.openWeekStart = null;
    this.fulfillmentDetailsError = '';
  }

  onSelectAssignee(key: SelectedKey): void {
    this.selected = key;
    this.selectedByTab[this.activeTab] = this.selected;
    this.closeDetailsModal();

    // reset week accordion when selection changes
    this.openWeekStart = null;
    this.fulfillmentDetailsError = '';
  }

  onApplyFilters(): void {
    if (!this.isTeamMode()) this.includeInactive = false;

    this.loadCallsReport();
    this.loadAchievementReport();
    this.loadFulfillmentReport();

    // invalidate cached calls details
    this.closeDetailsModal();
    this.rows = this.rows.map((r) => {
      const { details, ...rest } = r as any;
      return rest;
    });

    // reset fulfillment details UI
    this.openWeekStart = null;
    this.fulfillmentDetailsError = '';
  }

  formatRate(rate: number): string {
    const v = Number.isFinite(rate) ? rate : 0;
    return `${(v * 100).toFixed(1)}%`;
  }

  // =========================
  // ===== Load Calls
  // =========================
  private loadCallsReport(): void {
    this.loadingCalls = true;
    this.errorCalls = '';

    this.api
      .getCallsReport({
        from: this.filterFromDate || undefined,
        to: this.filterToDate || undefined,
        windowDays: this.windowDays || 14,
        includeInactive: this.isTeamMode() ? this.includeInactive : false,
      })
      .subscribe({
        next: (res) => {
          this.report = res;
          this.rows = res?.rows || [];

          this.ensureSelectionValidForTab('calls');
          this.loadingCalls = false;
        },
        error: (err) => {
          console.error('[TeamReports] loadCallsReport error', err);
          this.errorCalls = 'Failed to load calls report';
          this.loadingCalls = false;
        },
      });
  }

  // =========================
  // ===== Load Achievements
  // =========================
  private loadAchievementReport(): void {
    this.loadingAchievements = true;
    this.errorAchievements = '';

    this.api
      .getAchievementsReport({
        from: this.filterFromDate || undefined,
        to: this.filterToDate || undefined,
        includeInactive: this.isTeamMode() ? this.includeInactive : false,
      })
      .subscribe({
        next: (res) => {
          this.achievementReport = res;
          this.achievementRows = res?.rows || [];
          this.achievementColumns = res?.columns || [];

          this.ensureSelectionValidForTab('achievements');
          this.loadingAchievements = false;
        },
        error: (err) => {
          console.error('[TeamReports] loadAchievementReport error', err);
          this.errorAchievements = 'Failed to load achievements report';
          this.loadingAchievements = false;
        },
      });
  }

  // =========================
  // ===== Load Fulfillment (summary)
  // =========================
  private loadFulfillmentReport(): void {
    this.loadingFulfillment = true;
    this.errorFulfillment = '';

    this.api
      .getFulfillmentReport({
        from: this.filterFromDate || undefined,
        to: this.filterToDate || undefined,
        // summary only (no details)
      })
      .subscribe({
        next: (res) => {
          this.fulfillmentReport = res;
          this.fulfillmentRows = res?.rows || [];

          this.ensureSelectionValidForTab('fulfillment');
          this.loadingFulfillment = false;
        },
        error: (err) => {
          console.error('[TeamReports] loadFulfillmentReport error', err);
          this.errorFulfillment = 'Failed to load fulfillment report';
          this.loadingFulfillment = false;
        },
      });
  }

  // =========================
  // ===== Fulfillment details for selected manager (optional)
  // =========================
  toggleWeek(weekStart: string): void {
    this.openWeekStart = this.openWeekStart === weekStart ? null : weekStart;

    // لو المستخدم عايز details، نجيب details للـ manager مرة واحدة
    if (this.fulfillmentIncludeDetails && this.selected !== 'all') {
      this.loadFulfillmentDetailsForSelected(false);
    }
  }

  onFulfillmentDetailsLimitChange(v: string): void {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return;
    this.fulfillmentDetailsLimit = Math.max(10, Math.min(1000, n));
  }

  reloadFulfillmentDetails(): void {
    if (this.selected === 'all') return;
    this.loadFulfillmentDetailsForSelected(true);
  }

  private loadFulfillmentDetailsForSelected(force: boolean): void {
    const sr = this.selectedFulfillmentRow;
    if (!sr) return;

    const managerId = sr.accountManager?.id ?? null;
    // unassigned allowed too (backend supports without filter; we will not request details for unassigned)
    if (!managerId) return;

    // لو already loaded details و مش force → سيبها
    // معيار بسيط: لو فيه أي request فيها details length > 0
    if (!force) {
      const hasDetails = (sr.weeks || []).some((w) =>
        (w.requests || []).some((rq) => (rq.details || []).length > 0)
      );
      if (hasDetails) return;
    }

    this.fulfillmentDetailsLoading = true;
    this.fulfillmentDetailsError = '';

    this.api
      .getFulfillmentReport({
        from: this.filterFromDate || undefined,
        to: this.filterToDate || undefined,
        accountManagerId: managerId,
        includeDetails: true,
        detailsLimit: this.fulfillmentDetailsLimit,
      })
      .subscribe({
        next: (res) => {
          const row = (res?.rows || [])[0];
          if (!row) {
            this.fulfillmentDetailsLoading = false;
            return;
          }

          // replace selected manager row with detailed one
          this.fulfillmentRows = this.fulfillmentRows.map((r) => {
            if (r.accountManager?.id !== managerId) return r;
            return row;
          });

          // also patch report totals if "all" is selected? keep as is.
          this.fulfillmentDetailsLoading = false;
        },
        error: (err) => {
          console.error('[TeamReports] loadFulfillmentDetails error', err);
          this.fulfillmentDetailsError = 'Failed to load fulfillment details';
          this.fulfillmentDetailsLoading = false;
        },
      });
  }

  // =========================
  // ===== Selection validation
  // =========================
  private ensureSelectionValidForTab(tab: ActiveTab): void {
    const u = this.currentUser();

    // single mode
    if (!this.isTeamMode() && u) {
      this.selectedByTab.calls = u.id;
      this.selectedByTab.achievements = u.id;
      this.selectedByTab.fulfillment = u.id;
      if (this.activeTab === tab) this.selected = u.id;
      return;
    }

    const selectedForTab = this.selectedByTab[tab];

    if (selectedForTab === 'all') {
      if (this.activeTab === tab) this.selected = 'all';
      return;
    }

    const exists = (() => {
      if (tab === 'calls') {
        if (selectedForTab === 'unassigned') return false;
        return this.rows.some((r) => r.assignee.id === selectedForTab);
      }

      if (tab === 'achievements') {
        if (selectedForTab === 'unassigned') return false;
        return this.achievementRows.some((r) => r.assignee.id === selectedForTab);
      }

      // fulfillment
      if (selectedForTab === 'unassigned') {
        return this.fulfillmentRows.some((r) => r.accountManager?.id == null);
      }
      return this.fulfillmentRows.some((r) => r.accountManager?.id === selectedForTab);
    })();

    if (!exists) {
      this.selectedByTab[tab] = 'all';
      if (this.activeTab === tab) this.selected = 'all';
    } else {
      if (this.activeTab === tab) this.selected = selectedForTab;
    }
  }

  private ensureSelectionValidForActiveTab(): void {
    this.ensureSelectionValidForTab(this.activeTab);
  }

  private defaultLast30Days(): { from: string; to: string } {
    const now = new Date();
    const to = this.toYmd(now);
    const fromDate = new Date(now);
    fromDate.setDate(fromDate.getDate() - 30);
    const from = this.toYmd(fromDate);
    return { from, to };
  }

  private toYmd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
