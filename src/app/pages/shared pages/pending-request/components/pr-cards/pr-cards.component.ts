import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PendingRequestVM } from '../pending-request.types';


@Component({
  selector: 'app-pr-cards',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pr-cards.component.html',
  styleUrls: ['./pr-cards.component.scss'],
})
export class PrCardsComponent {
  @Input() rows: PendingRequestVM[] = [];
  @Input() loading = false;

  // خلّيها تقبل null/undefined عشان دوال الأب عندك كده
  @Input() priorityLabel!: (row: PendingRequestVM | null | undefined) => string;
  @Input() priorityClass!: (row: PendingRequestVM | null | undefined) => string;

  @Output() edit = new EventEmitter<PendingRequestVM>();
  @Output() remove = new EventEmitter<PendingRequestVM>();
  @Output() details = new EventEmitter<PendingRequestVM>();

  @Output() quickDecrement = new EventEmitter<{
    row: PendingRequestVM;
    index: number;
    ev?: Event;
  }>();

  trackById(_i: number, row: PendingRequestVM): number | undefined {
    return row.id;
  }

  onQuickDecrement(row: PendingRequestVM, i: number, ev: Event): void {
    ev?.stopPropagation();
    this.quickDecrement.emit({ row, index: i, ev });
  }
}