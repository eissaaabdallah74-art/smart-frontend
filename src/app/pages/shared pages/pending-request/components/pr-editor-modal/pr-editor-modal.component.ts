import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormArray, FormGroup } from '@angular/forms';

import { ApiClient } from '../../../../../services/clients/clients-service.service';
import { ApiHub, ApiZone } from '../../../../../services/hubs-zones/hubs-zones-service.service';
import { PendingRequestPriority, VehicleType } from '../../../../../services/pending request/pending-request-service.service';

@Component({
  selector: 'app-pr-editor-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './pr-editor-modal.component.html',
  styleUrls: ['./pr-editor-modal.component.scss'],
})
export class PrEditorModalComponent {
  @Input() open = false;
  @Input() loading = false;
  @Input() isEditMode = false;

  @Input() form!: FormGroup;

  @Input() clients: ApiClient[] = [];
  @Input() hubs: ApiHub[] = [];
  @Input() zones: ApiZone[] = [];

  @Input() priorities: { value: PendingRequestPriority | ''; label: string }[] = [];
  @Input() vehicleTypes: { value: VehicleType; label: string }[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() submit = new EventEmitter<void>();
  @Output() addItem = new EventEmitter<void>();
  @Output() removeItem = new EventEmitter<number>();
  @Output() increment = new EventEmitter<number>();
  @Output() decrement = new EventEmitter<number>();

  stop(ev: Event): void { ev.stopPropagation(); }

  get itemsArray(): FormArray {
    return this.form.get('items') as FormArray;
  }

  // ✅ Labels helpers (avoid "as any" in template)
  getClientLabel(c: ApiClient): string {
    const name = (c as any)?.name;
    return (name && String(name).trim()) ? String(name) : `Client #${(c as any)?.id ?? ''}`;
  }

  getHubLabel(h: ApiHub): string {
    const name = (h as any)?.name;
    return (name && String(name).trim()) ? String(name) : `Hub #${(h as any)?.id ?? ''}`;
  }

  getZoneLabel(z: ApiZone): string {
    const name = (z as any)?.name;
    return (name && String(name).trim()) ? String(name) : `Zone #${(z as any)?.id ?? ''}`;
  }
}