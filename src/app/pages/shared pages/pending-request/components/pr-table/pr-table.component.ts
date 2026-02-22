import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PendingRequestVM, PricingCol, VehicleChipVM, VehicleGroupVM } from '../pending-request.types';
import { PendingRequestItem, VehicleType } from '../../../../../services/pending request/pending-request-service.service';

@Component({
  selector: 'app-pr-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pr-table.component.html',
  styleUrls: ['./pr-table.component.scss'],
})
export class PrTableComponent {
  @Input() rows: PendingRequestVM[] = [];
  @Input() loading = false;

  // expansion is controlled by parent
  @Input() isRowExpanded!: (row: PendingRequestVM) => boolean;
  @Input() toggleRowExpanded!: (row: PendingRequestVM, ev?: Event) => void;

  // helpers from parent (already موجودين عندك)
  @Input() priorityLabel!: (row: PendingRequestVM | null | undefined) => string;
  @Input() priorityClass!: (row: PendingRequestVM | null | undefined) => string;
  @Input() getRowTotal!: (row: PendingRequestVM) => number;
  @Input() getVehicleChips!: (row: PendingRequestVM) => VehicleChipVM[];
  @Input() getVehicleGroups!: (row: PendingRequestVM) => VehicleGroupVM[];
  @Input() getVehicleLabel!: (t: VehicleType) => string;

  // columns labels (optional)
  @Input() getPricingColLabel!: (c: PricingCol) => string;

  @Output() edit = new EventEmitter<PendingRequestVM>();
  @Output() remove = new EventEmitter<PendingRequestVM>();
  @Output() details = new EventEmitter<PendingRequestVM>();
  @Output() quickDecrement = new EventEmitter<{ row: PendingRequestVM; index: number; ev?: Event }>();

  trackById(_i: number, row: PendingRequestVM): number | undefined {
    return row.id;
  }

  onQuickDecrement(row: PendingRequestVM, i: number, ev: Event): void {
    ev?.stopPropagation();
    this.quickDecrement.emit({ row, index: i, ev });
  }

  findItemIndexByVehicleType(row: PendingRequestVM, vt: VehicleType): number {
  const items = (row?.items || []) as PendingRequestItem[];
  for (let idx = 0; idx < items.length; idx++) {
    if ((items[idx]?.vehicleType as VehicleType) === vt) return idx;
  }
  return -1;
}
}