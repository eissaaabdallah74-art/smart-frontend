import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export type StatusType = 'success' | 'error' | 'info';

@Component({
  selector: 'app-status-msg',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './status-msg.component.html',
  styleUrls: ['./status-msg.component.scss'],
})
export class StatusMsgComponent {
  @Input() type: StatusType = 'info';
  @Input() message = '';

  @Output() close = new EventEmitter<void>();

  onClose(): void {
    this.close.emit();
  }

  get icon(): string {
    switch (this.type) {
      case 'success':
        return '✓';
      case 'error':
        return '⚠';
      default:
        return 'ℹ';
    }
  }
}
