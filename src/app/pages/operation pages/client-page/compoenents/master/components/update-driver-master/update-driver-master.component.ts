// src/app/pages/.../client-page/components/update-driver-master/update-driver-master.component.ts
import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ApiDriver,
  DriversServiceService,
  UpdateDriverDto,
} from '../../../../../../../services/drivers/drivers-service.service';
import { DriverContractStatus } from '../../../../../../../shared/enums/driver-enums';


@Component({
  selector: 'app-update-driver-master',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './update-driver-master.component.html',
  styleUrl: './update-driver-master.component.scss',
})
export class UpdateDriverMasterComponent implements OnChanges {
  @Input() driverId: number | null = null;

  @Output() saved = new EventEmitter<ApiDriver>();
  @Output() cancel = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private driversService = inject(DriversServiceService);

  readonly loading = signal<boolean>(false);
  readonly saving = signal<boolean>(false);
  readonly error = signal<string>('');
  readonly success = signal<string>('');

  // ✅ ممكن تستخدمها في template كـ <option *ngFor="let s of contractStatusOptions">
  readonly contractStatusOptions: readonly DriverContractStatus[] = [
    'Active',
    'Inactive',
    'Unreachable/Reschedule',
    'Resigned',
    'Hold zone',
  ];

  // NOTE: فورم “واسعة” تغطي أغلب حقول الـ API
  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    fullNameArabic: [''],
    email: [''],
    courierPhone: [''],
    courierId: [''],
    residence: [''],
    courierCode: [''],
    clientName: [''],
    hub: [''],
    area: [''],
    module: [''],
    vehicleType: [''],
    contractor: [''],
    pointOfContact: [''],
    accountManager: [''],
    interviewer: [''],
    hrRepresentative: [''],
    hiringDate: [''],
    day1Date: [''],
    vLicenseExpiryDate: [''],
    dLicenseExpiryDate: [''],
    idExpiryDate: [''],

    // ✅ number | null
    liabilityAmount: this.fb.control<number | null>(null),

    signed: [false],

    // ✅ هنخليها string في الفورم للـ select/ngModel سهولة، ونحوّلها عند الإرسال
    contractStatus: [''],

    hiringStatus: [''],
    securityQueryStatus: [''],
    securityQueryComment: [''],
    exceptionBy: [''],
    notes: [''],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['driverId']) this.load();
  }

  private toDateInput(v: any): string {
    if (!v) return '';
    const s = String(v);
    return s.length >= 10 ? s.slice(0, 10) : s;
  }

  private emptyToNull(v: any): string | null {
    const s = String(v ?? '').trim();
    return s ? s : null;
  }

  private numOrNull(v: any): number | null {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  // ✅ CAST: string -> DriverContractStatus | null
  private toDriverContractStatusOrNull(v: any): DriverContractStatus | null {
    const s = String(v ?? '').trim();
    if (!s) return null;

    return (this.contractStatusOptions as readonly string[]).includes(s)
      ? (s as DriverContractStatus)
      : null;
  }

  load(): void {
    const id = this.driverId;
    this.success.set('');
    this.error.set('');

    if (!id) {
      this.form.reset();
      return;
    }

    this.loading.set(true);

    this.driversService.getDriver(id).subscribe({
      next: (d) => {
        this.form.patchValue({
          name: d.name ?? '',
          fullNameArabic: d.fullNameArabic ?? '',
          email: d.email ?? '',
          courierPhone: d.courierPhone ?? '',
          courierId: d.courierId ?? '',
          residence: d.residence ?? '',
          courierCode: d.courierCode ?? '',
          clientName: d.clientName ?? '',
          hub: d.hub ?? '',
          area: d.area ?? '',
          module: d.module ?? '',
          vehicleType: d.vehicleType ?? '',
          contractor: d.contractor ?? '',
          pointOfContact: d.pointOfContact ?? '',
          accountManager: d.accountManager ?? '',
          interviewer: d.interviewer ?? '',
          hrRepresentative: d.hrRepresentative ?? '',
          hiringDate: this.toDateInput(d.hiringDate),
          day1Date: this.toDateInput(d.day1Date),
          vLicenseExpiryDate: this.toDateInput(d.vLicenseExpiryDate),
          dLicenseExpiryDate: this.toDateInput(d.dLicenseExpiryDate),
          idExpiryDate: this.toDateInput(d.idExpiryDate),

          liabilityAmount: d.liabilityAmount ?? null,

          signed: !!d.signed,

          // ✅ نحط القيمة كـ string في الفورم
          contractStatus: (d.contractStatus ?? '') as any,

          hiringStatus: d.hiringStatus ?? '',
          securityQueryStatus: d.securityQueryStatus ?? '',
          securityQueryComment: d.securityQueryComment ?? '',
          exceptionBy: d.exceptionBy ?? '',
          notes: d.notes ?? '',
        });

        this.form.markAsPristine();
        this.loading.set(false);
      },
      error: (e) => {
        console.error('Failed to load driver for update', e);
        this.loading.set(false);
        this.error.set('Failed to load driver data.');
      },
    });
  }

  submit(): void {
    const id = this.driverId;
    this.success.set('');
    this.error.set('');

    if (!id) return;

    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.error.set('Please fix validation errors.');
      return;
    }

    const v = this.form.getRawValue();

    const body: UpdateDriverDto = {
      name: String(v.name).trim(),
      fullNameArabic: this.emptyToNull(v.fullNameArabic),
      email: this.emptyToNull(v.email),
      courierPhone: this.emptyToNull(v.courierPhone),
      courierId: this.emptyToNull(v.courierId),
      residence: this.emptyToNull(v.residence),
      courierCode: this.emptyToNull(v.courierCode),
      clientName: this.emptyToNull(v.clientName),
      hub: this.emptyToNull(v.hub),
      area: this.emptyToNull(v.area),
      module: this.emptyToNull(v.module),
      vehicleType: this.emptyToNull(v.vehicleType),
      contractor: this.emptyToNull(v.contractor),
      pointOfContact: this.emptyToNull(v.pointOfContact),
      accountManager: this.emptyToNull(v.accountManager),
      interviewer: this.emptyToNull(v.interviewer),
      hrRepresentative: this.emptyToNull(v.hrRepresentative),
      hiringDate: this.emptyToNull(v.hiringDate),
      day1Date: this.emptyToNull(v.day1Date),
      vLicenseExpiryDate: this.emptyToNull(v.vLicenseExpiryDate),
      dLicenseExpiryDate: this.emptyToNull(v.dLicenseExpiryDate),
      idExpiryDate: this.emptyToNull(v.idExpiryDate),

      liabilityAmount: this.numOrNull(v.liabilityAmount),

      signed: !!v.signed,

      // ✅ هنا التصليح الأساسي
      contractStatus: this.toDriverContractStatusOrNull(v.contractStatus),

      hiringStatus: this.emptyToNull(v.hiringStatus),
      securityQueryStatus: this.emptyToNull(v.securityQueryStatus),
      securityQueryComment: this.emptyToNull(v.securityQueryComment),
      exceptionBy: this.emptyToNull(v.exceptionBy),
      notes: this.emptyToNull(v.notes),
    };

    this.saving.set(true);

    this.driversService.updateDriver(id, body).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.success.set('Saved successfully.');
        this.form.markAsPristine();
        this.saved.emit(updated);
      },
      error: (e) => {
        console.error('Update failed', e);
        this.saving.set(false);
        this.error.set('Failed to save changes.');
      },
    });
  }

  onCancel(): void {
    this.cancel.emit();
  }

  // helpers for template
  ctrl(name: string) {
    return this.form.get(name);
  }
}
