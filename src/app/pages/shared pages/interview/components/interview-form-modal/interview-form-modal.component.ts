// src/app/pages/.../interview/components/interview-form-modal/interview-form-modal.component.ts

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
import { CreateInterviewDto } from '../../../../../services/interviews/interviews-service.service';
import { InterviewRow } from '../../interview.component';

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
  @Output() submit = new EventEmitter<CreateInterviewDto>();

  // ===== Vehicle Types (must match backend enum) =====
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

  model = {
    courierName: '',
    phoneNumber: '',
    nationalId: '',
    residence: '',
    accountName: '',
    hubName: '',
    zoneName: '',
    position: '',
    vehicleType: '',

    accountManagerName: '',
    interviewerName: '',
    signedWithHr: '',
    feedback: '',
    courierStatus: '',
    notes: '',
  };

  readonly signedWithHrOptions: string[] = [
    'Signed A Contract With HR',
    'Will Think About Our Offers',
    'Missing documents',
    'Hiring from hold',
    'Unqualified',
  ];

  readonly courierStatusOptions: string[] = [
    'Active',
    'Unreachable/Reschedule',
    'Resigned',
    'Hold zone',
  ];

  hubs: ApiHub[] = [];
  zones: ApiZone[] = [];

  private hubsService = inject(HubsZonesService);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['interviewToEdit']) {
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
          position: r.position ?? '',
          vehicleType: (r.vehicleType ?? '').toString().trim(),

          accountManagerName: r.accountManager ?? '',
          interviewerName: r.interviewer ?? '',
          signedWithHr: r.signedWithHr ?? '',
          feedback: r.feedback ?? '',
          courierStatus: r.courierStatus ?? '',
          notes: r.notes ?? '',
        };

        this.loadHubsForAccount();
      } else {
        this.reset();
      }
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
      signedWithHr: '',
      feedback: '',
      courierStatus: '',
      notes: '',
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
      return;
    }
    this.hubsService.getHubsByClient(client.id).subscribe({
      next: (list) => {
        this.hubs = list;
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
      next: (list) => (this.zones = list),
      error: (err) => {
        console.error('load zones', err);
        this.zones = [];
      },
    });
  }

  onSubmit(form: NgForm): void {
    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }

    const client = this.clients.find((c) => c.name === this.model.accountName) || null;
    const hub = this.hubs.find((h) => h.name === this.model.hubName) || null;
    const zone = this.zones.find((z) => z.name === this.model.zoneName) || null;

    const accManager =
      this.operationUsers.find((u) => u.fullName === this.model.accountManagerName) || null;
    const interviewer =
      this.operationUsers.find((u) => u.fullName === this.model.interviewerName) || null;

    const dto: CreateInterviewDto = {
      ticketNo: undefined,
      crmFeedback: undefined,

      courierName: this.model.courierName,
      phoneNumber: this.model.phoneNumber,
      nationalId: this.model.nationalId,
      residence: this.model.residence,

      clientId: client?.id ?? null,
      hubId: hub?.id ?? null,
      zoneId: zone?.id ?? null,

      position: this.model.position,
      vehicleType: this.model.vehicleType || null,

      accountManagerId: accManager?.id ?? null,
      interviewerId: interviewer?.id ?? null,

      signedWithHr: this.model.signedWithHr || null,

      feedback: this.model.feedback,
      courierStatus: this.model.courierStatus,
      notes: this.model.notes,

      client: undefined,
      hub: undefined,
      zone: undefined,
      accountManager: undefined,
      interviewer: undefined,
    } as any;

    if (!dto.clientId) {
      console.warn('Client (account) is required');
      form.controls['account']?.setErrors({ required: true });
      return;
    }

    this.submit.emit(dto);
  }
}
