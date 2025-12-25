// src/app/pages/shared pages/pending-request/pending-request.component.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { FormsModule } from '@angular/forms';

import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  takeUntil,
  lastValueFrom,
  of,
} from 'rxjs';
import { catchError } from 'rxjs/operators';

import * as XLSX from 'xlsx';

import {
  ApiClient,
  ClientsServiceService,
} from '../../../services/clients/clients-service.service';

import {
  ApiHub,
  ApiZone,
  HubsZonesService,
} from '../../../services/hubs-zones/hubs-zones-service.service';

import {
  PendingRequest,
  PendingRequestPriority,
  VehicleType,
  PendingRequestStatus,
  PendingRequestServiceService,
  PendingRequestFilters,
  PendingRequestItem,
  CreatePendingRequestDto,
  BulkImportResult,
  BulkImportError,
} from '../../../services/pending request/pending-request-service.service';

type ViewMode = 'cards' | 'table';
type TabMode = 'list' | 'summary';

type PendingRequestVM = Omit<PendingRequest, 'priority'> & {
  priority?: PendingRequestPriority | null;
};

interface SummaryRow {
  date: string;
  clientId: number;
  accountName: string;
  counts: Partial<Record<VehicleType, number>>;
  total: number;
}

type PricingCol =
  | 'orderPrice'
  | 'guaranteeMinOrders'
  | 'fixedAmount'
  | 'allowanceAmount'
  | 'totalAmount';

type VehicleGroupVM = {
  type: VehicleType;
  count: number;
  cols: PricingCol[];
  values: Record<PricingCol, string>;
};

type VehicleChipVM = {
  type: VehicleType;
  label: string;
  count: number;
};

@Component({
  selector: 'app-pending-request',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './pending-request.component.html',
  styleUrls: ['./pending-request.component.scss'],
})
export class PendingRequestComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // مهم: هنخلي السيرفر refetch فقط عند تغيير Priority/Client Tab (مش مع كل حرف في search)
  private refetchTrigger$ = new Subject<string>();

  // loading / state
  loading = false;
  list: PendingRequestVM[] = [];
  errorMsg = '';
  toastMsg = '';

  // import result (UI)
  importResult: BulkImportResult | null = null;

  // Excel pre-validation errors (DB lookup)
  importValidationErrors: { row: number; message: string }[] = [];

  // caches for Excel import (to avoid refetching)
  private hubsByClientId = new Map<number, ApiHub[]>();
  private zonesByHubId = new Map<number, ApiZone[]>();

  // filters
  search = '';
  selectedClientId: number | null = null;

  // ✅ FIX #2: remove status filter from UI, keep server list pinned to PENDING
  private readonly listStatus: PendingRequestStatus = 'PENDING';

  selectedPriority: PendingRequestPriority | '' = '';

  // ✅ FIX #2: new vehicle type filter (local)
  selectedVehicleType: VehicleType | '' = '';

  // pagination (client-side)
  page = 1;
  pageSize = 20;
  readonly pageSizeOptions = [10, 20, 50, 100];

  // view mode
  viewMode: ViewMode = 'table';

  // tab mode
  activeTab: TabMode = 'list';

  // modal
  showEditor = false;
  isEditMode = false;
  editingId: number | null = null;

  // expanded rows in table view
  private expandedRowIds = new Set<number>();
  isRowExpanded(row: PendingRequestVM): boolean {
    const id = Number(row?.id || 0);
    if (!id) return false;
    return this.expandedRowIds.has(id);
  }
  toggleRowExpanded(row: PendingRequestVM, ev?: Event): void {
    ev?.stopPropagation();
    const id = Number(row?.id || 0);
    if (!id) return;
    if (this.expandedRowIds.has(id)) this.expandedRowIds.delete(id);
    else this.expandedRowIds.add(id);
  }
  collapseAllExpanded(): void {
    this.expandedRowIds.clear();
  }

  // form
  form: FormGroup;

  // dropdowns data
  clients: ApiClient[] = [];
  hubs: ApiHub[] = [];
  zones: ApiZone[] = [];

  // Summary meta
  summaryLastUpdatedAt: string | null = null;
  todayDate = '';

  readonly statuses: { value: PendingRequestStatus | ''; label: string }[] = [
    { value: '', label: 'All statuses' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ];

  readonly priorities: { value: PendingRequestPriority | ''; label: string }[] = [
    { value: '', label: 'All priorities' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ];

  readonly vehicleTypes: { value: VehicleType; label: string }[] = [
    { value: 'SEDAN', label: 'Sedan' },
    { value: 'VAN', label: 'Van' },
    { value: 'BIKE', label: 'Bike' },
    { value: 'DABABA', label: 'Dababa' },
    { value: 'NKR', label: 'NKR' },
    { value: 'TRICYCLE', label: 'Tricycle' },
    { value: 'JUMBO_4', label: 'Jumbo 4' },
    { value: 'JUMBO_6', label: 'Jumbo 6' },
    { value: 'HELPER', label: 'Helper' },
    { value: 'DRIVER', label: 'Driver' },
    { value: 'WORKER', label: 'Worker' },
  ];

  // columns order for summary table
  readonly vehicleTypeColumns: VehicleType[] = [
    'SEDAN',
    'VAN',
    'BIKE',
    'DABABA',
    'NKR',
    'TRICYCLE',
    'JUMBO_4',
    'JUMBO_6',
    'HELPER',
    'DRIVER',
    'WORKER',
  ];

  constructor(
    private fb: FormBuilder,
    private pendingService: PendingRequestServiceService,
    private clientsService: ClientsServiceService,
    private hubsZonesService: HubsZonesService
  ) {
    this.form = this.fb.group({
      clientId: [null, [Validators.required]],
      hubId: [null],
      zoneId: [null],
      requestDate: [null, [Validators.required]],
      billingMonth: [''],
      status: ['PENDING', [Validators.required]],
      priority: ['medium', [Validators.required]],
      notes: [''],
      items: this.fb.array([]),
    });
  }

  ngOnInit(): void {
    this.todayDate = this.formatLocalYmd(new Date());
    if (this.itemsArray.length === 0) this.addItem();

    this.loadClients();
    this.loadList();

    this.setupFormValueChanges();
    this.setupRefetchTrigger();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ===== Getters =====
  get itemsArray(): FormArray {
    return this.form.get('items') as FormArray;
  }

  get clientIdCtrl() {
    return this.form.get('clientId');
  }

  get hubIdCtrl() {
    return this.form.get('hubId');
  }

  get zoneIdCtrl() {
    return this.form.get('zoneId');
  }

  // ===== Client Tabs =====
  get clientTabs(): Array<{ id: number | null; label: string; count?: number }> {
    const tabs: Array<{ id: number | null; label: string; count?: number }> = [];

    const list = this.list || [];
    const countAll = list.length;

    tabs.push({ id: null, label: 'All', count: countAll });

    const clientsSorted = [...(this.clients || [])].sort((a: any, b: any) =>
      String(a?.name || '').localeCompare(String(b?.name || ''))
    );

    for (const c of clientsSorted) {
      if (!c?.id) continue;
      const count = list.filter((r) => r.clientId === c.id).length;
      tabs.push({ id: c.id, label: (c as any)?.name || `Client #${c.id}`, count });
    }

    return tabs;
  }

  setClientTab(clientId: number | null): void {
    this.selectedClientId = clientId;
    this.resetToFirstPage();
    this.collapseAllExpanded();
    this.onServerFiltersChanged(); // refetch only
  }

  // ===== Filtered list (LOCAL SEARCH IS THE SOURCE OF TRUTH) =====
  get filteredRequests(): PendingRequestVM[] {
    let rows = this.list || [];

    if (this.selectedClientId != null) {
      rows = rows.filter((r) => r.clientId === this.selectedClientId);
    }

    // ✅ FIX #2: Vehicle type filter (LOCAL)
    if (this.selectedVehicleType) {
      const vt = this.selectedVehicleType;
      rows = rows.filter((r) =>
        (r.items || []).some(
          (it) => (it.vehicleType as VehicleType) === vt && Number(it.vehicleCount || 0) > 0
        )
      );
    }

    // IMPORTANT: search is LOCAL, includes hub/zone for sure
    const q = (this.search || '').trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => {
        const a = (r.notes || '').toLowerCase();
        const b = (r.billingMonth || '').toLowerCase();
        const c = (r.client?.name || '').toLowerCase();
        const d = (r.hub?.name || '').toLowerCase();
        const e = (r.zone?.name || '').toLowerCase();
        // defensive: also allow "Hub #id" / "Zone #id"
        const f = r.hubId ? `hub #${r.hubId}` : '';
        const g = r.zoneId ? `zone #${r.zoneId}` : '';
        return (
          a.includes(q) ||
          b.includes(q) ||
          c.includes(q) ||
          d.includes(q) ||
          e.includes(q) ||
          f.includes(q) ||
          g.includes(q)
        );
      });
    }

    return rows;
  }

  // ===== Pagination (client-side) =====
  get totalRows(): number {
    return this.filteredRequests.length || 0;
  }

  get totalPages(): number {
    const t = this.totalRows;
    const ps = Number(this.pageSize || 20);
    if (!t) return 1;
    return Math.max(1, Math.ceil(t / ps));
  }

  get pageStartIndex(): number {
    const idx = (this.page - 1) * this.pageSize;
    return Math.min(Math.max(0, idx), Math.max(0, this.totalRows - 1));
  }

  get pageEndIndex(): number {
    const end = this.pageStartIndex + this.pageSize;
    return Math.min(end, this.totalRows);
  }

  get pagedRequests(): PendingRequestVM[] {
    const rows = this.filteredRequests || [];
    const start = (this.page - 1) * this.pageSize;
    const end = start + this.pageSize;
    return rows.slice(start, end);
  }

  resetToFirstPage(): void {
    this.page = 1;
  }

  clampPage(): void {
    const tp = this.totalPages;
    if (this.page > tp) this.page = tp;
    if (this.page < 1) this.page = 1;
  }

  goToPage(p: number): void {
    this.page = Number(p || 1);
    this.clampPage();
  }

  nextPage(): void {
    this.goToPage(this.page + 1);
  }

  prevPage(): void {
    this.goToPage(this.page - 1);
  }

  firstPage(): void {
    this.goToPage(1);
  }

  lastPage(): void {
    this.goToPage(this.totalPages);
  }

  onPageSizeChange(): void {
    this.resetToFirstPage();
    this.collapseAllExpanded();
  }

  // ===== Table simplified vehicles chips =====
  getVehicleChips(row: PendingRequestVM): VehicleChipVM[] {
    const items = (row.items || []) as PendingRequestItem[];
    const map = new Map<VehicleType, number>();

    for (const it of items) {
      const t = it.vehicleType as VehicleType;
      const cnt = Number(it.vehicleCount || 0);
      if (!t || cnt <= 0) continue;
      map.set(t, (map.get(t) || 0) + cnt);
    }

    const out: VehicleChipVM[] = [];
    for (const t of this.vehicleTypeColumns) {
      const count = map.get(t) || 0;
      if (!count) continue;
      out.push({ type: t, label: this.getVehicleLabel(t), count });
    }
    return out;
  }

  // ===== Table mini tables per vehicle type (kept for expanded details) =====
  trackByVehicleGroup(_i: number, g: VehicleGroupVM): string {
    return g.type;
  }

  getPricingColLabel(c: PricingCol): string {
    switch (c) {
      case 'orderPrice':
        return 'Order price';
      case 'guaranteeMinOrders':
        return 'Guarantee';
      case 'fixedAmount':
        return 'Fixed';
      case 'allowanceAmount':
        return 'Allowance';
      case 'totalAmount':
        return 'Total';
      default:
        return c;
    }
  }

  private fmtNumber(v: any): string {
    const n = Number(v);
    if (!Number.isFinite(n)) return '';
    return String(n);
  }

  private collectNumbers(items: PendingRequestItem[], key: keyof PendingRequestItem): number[] {
    return items
      .map((x: any) => Number(x?.[key]))
      .filter((n) => Number.isFinite(n) && n > 0);
  }

  private distinctSorted(arr: number[]): number[] {
    const s = Array.from(new Set(arr.map((x) => String(x)))).map((x) => Number(x));
    return s.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  }

  private oneOrRange(arr: number[]): string {
    const d = this.distinctSorted(arr);
    if (!d.length) return '';
    if (d.length === 1) return this.fmtNumber(d[0]);
    return `${this.fmtNumber(d[0])}–${this.fmtNumber(d[d.length - 1])}`;
  }

  private hasAnyValue(items: PendingRequestItem[], col: PricingCol): boolean {
    const arr = this.collectNumbers(items, col as any);
    return arr.length > 0;
  }

  getVehicleGroups(row: PendingRequestVM): VehicleGroupVM[] {
    const items = (row.items || []) as PendingRequestItem[];
    if (!items.length) return [];

    const byType = new Map<VehicleType, PendingRequestItem[]>();
    const countByType = new Map<VehicleType, number>();

    for (const it of items) {
      const t = it.vehicleType as VehicleType;
      const cnt = Number(it.vehicleCount || 0);
      if (!t || cnt <= 0) continue;

      if (!byType.has(t)) byType.set(t, []);
      byType.get(t)!.push(it);

      countByType.set(t, (countByType.get(t) || 0) + cnt);
    }

    const types = this.vehicleTypeColumns.filter((t) => byType.has(t));

    const allCols: PricingCol[] = [
      'orderPrice',
      'guaranteeMinOrders',
      'fixedAmount',
      'allowanceAmount',
      'totalAmount',
    ];

    return types.map((t) => {
      const tItems = byType.get(t) || [];
      const cols = allCols.filter((c) => this.hasAnyValue(tItems, c));

      const values: Record<PricingCol, string> = {
        orderPrice: this.oneOrRange(this.collectNumbers(tItems, 'orderPrice')),
        guaranteeMinOrders: this.oneOrRange(this.collectNumbers(tItems, 'guaranteeMinOrders')),
        fixedAmount: this.oneOrRange(this.collectNumbers(tItems, 'fixedAmount')),
        allowanceAmount: this.oneOrRange(this.collectNumbers(tItems, 'allowanceAmount')),
        totalAmount: this.oneOrRange(this.collectNumbers(tItems, 'totalAmount')),
      };

      for (const c of cols) {
        if (!values[c]) values[c] = '—';
      }

      return {
        type: t,
        count: countByType.get(t) || 0,
        cols,
        values,
      };
    });
  }

  // ===== Import result getters =====
  get importCreatedCount(): number {
    return this.importResult?.createdCount ?? 0;
  }
  get importUpdatedCount(): number {
    return this.importResult?.updatedCount ?? 0;
  }
  get importSkippedCount(): number {
    return this.importResult?.skippedCount ?? 0;
  }
  get importFailedCount(): number {
    return this.importResult?.failedCount ?? 0;
  }
  get firstImportErrors(): BulkImportError[] {
    return (this.importResult?.errors ?? []).slice(0, 5);
  }

  // ===== Tabs / View =====
  setTab(tab: TabMode): void {
    this.activeTab = tab;
    // لما تغير تبويب، اقفل التفاصيل عشان ميبقاش في زحمة
    if (tab !== 'list') this.collapseAllExpanded();
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
    this.collapseAllExpanded();
  }

  // ===== Reactive reactions =====
  private setupFormValueChanges(): void {
    this.clientIdCtrl?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        const clientId = value ? Number(value) : null;
        this.onClientChanged(clientId);
      });

    this.hubIdCtrl?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        const hubId = value ? Number(value) : null;
        this.onHubChanged(hubId);
      });
  }

  private setupRefetchTrigger(): void {
    this.refetchTrigger$
      .pipe(takeUntil(this.destroy$), debounceTime(250), distinctUntilChanged())
      .subscribe(() => this.loadList());
  }

  private onClientChanged(clientId: number | null): void {
    this.hubIdCtrl?.patchValue(null, { emitEvent: false });
    this.zoneIdCtrl?.patchValue(null, { emitEvent: false });
    this.hubs = [];
    this.zones = [];

    if (!clientId) return;

    this.hubsZonesService.getHubsByClient(clientId).subscribe({
      next: (rows) => (this.hubs = rows || []),
      error: (err) => console.error(err),
    });
  }

  private onHubChanged(hubId: number | null): void {
    this.zoneIdCtrl?.patchValue(null, { emitEvent: false });
    this.zones = [];

    if (!hubId) return;

    this.hubsZonesService.getZonesByHub(hubId).subscribe({
      next: (rows) => (this.zones = rows || []),
      error: (err) => console.error(err),
    });
  }

  // ===== Clients =====
  private loadClients(): void {
    this.clientsService.getClients().subscribe({
      next: (rows) => (this.clients = rows || []),
      error: (err) => console.error('loadClients error', err),
    });
  }

  // ===== List (server filters) =====
  private buildServerFilters(): PendingRequestFilters {
    const filters: PendingRequestFilters = {};

    // client tab optional (server side to reduce payload)
    if (this.selectedClientId != null) filters.clientId = this.selectedClientId;

    // ✅ FIX #2: keep PENDING pinned server-side (no UI filter)
    filters.status = this.listStatus;

    // keep priority on server
    if (this.selectedPriority) filters.priority = this.selectedPriority;

    // IMPORTANT: do NOT send q to server
    return filters;
  }

  loadList(): void {
    this.loading = true;
    this.errorMsg = '';
    this.importResult = null;
    this.importValidationErrors = [];

    const filters = this.buildServerFilters();

    this.pendingService.getAll(filters).subscribe({
      next: (rows) => {
        this.list = (rows || []) as PendingRequestVM[];
        this.recomputeSummaryMeta();
        this.loading = false;

        // pagination safety
        this.resetToFirstPage();
        this.clampPage();
      },
      error: (err) => {
        console.error(err);
        this.errorMsg = 'Failed to load pending requests.';
        this.loading = false;
      },
    });
  }

  // ===== Filters UI =====
  // Search is local only (no refetch)
  onSearchChanged(): void {
    this.resetToFirstPage();
    this.collapseAllExpanded();
  }

  // ✅ FIX #2: Vehicle type change is local only
  onVehicleTypeChanged(): void {
    this.resetToFirstPage();
    this.collapseAllExpanded();
  }

  // Priority/client changes should refetch
  onServerFiltersChanged(): void {
    this.resetToFirstPage();
    this.collapseAllExpanded();
    this.refetchTrigger$.next(
      `${this.selectedClientId}|${this.selectedPriority}`
    );
  }

  clearFilters(): void {
    this.search = '';
    this.selectedClientId = null;
    this.selectedPriority = '';
    this.selectedVehicleType = '';
    this.resetToFirstPage();
    this.collapseAllExpanded();
    this.loadList();
  }

  // ===== Modal =====
  openCreate(): void {
    this.isEditMode = false;
    this.editingId = null;

    this.form.reset(
      {
        clientId: this.selectedClientId ?? null,
        hubId: null,
        zoneId: null,
        requestDate: this.todayDate,
        billingMonth: '',
        status: 'PENDING',
        priority: 'medium',
        notes: '',
      },
      { emitEvent: false }
    );

    this.itemsArray.clear();
    this.hubs = [];
    this.zones = [];

    if (this.selectedClientId != null) this.onClientChanged(this.selectedClientId);

    this.addItem();
    this.showEditor = true;
  }

  openEdit(row: PendingRequestVM): void {
    this.isEditMode = true;
    this.editingId = row.id ?? null;

    this.form.patchValue(
      {
        clientId: row.clientId,
        hubId: row.hubId ?? null,
        zoneId: row.zoneId ?? null,
        requestDate: row.requestDate,
        billingMonth: row.billingMonth || '',
        status: row.status,
        priority: (row.priority || 'medium') as PendingRequestPriority,
        notes: row.notes || '',
      },
      { emitEvent: false }
    );

    this.hubs = [];
    this.zones = [];

    if (row.clientId) {
      this.hubsZonesService.getHubsByClient(row.clientId).subscribe({
        next: (hubs) => {
          this.hubs = hubs || [];
          if (row.hubId) {
            this.hubsZonesService.getZonesByHub(row.hubId).subscribe({
              next: (zones) => (this.zones = zones || []),
              error: (err) => console.error(err),
            });
          }
        },
        error: (err) => console.error(err),
      });
    }

    this.itemsArray.clear();
    (row.items || []).forEach((item) => {
      const g = this.buildItemGroupFromItem(item);
      this.itemsArray.push(g);
      this.syncItemToggleState(g);
      this.watchItemToggles(g);
    });

    if (this.itemsArray.length === 0) this.addItem();

    this.showEditor = true;
  }

  closeEditor(): void {
    this.showEditor = false;
    this.isEditMode = false;
    this.editingId = null;
  }

  // ===== Items (toggles enable/disable) =====
  private buildItemGroup(): FormGroup {
    const g = this.fb.group({
      vehicleType: [null as VehicleType | null, [Validators.required]],
      vehicleCount: [1, [Validators.required, Validators.min(1)]],

      useOrderPrice: [false],
      orderPrice: [{ value: null, disabled: true }],

      useGuarantee: [false],
      guaranteeMinOrders: [{ value: null, disabled: true }],

      useFixedAmount: [false],
      fixedAmount: [{ value: null, disabled: true }],

      useAllowanceAmount: [false],
      allowanceAmount: [{ value: null, disabled: true }],

      useTotalAmount: [false],
      totalAmount: [{ value: null, disabled: true }],
    });

    this.watchItemToggles(g);
    return g;
  }

  private buildItemGroupFromItem(item: PendingRequestItem): FormGroup {
    return this.fb.group({
      vehicleType: [item.vehicleType, [Validators.required]],
      vehicleCount: [item.vehicleCount ?? 1, [Validators.required, Validators.min(1)]],

      useOrderPrice: [item.orderPrice != null],
      orderPrice: [{ value: item.orderPrice ?? null, disabled: item.orderPrice == null }],

      useGuarantee: [item.guaranteeMinOrders != null],
      guaranteeMinOrders: [
        { value: item.guaranteeMinOrders ?? null, disabled: item.guaranteeMinOrders == null },
      ],

      useFixedAmount: [item.fixedAmount != null],
      fixedAmount: [{ value: item.fixedAmount ?? null, disabled: item.fixedAmount == null }],

      useAllowanceAmount: [item.allowanceAmount != null],
      allowanceAmount: [{ value: item.allowanceAmount ?? null, disabled: item.allowanceAmount == null }],

      useTotalAmount: [item.totalAmount != null],
      totalAmount: [{ value: item.totalAmount ?? null, disabled: item.totalAmount == null }],
    });
  }

  addItem(): void {
    const g = this.buildItemGroup();
    this.itemsArray.push(g);
    this.syncItemToggleState(g);
  }

  removeItem(index: number): void {
    if (this.itemsArray.length === 1) return;
    this.itemsArray.removeAt(index);
  }

  incrementCount(index: number): void {
    const group = this.itemsArray.at(index) as FormGroup;
    const current = Number(group.get('vehicleCount')?.value || 0);
    group.get('vehicleCount')?.setValue(current + 1);
  }

  decrementCount(index: number): void {
    const group = this.itemsArray.at(index) as FormGroup;
    const current = Number(group.get('vehicleCount')?.value || 0);
    if (current <= 1) return;
    group.get('vehicleCount')?.setValue(current - 1);
  }

  private watchItemToggles(group: FormGroup): void {
    const pairs: Array<[string, string]> = [
      ['useOrderPrice', 'orderPrice'],
      ['useGuarantee', 'guaranteeMinOrders'],
      ['useFixedAmount', 'fixedAmount'],
      ['useAllowanceAmount', 'allowanceAmount'],
      ['useTotalAmount', 'totalAmount'],
    ];

    for (const [toggleKey, valueKey] of pairs) {
      group
        .get(toggleKey)
        ?.valueChanges.pipe(takeUntil(this.destroy$))
        .subscribe(() => this.applyToggle(group, toggleKey, valueKey));
    }
  }

  private syncItemToggleState(group: FormGroup): void {
    this.applyToggle(group, 'useOrderPrice', 'orderPrice');
    this.applyToggle(group, 'useGuarantee', 'guaranteeMinOrders');
    this.applyToggle(group, 'useFixedAmount', 'fixedAmount');
    this.applyToggle(group, 'useAllowanceAmount', 'allowanceAmount');
    this.applyToggle(group, 'useTotalAmount', 'totalAmount');
  }

  private applyToggle(group: FormGroup, toggleKey: string, valueKey: string): void {
    const toggle = !!group.get(toggleKey)?.value;
    const ctrl = group.get(valueKey);
    if (!ctrl) return;

    if (toggle) {
      if (ctrl.disabled) ctrl.enable({ emitEvent: false });
    } else {
      if (ctrl.enabled) ctrl.disable({ emitEvent: false });
      ctrl.setValue(null, { emitEvent: false });
    }
  }

  // ===== Quick decrement (list) =====
  quickDecrementItem(row: PendingRequestVM, itemIndex: number, ev?: Event): void {
    ev?.stopPropagation();

    if (!row.id) return;
    const originalItems = row.items || [];
    const target = originalItems[itemIndex];
    if (!target) return;

    const currentCount = Number(target.vehicleCount || 0);
    if (currentCount <= 1) return;

    const newItems: PendingRequestItem[] = originalItems.map((it, idx) => {
      if (idx !== itemIndex) return { ...it };
      return { ...it, vehicleCount: currentCount - 1 };
    });

    const payload: Partial<PendingRequest> = {
      clientId: row.clientId,
      hubId: row.hubId ?? null,
      zoneId: row.zoneId ?? null,
      requestDate: row.requestDate,
      billingMonth: row.billingMonth || null,
      status: row.status,
      priority: (row.priority || 'medium') as PendingRequestPriority,
      notes: row.notes || null,
      items: newItems.map((it) => ({
        vehicleType: it.vehicleType,
        vehicleCount: it.vehicleCount ?? 1,
        orderPrice: it.orderPrice ?? null,
        guaranteeMinOrders: it.guaranteeMinOrders ?? null,
        fixedAmount: it.fixedAmount ?? null,
        allowanceAmount: it.allowanceAmount ?? null,
        totalAmount: it.totalAmount ?? null,
      })),
    };

    this.loading = true;
    this.errorMsg = '';
    this.toastMsg = '';

    this.pendingService.update(row.id, payload).subscribe({
      next: () => {
        this.loading = false;
        this.toastMsg = 'Vehicle count updated.';
        this.loadList();
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
        this.errorMsg = 'Failed to update vehicle count.';
      },
    });
  }

  // ===== Submit (create/update) =====
  submit(): void {
    if (this.form.invalid || this.itemsArray.length === 0) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();

    const payload: CreatePendingRequestDto = {
      clientId: Number(raw.clientId),
      hubId: raw.hubId ? Number(raw.hubId) : null,
      zoneId: raw.zoneId ? Number(raw.zoneId) : null,
      requestDate: raw.requestDate,
      billingMonth: raw.billingMonth || null,
      status: raw.status,
      priority: (raw.priority || 'medium') as PendingRequestPriority,
      notes: raw.notes || null,
      items: (raw.items || []).map((it: any) => ({
        vehicleType: it.vehicleType,
        vehicleCount: it.vehicleCount ? Number(it.vehicleCount) : 1,
        orderPrice: it.useOrderPrice && it.orderPrice !== null && it.orderPrice !== '' ? Number(it.orderPrice) : null,
        guaranteeMinOrders:
          it.useGuarantee && it.guaranteeMinOrders !== null && it.guaranteeMinOrders !== ''
            ? Number(it.guaranteeMinOrders)
            : null,
        fixedAmount:
          it.useFixedAmount && it.fixedAmount !== null && it.fixedAmount !== '' ? Number(it.fixedAmount) : null,
        allowanceAmount:
          it.useAllowanceAmount && it.allowanceAmount !== null && it.allowanceAmount !== ''
            ? Number(it.allowanceAmount)
            : null,
        totalAmount:
          it.useTotalAmount && it.totalAmount !== null && it.totalAmount !== '' ? Number(it.totalAmount) : null,
      })),
    };

    this.loading = true;
    this.errorMsg = '';
    this.toastMsg = '';

    if (this.isEditMode && this.editingId) {
      this.pendingService.update(this.editingId, payload).subscribe({
        next: () => {
          this.loading = false;
          this.toastMsg = 'Request updated successfully.';
          this.closeEditor();
          this.loadList();
        },
        error: (err) => {
          console.error(err);
          this.loading = false;
          this.errorMsg = 'Failed to update request.';
        },
      });
    } else {
      this.pendingService.create(payload).subscribe({
        next: () => {
          this.loading = false;
          this.toastMsg = 'Request created successfully.';
          this.closeEditor();
          this.loadList();
        },
        error: (err) => {
          console.error(err);
          this.loading = false;
          this.errorMsg = 'Failed to create request.';
        },
      });
    }
  }

  // ===== Delete =====
  confirmDelete(row: PendingRequestVM): void {
    if (!row.id) return;
    const ok = window.confirm(`Are you sure you want to delete request #${row.id}?`);
    if (!ok) return;

    this.loading = true;
    this.errorMsg = '';
    this.toastMsg = '';

    this.pendingService.delete(row.id).subscribe({
      next: () => {
        this.loading = false;
        this.toastMsg = 'Request deleted successfully.';
        this.loadList();
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
        this.errorMsg = 'Failed to delete request.';
      },
    });
  }

  // =========================================================
  // Excel: Template / Export / Import
  // =========================================================

  downloadImportTemplate(): void {
    const rows = [
      {
        clientId: 'Client Name OR ID',
        hubId: 'Hub Name OR ID (optional)',
        zoneId: 'Zone Name OR ID (optional)',
        priority: 'medium',
        notes: 'Example request',
        vehicleType: 'BIKE',
        vehicleCount: 10,
        orderPrice: 6.25,
        guaranteeMinOrders: 25,
        fixedAmount: '',
        allowanceAmount: '',
        totalAmount: '',
      },
      {
        clientId: 'Client Name OR ID',
        hubId: 'Hub Name OR ID (optional)',
        zoneId: 'Zone Name OR ID (optional)',
        priority: 'medium',
        notes: 'Example request',
        vehicleType: 'VAN',
        vehicleCount: 3,
        orderPrice: '',
        guaranteeMinOrders: '',
        fixedAmount: 5072,
        allowanceAmount: 375,
        totalAmount: '',
      },
    ];

    this.downloadXlsx(rows, `pending-requests-import-template-${this.todayDate}.xlsx`, 'PendingRequests');
  }

  exportFilteredAsExcel(): void {
    const rows: any[] = [];

    (this.filteredRequests || []).forEach((r) => {
      const base = {
        clientId: r.client?.name || r.clientId,
        hubId: r.hub?.name || (r.hubId ?? ''),
        zoneId: r.zone?.name || (r.zoneId ?? ''),
        status: r.status || '',
        priority: r.priority ?? '',
        notes: (r.notes ?? '').replace(/\r?\n/g, ' '),
      };

      const items = r.items || [];
      if (!items.length) {
        rows.push({
          ...base,
          vehicleType: '',
          vehicleCount: '',
          orderPrice: '',
          guaranteeMinOrders: '',
          fixedAmount: '',
          allowanceAmount: '',
          totalAmount: '',
        });
        return;
      }

      items.forEach((it) => {
        rows.push({
          ...base,
          vehicleType: it.vehicleType,
          vehicleCount: it.vehicleCount ?? '',
          orderPrice: it.orderPrice ?? '',
          guaranteeMinOrders: it.guaranteeMinOrders ?? '',
          fixedAmount: it.fixedAmount ?? '',
          allowanceAmount: it.allowanceAmount ?? '',
          totalAmount: it.totalAmount ?? '',
        });
      });
    });

    this.downloadXlsx(rows, `pending-requests-export-${this.todayDate}.xlsx`, 'PendingRequests');
  }

  triggerImport(input: HTMLInputElement): void {
    input.value = '';
    input.click();
  }

  async handleImportFile(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.errorMsg = '';
    this.toastMsg = '';
    this.importResult = null;
    this.importValidationErrors = [];

    try {
      if (!this.clients?.length) {
        this.clients = (await lastValueFrom(
          this.clientsService.getClients().pipe(catchError(() => of([])))
        )) as ApiClient[];
      }

      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheetName = wb.SheetNames?.[0];
      if (!sheetName) {
        this.errorMsg = 'Excel file has no sheets.';
        return;
      }

      const ws = wb.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as any[];

      const { requests, errors } = await this.normalizeImportExcelRowsWithDbLookup(rawRows);

      if (errors.length) {
        this.importValidationErrors = errors.slice(0, 50);
        this.errorMsg = `Import validation failed: ${errors.length} error(s).`;
        return;
      }

      if (!requests.length) {
        this.errorMsg = 'Excel file has no valid requests.';
        return;
      }

      this.loading = true;

      this.pendingService.bulkImport({ requests }).subscribe({
        next: (res) => {
          this.loading = false;
          this.importResult = res;
          this.toastMsg =
            `Import done: created ${this.importCreatedCount}, updated ${this.importUpdatedCount}, ` +
            `skipped ${this.importSkippedCount}, failed ${this.importFailedCount} (total ${res.total}).`;
          this.loadList();
        },
        error: (err) => {
          console.error(err);
          this.loading = false;
          this.errorMsg = 'Bulk import failed.';
        },
      });
    } catch (e) {
      console.error(e);
      this.errorMsg = 'Invalid Excel file.';
    }
  }

  private async normalizeImportExcelRowsWithDbLookup(rows: any[]): Promise<{
    requests: CreatePendingRequestDto[];
    errors: { row: number; message: string }[];
  }> {
    const errors: { row: number; message: string }[] = [];

    const clientById = new Map<number, ApiClient>();
    const clientIdByName = new Map<string, number>();

    for (const c of this.clients || []) {
      if (!c?.id) continue;
      clientById.set(c.id, c);
      if ((c as any).name) clientIdByName.set(this.normKey((c as any).name), c.id);
    }

    type Parsed = {
      rowIndex: number;
      clientRaw: any;
      hubRaw: any;
      zoneRaw: any;
      priorityRaw: any;
      notesRaw: any;
      vehicleTypeRaw: any;
      vehicleCountRaw: any;
      orderPriceRaw: any;
      guaranteeRaw: any;
      fixedRaw: any;
      allowanceRaw: any;
      totalRaw: any;

      clientId?: number;
      hubId?: number | null;
      zoneId?: number | null;

      priority?: PendingRequestPriority;
      notes?: string | null;

      item?: PendingRequestItem;
    };

    const parsed: Parsed[] = (rows || []).map((r, i) => ({
      rowIndex: i + 2,
      clientRaw: r.clientId,
      hubRaw: r.hubId,
      zoneRaw: r.zoneId,
      priorityRaw: r.priority,
      notesRaw: r.notes,
      vehicleTypeRaw: r.vehicleType,
      vehicleCountRaw: r.vehicleCount,
      orderPriceRaw: r.orderPrice,
      guaranteeRaw: r.guaranteeMinOrders,
      fixedRaw: r.fixedAmount,
      allowanceRaw: r.allowanceAmount,
      totalRaw: r.totalAmount,
    }));

    for (const pr of parsed) {
      const { id, name } = this.parseNameOrId(pr.clientRaw);

      if (id != null) {
        if (!clientById.has(id)) {
          errors.push({ row: pr.rowIndex, message: `Client ID "${id}" مش موجود في DB` });
          continue;
        }
        pr.clientId = id;
      } else if (name) {
        const cid = clientIdByName.get(this.normKey(name));
        if (!cid) {
          errors.push({ row: pr.rowIndex, message: `Client "${name}" مش موجود في DB` });
          continue;
        }
        pr.clientId = cid;
      } else {
        errors.push({ row: pr.rowIndex, message: `clientId مطلوب (اسم أو ID)` });
      }
    }

    if (errors.length) return { requests: [], errors };

    for (const pr of parsed) {
      const clientId = pr.clientId!;
      const hubs = await this.ensureHubsLoaded(clientId);

      const { id: hubId, name: hubName } = this.parseNameOrId(pr.hubRaw);

      if (!hubId && !hubName) {
        pr.hubId = null;
      } else {
        let resolvedHubId: number | null = null;

        if (hubId != null) {
          resolvedHubId = hubs.find((h) => h.id === hubId)?.id ?? null;
        } else if (hubName) {
          const key = this.normKey(hubName);
          resolvedHubId = hubs.find((h) => this.normKey((h as any).name || '') === key)?.id ?? null;
        }

        if (!resolvedHubId) {
          const shown = hubId != null ? String(hubId) : `"${hubName}"`;
          errors.push({ row: pr.rowIndex, message: `Hub ${shown} مش موجود/مش تابع للـ Client في DB` });
          continue;
        }

        pr.hubId = resolvedHubId;
      }

      const { id: zoneId, name: zoneName } = this.parseNameOrId(pr.zoneRaw);

      if (!zoneId && !zoneName) {
        pr.zoneId = null;
      } else {
        if (!pr.hubId) {
          errors.push({ row: pr.rowIndex, message: `Zone موجودة لكن Hub فاضي — لازم hubId أولاً` });
          continue;
        }

        const zones = await this.ensureZonesLoaded(pr.hubId);

        let resolvedZoneId: number | null = null;

        if (zoneId != null) {
          resolvedZoneId = zones.find((z) => z.id === zoneId)?.id ?? null;
        } else if (zoneName) {
          const key = this.normKey(zoneName);
          resolvedZoneId = zones.find((z) => this.normKey((z as any).name || '') === key)?.id ?? null;
        }

        if (!resolvedZoneId) {
          const shown = zoneId != null ? String(zoneId) : `"${zoneName}"`;
          errors.push({ row: pr.rowIndex, message: `Zone ${shown} مش موجودة/مش تابعة للـ Hub في DB` });
          continue;
        }

        pr.zoneId = resolvedZoneId;
      }
    }

    if (errors.length) return { requests: [], errors };

    for (const pr of parsed) {
      const prioRaw = this.asString(pr.priorityRaw).trim().toLowerCase();
      const prio = (prioRaw || 'medium') as PendingRequestPriority;
      pr.priority = (this.isPriority(prio) ? prio : 'medium') as PendingRequestPriority;

      const notes = this.asString(pr.notesRaw).trim();
      pr.notes = notes ? notes : null;

      const vtRaw = this.asString(pr.vehicleTypeRaw).trim().toUpperCase();
      if (!this.isVehicleType(vtRaw)) {
        errors.push({ row: pr.rowIndex, message: `vehicleType "${vtRaw}" غير صالح` });
        continue;
      }

      const count = this.toNumber(pr.vehicleCountRaw);
      if (!count || count <= 0) {
        errors.push({ row: pr.rowIndex, message: `vehicleCount لازم يكون رقم أكبر من 0` });
        continue;
      }

      pr.item = {
        vehicleType: vtRaw as VehicleType,
        vehicleCount: count,
        orderPrice: this.toNumberOrNull(pr.orderPriceRaw),
        guaranteeMinOrders: this.toNumberOrNull(pr.guaranteeRaw),
        fixedAmount: this.toNumberOrNull(pr.fixedRaw),
        allowanceAmount: this.toNumberOrNull(pr.allowanceRaw),
        totalAmount: this.toNumberOrNull(pr.totalRaw),
      } as any;
    }

    if (errors.length) return { requests: [], errors };

    const map = new Map<string, CreatePendingRequestDto>();

    for (const pr of parsed) {
      if (!pr.clientId || !pr.item) continue;

      const key = [
        pr.clientId,
        pr.hubId ?? '',
        pr.zoneId ?? '',
        pr.priority ?? 'medium',
        this.normKey(pr.notes || ''),
      ].join('|');

      const existing = map.get(key);

      if (!existing) {
        map.set(key, {
          clientId: pr.clientId,
          hubId: pr.hubId ?? null,
          zoneId: pr.zoneId ?? null,
          requestDate: this.todayDate,
          billingMonth: null,
          status: 'PENDING',
          priority: (pr.priority || 'medium') as PendingRequestPriority,
          notes: pr.notes || null,
          items: [pr.item as any],
        });
      } else {
        existing.items.push(pr.item as any);
      }
    }

    const requests = Array.from(map.values()).filter((x) => x.items?.length);
    return { requests, errors };
  }

  // ===== DB cache loaders =====
  private async ensureHubsLoaded(clientId: number): Promise<ApiHub[]> {
    if (this.hubsByClientId.has(clientId)) return this.hubsByClientId.get(clientId) || [];

    const hubs = (await lastValueFrom(
      this.hubsZonesService.getHubsByClient(clientId).pipe(catchError(() => of([])))
    )) as ApiHub[];

    this.hubsByClientId.set(clientId, hubs || []);
    return hubs || [];
  }

  private async ensureZonesLoaded(hubId: number): Promise<ApiZone[]> {
    if (this.zonesByHubId.has(hubId)) return this.zonesByHubId.get(hubId) || [];

    const zones = (await lastValueFrom(
      this.hubsZonesService.getZonesByHub(hubId).pipe(catchError(() => of([])))
    )) as ApiZone[];

    this.zonesByHubId.set(hubId, zones || []);
    return zones || [];
  }

  // ===== helpers (Excel) =====
  private parseNameOrId(raw: any): { id: number | null; name: string } {
    if (raw == null) return { id: null, name: '' };
    if (typeof raw === 'number' && Number.isFinite(raw)) return { id: raw, name: '' };

    const s = String(raw).trim();
    if (!s) return { id: null, name: '' };
    if (/^\d+$/.test(s)) return { id: Number(s), name: '' };

    return { id: null, name: s };
  }

  private normKey(s: string): string {
    return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private isPriority(p: string): boolean {
    return ['low', 'medium', 'high', 'urgent'].includes(p);
  }

  private isVehicleType(v: string): boolean {
    return this.vehicleTypeColumns.includes(v as VehicleType);
  }

  private asString(v: any): string {
    if (v == null) return '';
    return String(v);
  }

  private toNumber(v: any): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private toNumberOrNull(v: any): number | null {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  private downloadXlsx(rows: any[], filename: string, sheetName: string): void {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([out], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    } as any);

    this.downloadBlob(blob, filename);
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ===== TrackBy =====
  trackById(_index: number, row: PendingRequestVM): number | undefined {
    return row.id;
  }

  trackByClientId(_i: number, row: SummaryRow): number {
    return row.clientId;
  }

  // ===== Priority UI helpers =====
  priorityLabel(row: PendingRequestVM | null | undefined): string {
    const p = (row?.priority || 'medium') as PendingRequestPriority;
    return String(p || 'medium').toUpperCase();
  }

  priorityClass(row: PendingRequestVM | null | undefined): string {
    const p = (row?.priority || 'medium') as PendingRequestPriority;
    return `priority-pill priority-${p}`;
  }

  // ===== Summary =====
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
    return this.parseMs(r.updatedAt) || this.parseMs(r.createdAt) || this.parseMs(r.requestDate) || 0;
  }

  private recomputeSummaryMeta(): void {
    let bestMs = 0;
    let best: PendingRequestVM | null = null;

    for (const r of this.list || []) {
      const ms = this.getBestMs(r);
      if (ms > bestMs) {
        bestMs = ms;
        best = r;
      }
    }

    this.summaryLastUpdatedAt = best?.updatedAt ?? best?.createdAt ?? null;
  }

  private resolveAccountName(clientId: number, latestReq?: PendingRequestVM): string {
    const fromReq = latestReq?.client?.name;
    if (fromReq) return fromReq;

    const fromClients = (this.clients?.find((c) => c.id === clientId) as any)?.name;
    if (fromClients) return fromClients;

    return `Client #${clientId}`;
  }

  get summaryRows(): SummaryRow[] {
    const rowsSrc = this.filteredRequests || [];
    const map = new Map<number, SummaryRow>();

    for (const r of rowsSrc) {
      const clientId = Number(r.clientId);
      if (!clientId) continue;

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
    return out;
  }

  get summaryGrandTotals(): { counts: Partial<Record<VehicleType, number>>; total: number } {
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

  getVehicleLabel(t: VehicleType): string {
    return this.vehicleTypes.find((x) => x.value === t)?.label || t;
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

  getRowTotal(row: PendingRequestVM): number {
    let total = 0;
    for (const it of row.items || []) {
      total += Number(it.vehicleCount || 0);
    }
    return total;
  }

  detailsRow: PendingRequestVM | null = null;

  openDetails(row: PendingRequestVM): void {
    this.detailsRow = row;
  }

  closeDetails(): void {
    this.detailsRow = null;
  }
}
