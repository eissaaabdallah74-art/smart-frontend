// src/app/pages/hr pages/security-background-check/form-modal-security-background-check/form-modal-security-background-check.component.ts
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ApiInterview, UpdateInterviewDto, SecurityResult } from '../../../../../services/interviews/interviews-service.service';



@Component({
  selector: 'app-form-modal-security-background-check',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './form-modal-security-background-check.component.html',
  styleUrl: './form-modal-security-background-check.component.scss',
})
export class FormModalSecurityBackgroundCheckComponent implements OnChanges, AfterViewInit {
  @Input({ required: true }) interviewToEdit!: ApiInterview;

  @Input() saving = false;
  @Input() errorMessage = '';

  @Output() close = new EventEmitter<void>();
  @Output() submit = new EventEmitter<{ id: number; dto: UpdateInterviewDto }>();

  @ViewChild('securitySelect') securitySelect?: ElementRef<HTMLSelectElement>;

  model = {
    courierName: '',
    phoneNumber: '',
    residence: '',
    nationalId: '',

    clientId: null as number | null,
    hubId: null as number | null,
    zoneId: null as number | null,

    position: '',
    vehicleType: '',

    securityResult: null as SecurityResult | null,

    signedWithHr: '',
    courierStatus: '',

    hrFeedback: '',
    feedback: '',
    crmFeedback: '',

    followUp1: '',
    followUp2: '',
    followUp3: '',

    notes: '',
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['interviewToEdit'] && this.interviewToEdit) {
      const i = this.interviewToEdit;

      this.model = {
        courierName: i.courierName ?? '',
        phoneNumber: i.phoneNumber ?? '',
        residence: i.residence ?? '',
        nationalId: i.nationalId ?? '',

        clientId: i.clientId ?? null,
        hubId: i.hubId ?? null,
        zoneId: i.zoneId ?? null,

        position: i.position ?? '',
        vehicleType: i.vehicleType ?? '',

        securityResult: i.securityResult ?? null,

        signedWithHr: i.signedWithHr ?? '',
        courierStatus: i.courierStatus ?? '',

        hrFeedback: i.hrFeedback ?? '',
        feedback: i.feedback ?? '',
        crmFeedback: i.crmFeedback ?? '',

        followUp1: i.followUp1 ?? '',
        followUp2: i.followUp2 ?? '',
        followUp3: i.followUp3 ?? '',

        notes: i.notes ?? '',
      };

      queueMicrotask(() => this.focusSecurity());
    }
  }

  ngAfterViewInit(): void {
    this.focusSecurity();
  }

  private focusSecurity(): void {
    setTimeout(() => this.securitySelect?.nativeElement?.focus(), 0);
  }

  onBackdropClick(): void {
    if (this.saving) return;
    this.close.emit();
  }

  setSecurity(v: SecurityResult | null): void {
    this.model.securityResult = v;
    this.focusSecurity();
  }

  onSubmit(form: NgForm): void {
    if (this.saving) return;

    if (!this.interviewToEdit?.id) return;

    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }

    const toNullIfEmpty = (v: string) => {
      const s = (v ?? '').trim();
      return s ? s : null;
    };

    const dto: UpdateInterviewDto = {
      courierName: this.model.courierName.trim(),
      phoneNumber: this.model.phoneNumber.trim(),
      residence: toNullIfEmpty(this.model.residence),
      nationalId: toNullIfEmpty(this.model.nationalId),

      clientId: this.model.clientId ?? null,
      hubId: this.model.hubId ?? null,
      zoneId: this.model.zoneId ?? null,

      position: toNullIfEmpty(this.model.position),
      vehicleType: toNullIfEmpty(this.model.vehicleType),

      securityResult: this.model.securityResult ?? null,

      signedWithHr: toNullIfEmpty(this.model.signedWithHr),
      courierStatus: toNullIfEmpty(this.model.courierStatus),

      hrFeedback: toNullIfEmpty(this.model.hrFeedback),
      feedback: toNullIfEmpty(this.model.feedback),
      crmFeedback: toNullIfEmpty(this.model.crmFeedback),

      followUp1: toNullIfEmpty(this.model.followUp1),
      followUp2: toNullIfEmpty(this.model.followUp2),
      followUp3: toNullIfEmpty(this.model.followUp3),

      notes: toNullIfEmpty(this.model.notes),
    };

    this.submit.emit({ id: this.interviewToEdit.id, dto });
  }
}
