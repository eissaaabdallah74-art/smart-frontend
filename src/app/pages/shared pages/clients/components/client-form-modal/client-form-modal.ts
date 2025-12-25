// src/app/pages/shared pages/clients/components/client-form-modal/client-form-modal.ts
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

export type ClientFormValue = {
  name: string;
  crm: string | null;
  phoneNumber: string | null;
  pointOfContact: string | null;
  contactEmail: string | null;
  accountManager: string | null;
  // الحقول الجديدة
  contractDate?: string | null;
  contractTerminationDate?: string | null;
  isActive: boolean;
  company?: '1' | '2' | null;
  clientType?: string | null;
};

export interface ClientToEdit extends ClientFormValue {
  id: number;
}

@Component({
  standalone: true,
  selector: 'client-form-modal',
  imports: [CommonModule, FormsModule],
  templateUrl: './client-form-modal.html',
  styleUrls: ['./client-form-modal.scss'],
})
export class ClientFormModalComponent implements OnChanges {
  @Input() clientToEdit: ClientToEdit | null = null;
  @Input() accountManagerNames: string[] = [];
  @Input() crmNames: string[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() submit = new EventEmitter<ClientFormValue>();

  model: ClientFormValue = {
    name: '',
    crm: null,
    phoneNumber: null,
    pointOfContact: null,
    contactEmail: null,
    accountManager: null,
    // القيم الافتراضية للحقول الجديدة
    contractDate: null,
    contractTerminationDate: null,
    isActive: true,
    company: '1',
    clientType: 'Class A',
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['clientToEdit']) {
      if (this.clientToEdit) {
        // عند الـ Edit ناخد الداتا من الـ ApiClient مع ديفولت لو فاضي
        this.model = {
          name: this.clientToEdit.name ?? '',
          crm: this.clientToEdit.crm ?? null,
          phoneNumber: this.clientToEdit.phoneNumber ?? null,
          pointOfContact: this.clientToEdit.pointOfContact ?? null,
          contactEmail: this.clientToEdit.contactEmail ?? null,
          accountManager: this.clientToEdit.accountManager ?? null,
          contractDate: this.clientToEdit.contractDate ?? null,
          contractTerminationDate:
            this.clientToEdit.contractTerminationDate ?? null,
          isActive: this.clientToEdit.isActive,
          company: this.clientToEdit.company ?? '1',
          clientType: this.clientToEdit.clientType ?? 'Class A',
        };
      } else {
        // عند Add نرجع للقيم الديفولت
        this.model = {
          name: '',
          crm: null,
          phoneNumber: null,
          pointOfContact: null,
          contactEmail: null,
          accountManager: null,
          contractDate: null,
          contractTerminationDate: null,
          isActive: true,
          company: '1',
          clientType: 'Class A',
        };
      }
    }
  }

  onSubmit(form: NgForm): void {
    if (!form.valid) return;

    if (
      this.model.contactEmail &&
      !/\S+@\S+\.\S+/.test(this.model.contactEmail)
    ) {
      return;
    }

    // لو Inactive ومفيش termination date استخدم تاريخ اليوم
    if (!this.model.isActive && !this.model.contractTerminationDate) {
      this.model.contractTerminationDate = new Date()
        .toISOString()
        .split('T')[0];
    }

    // لو Active امسح termination date
    if (this.model.isActive) {
      this.model.contractTerminationDate = null;
    }

    // نتأكد من ديفولت company / clientType في الفورم برضه
    const payload: ClientFormValue = {
      ...this.model,
      company: this.model.company ?? '1',
      clientType: this.model.clientType ?? 'Class A',
    };

    this.submit.emit(payload);
  }

  onStatusChange(): void {
    console.log('Status changed to:', this.model.isActive);

    if (!this.model.isActive && !this.model.contractTerminationDate) {
      this.model.contractTerminationDate = new Date()
        .toISOString()
        .split('T')[0];
      console.log(
        'Set termination date to today:',
        this.model.contractTerminationDate
      );
    } else if (this.model.isActive) {
      this.model.contractTerminationDate = null;
      console.log('Cleared termination date');
    }

    // force change detection
    this.model = { ...this.model };
  }
}
