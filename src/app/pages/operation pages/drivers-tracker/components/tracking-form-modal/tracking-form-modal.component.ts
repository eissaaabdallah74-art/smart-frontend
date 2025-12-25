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
import { ApiDriver } from '../../../../../services/drivers/drivers-service.service';
import { TrackingRow } from '../../../../../services/tracking/tracking-service.service';


export interface TrackingFormValue {
  driverId: number | null;
  dspShortcode: string;
  dasFirstName: string;
  dasLastName: string;
  dasUsername: string;
  visaSponsorshipOnDsp: 'yes' | 'no' | null;
  birthDate: string | null;
  vehiclePlateNumber: string;
  criminalRecordIssueDate: string | null;
  idExpiryDate: string | null;
  dLicenseExpiryDate: string | null;
  vLicenseExpiryDate: string | null;
  notes: string;
}

@Component({
  selector: 'app-tracking-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tracking-form-modal.component.html',
  styleUrls: ['./tracking-form-modal.component.scss'],
})
export class TrackingFormModalComponent implements OnChanges {
  @Input() row: TrackingRow | null = null;
  @Input() drivers: ApiDriver[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() submit = new EventEmitter<Partial<TrackingRow>>();

  form: TrackingFormValue = this.emptyForm();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['row']) {
      if (this.row) {
        this.form = {
          driverId: this.row.driverId,
          dspShortcode: this.row.dspShortcode || '',
          dasFirstName: this.row.dasFirstName || '',
          dasLastName: this.row.dasLastName || '',
          dasUsername: this.row.dasUsername || '',
          visaSponsorshipOnDsp: this.row.visaSponsorshipOnDsp || null,
          birthDate: this.row.birthDate || null,
          vehiclePlateNumber: this.row.vehiclePlateNumber || '',
          criminalRecordIssueDate: this.row.criminalRecordIssueDate || null,
          idExpiryDate: this.row.idExpiryDate || null,
          dLicenseExpiryDate: this.row.dLicenseExpiryDate || null,
          vLicenseExpiryDate: this.row.vLicenseExpiryDate || null,
          notes: this.row.notes || '',
        };
      } else {
        this.form = this.emptyForm();
      }
    }
  }

  private emptyForm(): TrackingFormValue {
    return {
      driverId: null,
      dspShortcode: '',
      dasFirstName: '',
      dasLastName: '',
      dasUsername: '',
      visaSponsorshipOnDsp: null,
      birthDate: null,
      vehiclePlateNumber: '',
      criminalRecordIssueDate: null,
      idExpiryDate: null,
      dLicenseExpiryDate: null,
      vLicenseExpiryDate: null,
      notes: '',
    };
  }

  get selectedDriver(): ApiDriver | undefined {
    if (!this.form.driverId) return undefined;
    return this.drivers.find((d) => d.id === this.form.driverId);
  }

  onDriverChange(): void {
    const d = this.selectedDriver;
    if (!d) return;

    if (!this.form.dasFirstName || !this.form.dasLastName) {
      const name = (d.name || '').trim();
      if (name) {
        const parts = name.split(/\s+/);
        if (!this.form.dasFirstName) this.form.dasFirstName = parts[0];
        if (!this.form.dasLastName && parts.length > 1) {
          this.form.dasLastName = parts[parts.length - 1];
        }
      }
    }
  }

  onSubmit(form: NgForm): void {
    if (!form.valid) return;
    if (!this.form.driverId) return;

    this.submit.emit({
      driverId: this.form.driverId,
      dspShortcode: this.form.dspShortcode || null,
      dasFirstName: this.form.dasFirstName || null,
      dasLastName: this.form.dasLastName || null,
      dasUsername: this.form.dasUsername || null,
      visaSponsorshipOnDsp: this.form.visaSponsorshipOnDsp || null,
      birthDate: this.form.birthDate || null,
      vehiclePlateNumber: this.form.vehiclePlateNumber || null,
      criminalRecordIssueDate: this.form.criminalRecordIssueDate || null,
      idExpiryDate: this.form.idExpiryDate || null,
      dLicenseExpiryDate: this.form.dLicenseExpiryDate || null,
      vLicenseExpiryDate: this.form.vLicenseExpiryDate || null,
      notes: this.form.notes || null,
    });
  }
}
