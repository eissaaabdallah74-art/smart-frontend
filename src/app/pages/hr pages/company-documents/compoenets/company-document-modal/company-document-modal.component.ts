// src/app/pages/hr pages/company-documents/components/company-document-modal/company-document-modal.component.ts

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
  computed,
  inject,
  OnChanges,
  SimpleChanges,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CompanyDocument, CompanyDocumentType } from '../../../../../services/company-documents/company-documents.service';
import { CompanyRef } from '../../../../../models/company-documents/company-documents.models';

export type ModalMode = 'CREATE' | 'EDIT' | 'VIEW';

@Component({
  selector: 'app-company-document-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './company-document-modal.component.html',
  styleUrls: ['./company-document-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanyDocumentModalComponent implements OnChanges {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  @Input({ required: true }) open = false;
  @Input({ required: true }) mode: ModalMode = 'CREATE';

  @Input() companies: CompanyRef[] = [];
  @Input() types: CompanyDocumentType[] = [];

  @Input() value: CompanyDocument | null = null;
  @Input() busy = false;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Partial<CompanyDocument>>();

  readonly isView = computed(() => this.mode === 'VIEW');
  readonly title = computed(() => {
    if (this.mode === 'CREATE') return 'Add Document';
    if (this.mode === 'EDIT') return 'Edit Document';
    return 'View Document';
  });

  form = this.fb.group({
    companyId: ['', [Validators.required]],
    typeId: ['', [Validators.required]],

    documentNumber: [''],
    issueDate: [''],

    // smart UX
    isOngoing: [false],

    expiryDate: [''],
    validityYears: [null as any],

    currentLocation: [''],

    custodianRole: [''],
    custodianName: [''],
    custodianPhone: [''],
    custodianOrganization: [''],

    remindAt: [''],
    remindNote: [''],

    notes: [''],
  });

  private syncing = false;

  constructor() {
    // Smart UX: auto-calc behaviors
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.syncing) return;
      this.smartSync();
    });
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.open) this.requestClose();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.patchFromValue();
      queueMicrotask(() => {
        const el = document.querySelector<HTMLInputElement>('[data-autofocus="1"]');
        el?.focus();
      });
    }

    if (changes['mode']) {
      if (this.isView()) this.form.disable({ emitEvent: false });
      else this.form.enable({ emitEvent: false });

      // ensure ongoing state is applied after enabling/disabling
      queueMicrotask(() => this.smartSync(true));
    }
  }

  requestClose() {
    if (this.busy) return;
    this.closed.emit();
  }

  submit() {
    if (this.busy || this.isView()) return;

    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const raw = this.form.getRawValue();
    const normalize = (x: any) => (x === '' ? null : x);

    const payload: Partial<CompanyDocument> = {
      companyId: Number(raw.companyId),
      typeId: Number(raw.typeId),

      documentNumber: normalize(raw.documentNumber) as any,
      issueDate: normalize(raw.issueDate) as any,

      expiryDate: raw.isOngoing ? null : (normalize(raw.expiryDate) as any),
      validityYears: raw.isOngoing
        ? null
        : (raw.validityYears === null || raw.validityYears === ('' as any) ? null : Number(raw.validityYears)),

      currentLocation: normalize(raw.currentLocation) as any,

      custodianRole: normalize(raw.custodianRole) as any,
      custodianName: normalize(raw.custodianName) as any,
      custodianPhone: normalize(raw.custodianPhone) as any,
      custodianOrganization: normalize(raw.custodianOrganization) as any,

      remindAt: normalize(raw.remindAt) as any,
      remindNote: normalize(raw.remindNote) as any,

      notes: normalize(raw.notes) as any,
    };

    this.saved.emit(payload);
  }

  previewText = computed(() => {
    const raw = this.form.getRawValue();
    if (!raw) return null;

    const ongoing = !!raw.isOngoing;
    const expiry = raw.expiryDate || '';
    const issue = raw.issueDate || '';
    const years = raw.validityYears as any;

    const t = this.types?.find((x) => String(x.id) === String(raw.typeId));
    const soonDays = (t?.defaultSoonDays ?? 30) as number;

    if (ongoing) {
      return {
        main: 'Ongoing document: no expiry tracking.',
        sub: raw.remindAt ? `Reminder set on ${raw.remindAt}.` : 'You can still set a custom reminder if needed.',
      };
    }

    if (expiry) {
      const sub = raw.remindAt
        ? `Reminder set on ${raw.remindAt}.`
        : `Tip: reminder can be auto-set (${soonDays} day(s) before expiry).`;
      return { main: `Expiry is set on ${expiry}.`, sub };
    }

    if (issue && years) {
      return {
        main: 'Tip: set Validity (years) and we can auto-calc Expiry.',
        sub: 'Add expiry manually if needed.',
      };
    }

    return {
      main: 'Fill issue/expiry details to get smarter reminders.',
      sub: 'Select type to enable default reminder logic.',
    };
  });

  private patchFromValue() {
    const v = this.value;

    this.syncing = true;

    if (!v) {
      this.form.reset(
        {
          companyId: '',
          typeId: '',
          documentNumber: '',
          issueDate: '',
          isOngoing: false,
          expiryDate: '',
          validityYears: null,
          currentLocation: '',
          custodianRole: '',
          custodianName: '',
          custodianPhone: '',
          custodianOrganization: '',
          remindAt: '',
          remindNote: '',
          notes: '',
        },
        { emitEvent: false }
      );

      if (this.isView()) this.form.disable({ emitEvent: false });
      else this.form.enable({ emitEvent: false });

      this.syncing = false;
      this.smartSync(true);
      return;
    }

    const isOngoing = !v.expiryDate && !v.validityYears;

    this.form.reset(
      {
        companyId: (v.companyId ?? '') as any,
        typeId: (v.typeId ?? '') as any,
        documentNumber: v.documentNumber ?? '',
        issueDate: v.issueDate ?? '',
        isOngoing,

        expiryDate: v.expiryDate ?? '',
        validityYears: (v.validityYears ?? null) as any,

        currentLocation: v.currentLocation ?? '',
        custodianRole: (v as any)?.custodianRole ?? '',
        custodianName: (v as any)?.custodianName ?? '',
        custodianPhone: (v as any)?.custodianPhone ?? '',
        custodianOrganization: (v as any)?.custodianOrganization ?? '',

        remindAt: (v as any)?.remindAt ?? '',
        remindNote: (v as any)?.remindNote ?? '',

        notes: (v as any)?.notes ?? '',
      },
      { emitEvent: false }
    );

    if (this.isView()) this.form.disable({ emitEvent: false });
    else this.form.enable({ emitEvent: false });

    this.syncing = false;
    this.smartSync(true);
  }

  /**
   * Smart UX rules:
   * 1) isOngoing => disable/clear expiryDate & validityYears
   * 2) if issueDate + validityYears and expiryDate empty => auto compute expiryDate
   * 3) if expiryDate exists and remindAt empty => auto set remindAt using type.defaultSoonDays (fallback 30)
   */
  private smartSync(force = false) {
    const raw = this.form.getRawValue();
    if (!raw) return;

    this.syncing = true;

    const ongoing = !!raw.isOngoing;

    const expiryCtrl = this.form.get('expiryDate');
    const yearsCtrl = this.form.get('validityYears');
    const remindCtrl = this.form.get('remindAt');

    if (ongoing) {
      // disable + clear
      expiryCtrl?.disable({ emitEvent: false });
      yearsCtrl?.disable({ emitEvent: false });

      if (raw.expiryDate) expiryCtrl?.setValue('', { emitEvent: false });
      if (raw.validityYears) yearsCtrl?.setValue(null, { emitEvent: false });

      this.syncing = false;
      return;
    } else {
      // enable back (if not view)
      if (!this.isView()) {
        expiryCtrl?.enable({ emitEvent: false });
        yearsCtrl?.enable({ emitEvent: false });
      }
    }

    const issue = (raw.issueDate || '').trim();
    const expiry = (raw.expiryDate || '').trim();
    const years = raw.validityYears;

    // auto expiry
    if ((force || !expiry) && issue && years !== null && years !== undefined && years !== ('' as any)) {
      const y = Number(years);
      if (!Number.isNaN(y) && y > 0) {
        const computedExpiry = this.addYearsToDateStr(issue, y);
        if (computedExpiry && computedExpiry !== expiry) {
          expiryCtrl?.setValue(computedExpiry, { emitEvent: false });
        }
      }
    }

    // auto remind
    const finalExpiry = (this.form.get('expiryDate')?.value as string) || '';
    const remind = (raw.remindAt || '').trim();

    if (finalExpiry && (!remind || force)) {
      const typeId = String(raw.typeId || '');
      const t = this.types?.find((x) => String(x.id) === typeId);
      const soonDays = Number(t?.defaultSoonDays ?? 30);

      const autoRemind = this.subDaysFromDateStr(finalExpiry, Number.isNaN(soonDays) ? 30 : soonDays);
      if (autoRemind) {
        // only set if empty (or force)
        if (!remind || force) {
          remindCtrl?.setValue(autoRemind, { emitEvent: false });
        }
      }
    }

    this.syncing = false;
  }

  private addYearsToDateStr(dateStr: string, years: number): string | null {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    const y = d.getFullYear() + years;
    d.setFullYear(y);
    return this.toISODate(d);
  }

  private subDaysFromDateStr(dateStr: string, days: number): string | null {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    d.setDate(d.getDate() - days);
    return this.toISODate(d);
  }

  private toISODate(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
