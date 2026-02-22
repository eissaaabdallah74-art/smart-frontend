import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PendingRequestVM } from '../pending-request.types';

@Component({
  selector: 'app-pr-details-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pr-details-modal.component.html',
  styleUrls: ['./pr-details-modal.component.scss'],
})
export class PrDetailsModalComponent {
  @Input() open = false;
  @Input() row: PendingRequestVM | null = null;

  @Input() priorityLabel!: (row: PendingRequestVM | null | undefined) => string;
  @Input() priorityClass!: (row: PendingRequestVM | null | undefined) => string;
  @Input() getVehicleLabel!: (t: any) => string;

  @Output() close = new EventEmitter<void>();

  stop(ev: Event): void { ev.stopPropagation(); }
}