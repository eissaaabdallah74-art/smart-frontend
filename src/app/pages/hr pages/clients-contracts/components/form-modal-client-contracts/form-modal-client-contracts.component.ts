import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ContractStatus } from '../../../../../services/clients-contracts/clients-contracts-service.service';


export type ContractFormValue = {
  clientId: number | null;
  contractNumber: string | null;
  startDate: string | null;
  endDate: string | null;
  duration: string | null;
  notes: string | null;
  status: ContractStatus;
  renewalAlertDate: string | null;
};

export interface ContractToEdit extends ContractFormValue {
  id: number;
}

@Component({
  selector: 'app-form-modal-client-contracts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './form-modal-client-contracts.component.html',
  styleUrl: './form-modal-client-contracts.component.scss',
})
export class FormModalClientContractsComponent implements OnChanges {
  @Input() contractToEdit: ContractToEdit | null = null;

  // لازم تختار client (dropdown)
  @Input() clients: { id: number; name: string }[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() submit = new EventEmitter<ContractFormValue>();

  model: ContractFormValue = {
    clientId: null,
    contractNumber: null,
    startDate: null,
    endDate: null,
    duration: null,
    notes: null,
    status: 'active',
    renewalAlertDate: null,
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['contractToEdit']) {
      if (this.contractToEdit) {
        this.model = {
          clientId: this.contractToEdit.clientId ?? null,
          contractNumber: this.contractToEdit.contractNumber ?? null,
          startDate: this.contractToEdit.startDate ?? null,
          endDate: this.contractToEdit.endDate ?? null,
          duration: this.contractToEdit.duration ?? null,
          notes: this.contractToEdit.notes ?? null,
          status: this.contractToEdit.status ?? 'active',
          renewalAlertDate: this.contractToEdit.renewalAlertDate ?? null,
        };
      } else {
        this.model = {
          clientId: null,
          contractNumber: null,
          startDate: null,
          endDate: null,
          duration: null,
          notes: null,
          status: 'active',
          renewalAlertDate: null,
        };
      }
    }
  }

  onSubmit(form: NgForm): void {
    if (!form.valid) return;

    if (!this.model.clientId) return;
    if (!this.model.startDate) return;

    // validation: endDate >= startDate
    if (this.model.endDate && new Date(this.model.endDate) < new Date(this.model.startDate)) {
      return;
    }

    this.submit.emit({ ...this.model });
  }
}
