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

export interface DriverFormValue {
  name: string;
  fullNameArabic: string;
  email: string;
  courierPhone: string;
  courierId: string;
  residence: string;
  courierCode: string;
  clientName: string;
  hub: string;
  area: string;
  module: string;
  vehicleType: string;
  contractor: string;
  pointOfContact: string;
  accountManager: string;
  interviewer: string;
  hrRepresentative: string;
  hiringDate: string | null;
  day1Date: string | null;
  vLicenseExpiryDate: string | null;
  dLicenseExpiryDate: string | null;
  idExpiryDate: string | null;
  liabilityAmount: number | null;
  signed: boolean;
  contractStatus: string;
  hiringStatus: string;
  securityQueryStatus: string;
  securityQueryComment: string;
  exceptionBy: string;
  notes: string;
}

export interface DriverToEdit extends DriverFormValue {
  id: number;
}

@Component({
  selector: 'app-drivers-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './drivers-form-modal.component.html',
  styleUrls: ['./drivers-form-modal.component.scss'],
})
export class DriversFormModalComponent implements OnChanges {
  @Input() driverToEdit: DriverToEdit | null = null;

  // من جدول clients
  @Input() clientNames: string[] = [];

  // من users role=operation
  @Input() operationNames: string[] = [];

  // من users role=hr
  @Input() hrNames: string[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() submit = new EventEmitter<DriverFormValue>();

  model: DriverFormValue = this.createEmptyModel();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['driverToEdit']) {
      if (this.driverToEdit) {
        const { id, ...rest } = this.driverToEdit;
        this.model = { ...this.createEmptyModel(), ...rest };
      } else {
        this.model = this.createEmptyModel();
      }
    }
  }

  private createEmptyModel(): DriverFormValue {
    return {
      name: '',
      fullNameArabic: '',
      email: '',
      courierPhone: '',
      courierId: '',
      residence: '',
      courierCode: '',
      clientName: '',
      hub: '',
      area: '',
      module: '',
      vehicleType: '',
      contractor: '',
      pointOfContact: '',
      accountManager: '',
      interviewer: '',
      hrRepresentative: '',
      hiringDate: null,
      day1Date: null,
      vLicenseExpiryDate: null,
      dLicenseExpiryDate: null,
      idExpiryDate: null,
      liabilityAmount: null,
      signed: false,
      contractStatus: '',
      hiringStatus: '',
      securityQueryStatus: '',
      securityQueryComment: '',
      exceptionBy: '',
      notes: '',
    };
  }

  onSubmit(form: NgForm): void {
    if (!form.valid) return;

    if (this.model.email && !/\S+@\S+\.\S+/.test(this.model.email)) {
      return;
    }

    this.submit.emit({ ...this.model });
  }
}
