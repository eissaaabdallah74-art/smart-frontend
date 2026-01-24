import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

type CarrierId = 'amazon' | 'jumia' | 'bosta' | 'smsa' | 'mylerz';
type Accent = 'blue' | 'emerald' | 'rose' | 'amber' | 'violet';

type ShipmentStatus = 'pending_pickup' | 'in_route' | 'out_for_delivery' | 'delivered' | 'exception';
type Priority = 'normal' | 'rush';

type RouteKind =
  | 'pickup'
  | 'origin_hub'
  | 'hub'
  | 'linehaul'
  | 'destination_hub'
  | 'last_mile'
  | 'delivered'
  | 'exception';

interface RouteNode {
  kind: RouteKind;
  hubName: string;
  city: string;
  timeIso?: string;
}

type EventLevel = 'info' | 'success' | 'warn' | 'danger';

interface TrackingEvent {
  timeIso: string;
  title: string;
  hubName?: string;
  city?: string;
  note?: string;
  icon: string; // Remix icon class
  level: EventLevel;
}

interface Shipment {
  id: string;
  carrierId: CarrierId;

  trackingNo: string;
  orderNo: string;

  fromCity: string;
  toName: string;
  toCity: string;

  status: ShipmentStatus;
  priority: Priority;

  etaIso: string;
  lastUpdateIso: string;

  route: RouteNode[];
  events: TrackingEvent[];
}

interface CarrierTab {
  id: CarrierId;
  name: string;
  accent: Accent;
  count: number;
}

@Component({
  selector: 'app-tracking-gps',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tracking-gps.component.html',
  styleUrls: ['./tracking-gps.component.scss'],
})
export class TrackingGpsComponent {
  private readonly _shipments = signal<Shipment[]>(seedShipments());

  // UX defaults: focus Amazon
  readonly selectedCarrierId = signal<CarrierId>('amazon');

  readonly search = signal<string>('');
  readonly statusFilter = signal<'all' | ShipmentStatus>('all');
  readonly sortBy = signal<'lastUpdate' | 'eta' | 'priority'>('lastUpdate');

  readonly selectedShipmentId = signal<string>('');

  readonly carriers = computed<CarrierTab[]>(() => {
    const all = this._shipments();
    const meta: Record<CarrierId, { name: string; accent: Accent }> = {
      amazon: { name: 'Amazon', accent: 'blue' },
      jumia: { name: 'Jumia', accent: 'emerald' },
      bosta: { name: 'Bosta', accent: 'rose' },
      smsa: { name: 'SMSA', accent: 'amber' },
      mylerz: { name: 'Mylerz', accent: 'violet' },
    };

    const counts: Record<CarrierId, number> = { amazon: 0, jumia: 0, bosta: 0, smsa: 0, mylerz: 0 };
    for (const s of all) counts[s.carrierId]++;

    const tabs: CarrierTab[] = (Object.keys(meta) as CarrierId[]).map((id) => ({
      id,
      name: meta[id].name,
      accent: meta[id].accent,
      count: counts[id],
    }));

    return [tabs.find((t) => t.id === 'amazon')!, ...tabs.filter((t) => t.id !== 'amazon')];
  });

  readonly selectedCarrierName = computed(() => {
    const tab = this.carriers().find((c) => c.id === this.selectedCarrierId());
    return tab?.name ?? '—';
  });

  readonly shipmentsForCarrier = computed(() => {
    return this._shipments().filter((s) => s.carrierId === this.selectedCarrierId());
  });

  readonly filteredShipments = computed(() => {
    let items = [...this.shipmentsForCarrier()];

    const status = this.statusFilter();
    if (status !== 'all') items = items.filter((s) => s.status === status);

    const q = this.search().trim().toLowerCase();
    if (q) {
      items = items.filter((s) =>
        [
          s.trackingNo,
          s.orderNo,
          s.fromCity,
          s.toName,
          s.toCity,
          s.status,
          s.priority,
          ...s.route.map((n) => `${n.hubName} ${n.city}`),
        ]
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }

    const by = this.sortBy();
    items.sort((a, b) => {
      if (by === 'priority') return a.priority === b.priority ? 0 : a.priority === 'rush' ? -1 : 1;
      if (by === 'eta') return +new Date(a.etaIso) - +new Date(b.etaIso);
      return +new Date(b.lastUpdateIso) - +new Date(a.lastUpdateIso);
    });

    // keep selection valid
    queueMicrotask(() => {
      if (!items.length) {
        this.selectedShipmentId.set('');
        return;
      }
      const cur = this.selectedShipmentId();
      if (!cur || !items.some((s) => s.id === cur)) this.selectedShipmentId.set(items[0].id);
    });

    return items;
  });

  readonly selectedShipment = computed<Shipment | null>(() => {
    const list = this.filteredShipments();
    if (!list.length) return null;
    const id = this.selectedShipmentId();
    return list.find((s) => s.id === id) ?? list[0] ?? null;
  });

  // timeline day by day
  readonly groupedEvents = computed(() => {
    const sh = this.selectedShipment();
    if (!sh) return [];

    const items = [...sh.events].sort((a, b) => +new Date(b.timeIso) - +new Date(a.timeIso));

    const groups = new Map<string, TrackingEvent[]>();
    for (const e of items) {
      const dayKey = this.dayKey(e.timeIso);
      groups.set(dayKey, [...(groups.get(dayKey) ?? []), e]);
    }

    return Array.from(groups.entries()).map(([dayKey, list]) => ({
      dayKey,
      dayLabel: this.formatDayLabelFromKey(dayKey),
      items: list.sort((a, b) => +new Date(b.timeIso) - +new Date(a.timeIso)),
    }));
  });

  // Actions
  selectCarrier(id: CarrierId) {
    this.selectedCarrierId.set(id);
  }

  selectShipment(id: string) {
    this.selectedShipmentId.set(id);
  }

  async copySelected() {
    const sh = this.selectedShipment();
    if (!sh) return;
    await this.copyToClipboard(sh.trackingNo);
  }

  fakeSync() {
    this.toast('Syncing...');
  }

  // Helpers
  trackShipment = (_: number, s: Shipment) => s.id;

  statusLabel(status: ShipmentStatus) {
    switch (status) {
      case 'pending_pickup': return 'Pending pickup';
      case 'in_route': return 'In route';
      case 'out_for_delivery': return 'Out for delivery';
      case 'delivered': return 'Delivered';
      case 'exception': return 'Exception';
      default: return status;
    }
  }

  statusPillClass(status: ShipmentStatus) {
    switch (status) {
      case 'pending_pickup': return 'pill--pending';
      case 'in_route': return 'pill--route';
      case 'out_for_delivery': return 'pill--ofd';
      case 'delivered': return 'pill--deliv';
      case 'exception': return 'pill--exc';
      default: return 'pill--pending';
    }
  }

  routeIcon(kind: RouteKind) {
    switch (kind) {
      case 'pickup': return 'ri-inbox-unarchive-line';
      case 'origin_hub': return 'ri-home-5-line';
      case 'hub': return 'ri-building-4-line';
      case 'linehaul': return 'ri-truck-line';
      case 'destination_hub': return 'ri-building-2-line';
      case 'last_mile': return 'ri-map-pin-line';
      case 'delivered': return 'ri-checkbox-circle-line';
      case 'exception': return 'ri-error-warning-line';
      default: return 'ri-route-line';
    }
  }

  routeState(route: RouteNode[], idx: number) {
    const lastDone = findLastDoneIndex(route);
    if (idx < lastDone) return 'done';
    if (idx === lastDone) return route[idx]?.timeIso ? 'current' : 'pending';
    return 'pending';
  }

  formatDayTime(iso: string) {
    const d = new Date(iso);
    const day = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: '2-digit', month: 'short' }).format(d);
    const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(d);
    return `${day} · ${time}`;
  }

  formatTime(iso?: string) {
    if (!iso) return '—';
    const d = new Date(iso);
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(d);
  }

  private dayKey(iso: string) {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  private formatDayLabelFromKey(dayKey: string) {
    const [y, m, d] = dayKey.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return new Intl.DateTimeFormat(undefined, { weekday: 'long', day: '2-digit', month: 'short' }).format(dt);
  }

  // Toast
  readonly toastMsg = signal<string>('');
  private toastTimer: any;

  toast(msg: string) {
    this.toastMsg.set(msg);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastMsg.set(''), 1800);
  }

  private async copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      this.toast('Copied tracking number.');
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      this.toast('Copied tracking number.');
    }
  }
}

/* utils + seed */

function findLastDoneIndex(route: RouteNode[]) {
  let idx = 0;
  for (let i = 0; i < route.length; i++) if (route[i].timeIso) idx = i;
  return idx;
}

function isoMinus(min: number) { return new Date(Date.now() - min * 60_000).toISOString(); }
function isoPlus(min: number) { return new Date(Date.now() + min * 60_000).toISOString(); }

function seedShipments(): Shipment[] {
  return [
    // Amazon (focus)
    mkShipment(
      'amz_1',
      'amazon',
      'AMZ-EG-TRK-550012',
      'ORD-99102',
      'Cairo',
      'Omar',
      'Alex',
      'out_for_delivery',
      'normal',
      [
        rn('pickup', 'Seller Pickup', 'Cairo', isoMinus(520)),
        rn('origin_hub', 'Abu Rawash Hub', 'Giza', isoMinus(430)),
        // rn('linehaul', '6th Oct Sort Center', 'Giza', isoMinus(220)),
        rn('hub', 'Attameya Hub', 'Fayoum', isoMinus(160)),
      ],
      [
        ev(isoMinus(520), 'Pickup scanned', 'Seller Pickup', 'Cairo', 'Package received', 'ri-inbox-unarchive-line', 'info'),
        ev(isoMinus(430), 'Arrived at origin hub', 'Abu Rawash Hub', 'Giza', 'Inbound scan', 'ri-building-4-line', 'info'),
        // ev(isoMinus(220), 'Linehaul departed', '6th Oct Sort Center', 'Giza', 'Loaded to Jumbo', 'ri-truck-line', 'warn'),
        ev(isoMinus(160), 'Cross-dock completed', 'Attameya Hub', 'Fayoum', 'Sorted to destination', 'ri-route-line', 'info'),
        // ev(isoMinus(60), 'Arrived destination hub', 'Alex Hub', 'Alex', 'Ready for last-mile', 'ri-building-2-line', 'info'),
        // ev(isoMinus(35), 'Out for delivery', 'Alex Last-mile Station', 'Alex', 'Driver en route', 'ri-map-pin-line', 'success'),
      ],
      isoPlus(90),
      isoMinus(35)
    ),

    mkShipment(
      'amz_2',
      'amazon',
      'AMZ-EG-TRK-550099',
      'ORD-99158',
      'Giza',
      'Sara',
      'Cairo',
      'in_route',
      'rush',
      [
        rn('pickup', 'HomePlus Pickup', 'Giza', isoMinus(120)),
        rn('origin_hub', 'Abu Rawash Hub', 'Giza', isoMinus(80)),
        rn('linehaul', 'Cairo Linehaul Gate', 'Cairo', undefined),
        rn('destination_hub', 'Nasr City Hub', 'Cairo', undefined),
        rn('last_mile', 'Cairo Last-mile Station', 'Cairo', undefined),
        rn('delivered', 'Delivery', 'Cairo', undefined),
      ],
      [
        ev(isoMinus(120), 'Pickup requested', 'HomePlus Pickup', 'Giza', 'Ready for pickup', 'ri-inbox-unarchive-line', 'info'),
        ev(isoMinus(80), 'Sorted at origin hub', 'Abu Rawash Hub', 'Giza', 'Rush priority tag', 'ri-price-tag-3-line', 'warn'),
      ],
      isoPlus(210),
      isoMinus(80)
    ),

    // Jumia
    mkShipment(
      'jum_1',
      'jumia',
      'JUM-TRK-884201',
      'ORD-77821',
      'Cairo',
      'Ahmed',
      'Giza',
      'in_route',
      'rush',
      [
        rn('pickup', 'Warehouse A', 'Cairo', isoMinus(240)),
        rn('origin_hub', '6th Oct Hub', 'Giza', isoMinus(180)),
        rn('linehaul', 'Ring Road Gate', 'Cairo', isoMinus(90)),
        rn('destination_hub', 'Giza Hub', 'Giza', undefined),
        rn('last_mile', 'Giza Last-mile', 'Giza', undefined),
        rn('delivered', 'Delivery', 'Giza', undefined),
      ],
      [
        ev(isoMinus(240), 'Shipment created', 'Warehouse A', 'Cairo', 'Packed & labeled', 'ri-file-list-3-line', 'info'),
        ev(isoMinus(180), 'Picked up', '6th Oct Hub', 'Giza', 'Scan OK', 'ri-qr-scan-2-line', 'info'),
        ev(isoMinus(90), 'In linehaul', 'Ring Road Gate', 'Cairo', 'Moving to destination hub', 'ri-truck-line', 'warn'),
      ],
      isoPlus(120),
      isoMinus(90)
    ),

    // Bosta
    mkShipment(
      'bos_1',
      'bosta',
      'BOS-TRK-774410',
      'ORD-22019',
      'Giza',
      'Youssef',
      'Cairo',
      'in_route',
      'normal',
      [
        rn('pickup', 'Warehouse C', 'Giza', isoMinus(300)),
        rn('origin_hub', 'Giza Hub', 'Giza', isoMinus(220)),
        rn('destination_hub', 'Cairo Hub', 'Cairo', isoMinus(55)),
        rn('last_mile', 'Cairo Last-mile', 'Cairo', undefined),
        rn('delivered', 'Delivery', 'Cairo', undefined),
      ],
      [
        ev(isoMinus(300), 'Created', 'Warehouse C', 'Giza', 'Preparing pickup', 'ri-file-add-line', 'info'),
        ev(isoMinus(220), 'Hub scan', 'Giza Hub', 'Giza', 'Sorted', 'ri-building-4-line', 'info'),
        ev(isoMinus(55), 'Arrived destination', 'Cairo Hub', 'Cairo', 'Ready for last-mile', 'ri-building-2-line', 'info'),
      ],
      isoPlus(180),
      isoMinus(55)
    ),

    // SMSA
    mkShipment(
      'smsa_1',
      'smsa',
      'SMSA-TRK-300010',
      'ORD-66110',
      'Cairo',
      'Hassan',
      'Mansoura',
      'exception',
      'rush',
      [
        rn('pickup', 'Warehouse B', 'Cairo', isoMinus(980)),
        rn('origin_hub', 'Cairo Hub', 'Cairo', isoMinus(920)),
        rn('linehaul', 'Delta Route', 'Delta', isoMinus(260)),
        rn('exception', 'Mansoura Hub', 'Mansoura', isoMinus(40)),
        rn('delivered', 'Delivery', 'Mansoura', undefined),
      ],
      [
        ev(isoMinus(260), 'Delay reported', 'Delta Route', 'Delta', 'Weather', 'ri-cloud-windy-line', 'warn'),
        ev(isoMinus(40), 'Exception', 'Mansoura Hub', 'Mansoura', 'Address verification needed', 'ri-error-warning-line', 'danger'),
      ],
      isoPlus(240),
      isoMinus(40)
    ),

    // Mylerz
    mkShipment(
      'myl_1',
      'mylerz',
      'MYL-TRK-991100',
      'ORD-55302',
      'Cairo',
      'Nour',
      'Cairo',
      'in_route',
      'normal',
      [
        rn('pickup', 'FashionHub', 'Cairo', isoMinus(360)),
        rn('origin_hub', 'Cairo Hub', 'Cairo', isoMinus(250)),
        rn('destination_hub', 'Nasr City Hub', 'Cairo', isoMinus(70)),
        rn('last_mile', 'Cairo Last-mile', 'Cairo', undefined),
        rn('delivered', 'Delivery', 'Cairo', undefined),
      ],
      [
        ev(isoMinus(360), 'Created', 'FashionHub', 'Cairo', 'Shipment created', 'ri-file-list-3-line', 'info'),
        ev(isoMinus(70), 'Sorted', 'Nasr City Hub', 'Cairo', 'Last-mile queue', 'ri-stack-line', 'info'),
      ],
      isoPlus(240),
      isoMinus(70)
    ),
  ];
}

function mkShipment(
  id: string,
  carrierId: CarrierId,
  trackingNo: string,
  orderNo: string,
  fromCity: string,
  toName: string,
  toCity: string,
  status: ShipmentStatus,
  priority: Priority,
  route: RouteNode[],
  events: TrackingEvent[],
  etaIso: string,
  lastUpdateIso: string
): Shipment {
  return { id, carrierId, trackingNo, orderNo, fromCity, toName, toCity, status, priority, route, events, etaIso, lastUpdateIso };
}

function rn(kind: RouteKind, hubName: string, city: string, timeIso?: string): RouteNode {
  return { kind, hubName, city, timeIso };
}

function ev(
  timeIso: string,
  title: string,
  hubName: string,
  city: string,
  note: string,
  icon: string,
  level: EventLevel
): TrackingEvent {
  return { timeIso, title, hubName, city, note, icon, level };
}
