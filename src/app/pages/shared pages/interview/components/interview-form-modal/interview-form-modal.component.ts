import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';

import { ApiClient } from '../../../../../services/clients/clients-service.service';
import {
  ApiHub,
  ApiZone,
  HubsZonesService,
} from '../../../../../services/hubs-zones/hubs-zones-service.service';
import { ApiUser } from '../../../../../services/users/users-service.service';
import {
  CreateInterviewDto,
  UpdateInterviewDto,
} from '../../../../../services/interviews/interviews-service.service';
import { InterviewRow } from '../../interview.component';

import {
  DRIVER_CONTRACT_STATUSES,
  SIGNED_WITH_HR_STATUSES,
  type DriverContractStatus,
  type SignedWithHrStatus,
} from '../../../../../shared/enums/driver-enums';

export interface InterviewFormSubmitPayload {
  mode: 'create' | 'edit';
  createDto?: CreateInterviewDto;
  patch?: UpdateInterviewDto;
  changedFields?: string[];
}

@Component({
  selector: 'app-interview-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './interview-form-modal.component.html',
  styleUrl: './interview-form-modal.component.scss',
})
export class InterviewFormModalComponent implements OnChanges {
  @Input() interviewToEdit: InterviewRow | null = null;

  @Input() clients: ApiClient[] = [];
  @Input() operationUsers: ApiUser[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() submit = new EventEmitter<InterviewFormSubmitPayload>();

  readonly vehicleTypeOptions: string[] = [
    'SEDAN',
    'VAN',
    'BIKE',
    'DABABA',
    'NKR',
    'TRICYCLE',
    'JUMBO_4',
    'JUMBO_6',
    'HELPER',
    'DRIVER',
    'WORKER',
  ];

  // ✅ enums
  readonly signedWithHrOptions: SignedWithHrStatus[] = [...SIGNED_WITH_HR_STATUSES];
  readonly courierStatusOptions: DriverContractStatus[] = [...DRIVER_CONTRACT_STATUSES];

  model = {
    courierName: '',
    phoneNumber: '',
    nationalId: '',
    residence: '',
    accountName: '',
    hubName: '',
    zoneName: '',
    position: 'Courier',
    vehicleType: '',

    accountManagerName: '',
    interviewerName: '',

    signedWithHr: '' as '' | SignedWithHrStatus,
    feedback: '',
    courierStatus: '' as '' | DriverContractStatus,
    notes: '',

    vLicenseExpiryDate: '',
    dLicenseExpiryDate: '',
    idExpiryDate: '',
  };

  private originalModel: any = null; // snapshot for diff

  hubs: ApiHub[] = [];
  zones: ApiZone[] = [];

  private hubsService = inject(HubsZonesService);

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['interviewToEdit']) return;

    if (this.interviewToEdit) {
      const r = this.interviewToEdit;

      this.model = {
        courierName: r.courierName ?? '',
        phoneNumber: r.phoneNumber ?? '',
        nationalId: r.nationalId ?? '',
        residence: r.residence ?? '',
        accountName: r.account ?? '',
        hubName: r.hub ?? '',
        zoneName: r.zone ?? '',
        position: r.position ?? 'Courier',
        vehicleType: (r.vehicleType ?? '').toString().trim(),

        accountManagerName: r.accountManager ?? '',
        interviewerName: r.interviewer ?? '',

        signedWithHr: (r.signedWithHr ?? '') as any,
        feedback: r.feedback ?? '',
        courierStatus: (r.courierStatus ?? '') as any,
        notes: r.notes ?? '',

        vLicenseExpiryDate: r.vLicenseExpiryDate ?? '',
        dLicenseExpiryDate: r.dLicenseExpiryDate ?? '',
        idExpiryDate: r.idExpiryDate ?? '',
      };

      this.originalModel = JSON.parse(JSON.stringify(this.model));
      this.loadHubsForAccount();
    } else {
      this.reset();
      this.originalModel = JSON.parse(JSON.stringify(this.model));
    }
  }

  reset(): void {
    this.model = {
      courierName: '',
      phoneNumber: '',
      nationalId: '',
      residence: '',
      accountName: '',
      hubName: '',
      zoneName: '',
      position: 'Courier',
      vehicleType: '',

      accountManagerName: '',
      interviewerName: '',

      signedWithHr: '' as any,
      feedback: '',
      courierStatus: '' as any,
      notes: '',

      vLicenseExpiryDate: '',
      dLicenseExpiryDate: '',
      idExpiryDate: '',
    };

    this.hubs = [];
    this.zones = [];
  }

  onAccountChange(): void {
    this.model.hubName = '';
    this.model.zoneName = '';
    this.zones = [];
    this.loadHubsForAccount();
  }

  onHubChange(): void {
    this.model.zoneName = '';
    this.loadZonesForHub();
  }

  private loadHubsForAccount(): void {
    const client = this.clients.find((c) => c.name === this.model.accountName);
    if (!client) {
      this.hubs = [];
      this.zones = [];
      return;
    }

    this.hubsService.getHubsByClient(client.id).subscribe({
      next: (list) => {
        this.hubs = list || [];
        if (!this.hubs.some((h) => h.name === this.model.hubName)) {
          this.model.hubName = '';
          this.zones = [];
        } else {
          this.loadZonesForHub();
        }
      },
      error: (err) => {
        console.error('load hubs', err);
        this.hubs = [];
        this.zones = [];
      },
    });
  }

  private loadZonesForHub(): void {
    const hub = this.hubs.find((h) => h.name === this.model.hubName);
    if (!hub) {
      this.zones = [];
      return;
    }

    this.hubsService.getZonesByHub(hub.id).subscribe({
      next: (list) => (this.zones = list || []),
      error: (err) => {
        console.error('load zones', err);
        this.zones = [];
      },
    });
  }

  private buildCreateDto(form: NgForm): CreateInterviewDto | null {
    const client = this.clients.find((c) => c.name === this.model.accountName) || null;
    const hub = this.hubs.find((h) => h.name === this.model.hubName) || null;
    const zone = this.zones.find((z) => z.name === this.model.zoneName) || null;

    const accManager =
      this.operationUsers.find((u) => u.fullName === this.model.accountManagerName) || null;
    const interviewer =
      this.operationUsers.find((u) => u.fullName === this.model.interviewerName) || null;

    if (!client?.id) {
      form.controls['account']?.setErrors({ required: true });
      return null;
    }

    const isActive = (this.model.courierStatus || '').toLowerCase().trim() === 'active';
    if (isActive) {
      if (!hub?.id) form.controls['hub']?.setErrors({ required: true });
      if (!zone?.id) form.controls['zone']?.setErrors({ required: true });
      if (!this.model.vehicleType) form.controls['vehicleType']?.setErrors({ required: true });

      if (!hub?.id || !zone?.id || !this.model.vehicleType) {
        form.control.markAllAsTouched();
        return null;
      }
    }

    const dto: CreateInterviewDto = {
      date: new Date().toISOString().slice(0, 10),

      courierName: this.model.courierName,
      phoneNumber: this.model.phoneNumber,

      nationalId: this.model.nationalId || null,
      residence: this.model.residence || null,

      clientId: client.id,
      hubId: hub?.id ?? null,
      zoneId: zone?.id ?? null,

      position: this.model.position || null,
      vehicleType: this.model.vehicleType || null,

      accountManagerId: accManager?.id ?? null,
      interviewerId: interviewer?.id ?? null,

      signedWithHr: (this.model.signedWithHr || null) as any,

      feedback: this.model.feedback || null,
      courierStatus: (this.model.courierStatus || null) as any,
      notes: this.model.notes || null,

      vLicenseExpiryDate: this.model.vLicenseExpiryDate || null,
      dLicenseExpiryDate: this.model.dLicenseExpiryDate || null,
      idExpiryDate: this.model.idExpiryDate || null,
    } as any;

    return dto;
  }

  // build patch (only changed fields)
  private buildPatchFromDiff(
    createDto: CreateInterviewDto,
  ): { patch: UpdateInterviewDto; changed: string[] } {
    const patch: any = {};
    const changed: string[] = [];

    const allowed: (keyof CreateInterviewDto)[] = [
      'date',
      'courierName',
      'phoneNumber',
      'nationalId',
      'residence',
      'clientId',
      'hubId',
      'zoneId',
      'position',
      'vehicleType',
      'accountManagerId',
      'interviewerId',
      'signedWithHr',
      'feedback',
      'courierStatus',
      'notes',
      'vLicenseExpiryDate',
      'dLicenseExpiryDate',
      'idExpiryDate',
    ];

    const original = this.originalModel || {};
    const originalCreateLike: any = {
      courierName: original.courierName || '',
      phoneNumber: original.phoneNumber || '',
      nationalId: original.nationalId || null,
      residence: original.residence || null,
      position: original.position || null,
      vehicleType: original.vehicleType || null,
      signedWithHr: original.signedWithHr || null,
      feedback: original.feedback || null,
      courierStatus: original.courierStatus || null,
      notes: original.notes || null,
      vLicenseExpiryDate: original.vLicenseExpiryDate || null,
      dLicenseExpiryDate: original.dLicenseExpiryDate || null,
      idExpiryDate: original.idExpiryDate || null,
    };

    // ids come from edit row snapshot
    originalCreateLike.clientId = this.interviewToEdit?.clientId ?? null;
    originalCreateLike.hubId = this.interviewToEdit?.hubId ?? null;
    originalCreateLike.zoneId = this.interviewToEdit?.zoneId ?? null;
    originalCreateLike.accountManagerId = this.interviewToEdit?.accountManagerId ?? null;
    originalCreateLike.interviewerId = this.interviewToEdit?.interviewerId ?? null;

    for (const k of allowed) {
      if (k === 'date') continue; // avoid noise

      const before = originalCreateLike[k as any];
      const after = (createDto as any)[k];

      const eq =
        before === after ||
        (before == null && after === null) ||
        (before === '' && after === null) ||
        (before === null && after === '');

      if (!eq) {
        patch[k] = after;
        changed.push(String(k));
      }
    }

    return { patch, changed };
  }

  onSubmit(form: NgForm): void {
    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }

    const createDto = this.buildCreateDto(form);
    if (!createDto) return;

    if (!this.interviewToEdit) {
      this.submit.emit({ mode: 'create', createDto });
      return;
    }

    const { patch, changed } = this.buildPatchFromDiff(createDto);

    if (!changed.length) {
      this.close.emit();
      return;
    }

    this.submit.emit({ mode: 'edit', patch, changedFields: changed });
  }
}
