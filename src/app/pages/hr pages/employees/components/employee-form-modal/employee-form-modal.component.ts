import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  Employee,
  MaritalStatus,
  Religion,
} from '../../../../../services/employs/employs-service.service';

import { StatusMsgComponent, StatusType } from '../../../../../components/status-msg/status-msg.component';

export interface StatusState {
  type: StatusType;
  message: string;
}

export interface EmployeeFormEmployment {
  isWorking: boolean;
  department: Department | null;
  jobTitle: string | null;
  corporateEmail: string | null;
  hireDate: string | null;
  terminationDate: string | null;
  companyCode: string | null;
  adminNotes: string | null;

  annualLeaveBalance: number;
  annualLeaveUsed: number;
  annualLeaveRemaining: number;

  nationalIdExpiryDate?: string | null;
  companyNumber?: string | null;
  personalPhone?: string | null;
  missingPapersText?: string | null;
  sheetLastUpdateAt?: string | null;
}

export type Department = 'crm' | 'operation' | 'hr' | 'finance' | 'supply_chain';

const DEPARTMENT_OPTIONS: Array<{ key: Department; label: string }> = [
  { key: 'crm', label: 'CRM' },
  { key: 'operation', label: 'Operation' },
  { key: 'hr', label: 'HR' },
  { key: 'finance', label: 'Finance' },
  { key: 'supply_chain', label: 'Supply Chain' },
];

export interface EmployeeFormValue {
  fullName: string;
  nationalId: string;

  birthDate: string | null;
  maritalStatus: MaritalStatus;
  religion: Religion;
  nationality: string | null;
  birthPlace: string | null;
  fullAddress: string | null;

  employment: EmployeeFormEmployment;
}

function createEmptyEmployment(): EmployeeFormEmployment {
  return {
    isWorking: true,
    department: null,
    jobTitle: null,
    corporateEmail: null,
    hireDate: null,
    terminationDate: null,
    companyCode: null,
    adminNotes: null,

    annualLeaveBalance: 21,
    annualLeaveUsed: 0,
    annualLeaveRemaining: 21,

    nationalIdExpiryDate: null,
    companyNumber: null,
    personalPhone: null,
    missingPapersText: null,
    sheetLastUpdateAt: null,
  };
}

function createEmptyForm(): EmployeeFormValue {
  return {
    fullName: '',
    nationalId: '',
    birthDate: null,
    maritalStatus: 'unknown',
    religion: 'unknown',
    nationality: 'Egyptian',
    birthPlace: null,
    fullAddress: null,
    employment: createEmptyEmployment(),
  };
}

@Component({
  standalone: true,
  selector: 'app-employee-form-modal',
  templateUrl: './employee-form-modal.component.html',
  styleUrls: ['./employee-form-modal.component.scss'],
  imports: [CommonModule, FormsModule, StatusMsgComponent],
})
export class EmployeeFormModalComponent implements OnInit, OnChanges {
  @Input() employeeToEdit: Employee | null = null;

  /** ✅ Status from parent (create/update errors) */
  @Input() status: StatusState | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() submit = new EventEmitter<EmployeeFormValue>();

  /** ✅ Let parent clear status */
  @Output() clearStatus = new EventEmitter<void>();

  form: EmployeeFormValue = createEmptyForm();
  departmentOptions = DEPARTMENT_OPTIONS;

  submitted = false;

  ngOnInit(): void {
    this.resetFormFromInput();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['employeeToEdit']) {
      this.resetFormFromInput();
      this.submitted = false;
    }
  }

  // ===== Form lifecycle =====
  private resetFormFromInput(): void {
    if (!this.employeeToEdit) {
      this.form = createEmptyForm();
      this.recalcAnnualLeave();
      return;
    }

    this.form = this.mapEmployeeToForm(this.employeeToEdit);
    this.recalcAnnualLeave();
  }

  private mapEmployeeToForm(e: Employee): EmployeeFormValue {
    const emp = (e as any).employment || {};

    const balance = this.toNumber(emp.annualLeaveBalance, 21);
    const used = this.toNumber(emp.annualLeaveUsed, 0);
    const remaining =
      emp.annualLeaveRemaining != null
        ? this.toNumber(emp.annualLeaveRemaining, Math.max(balance - used, 0))
        : Math.max(balance - used, 0);

    return {
      fullName: e.fullName ?? '',
      nationalId: e.nationalId ?? '',

      birthDate: (e as any).birthDate ?? null,
      maritalStatus: ((e as any).maritalStatus as MaritalStatus) ?? 'unknown',
      religion: ((e as any).religion as Religion) ?? 'unknown',
      nationality: (e as any).nationality ?? null,
      birthPlace: (e as any).birthPlace ?? null,
      fullAddress: (e as any).fullAddress ?? null,

      employment: {
        ...createEmptyEmployment(),
        isWorking: emp.isWorking ?? true,
        department: (emp.department as Department) ?? null,
        jobTitle: emp.jobTitle ?? null,
        corporateEmail: emp.corporateEmail ?? null,
        hireDate: emp.hireDate ?? null,
        terminationDate: emp.terminationDate ?? null,
        companyCode: emp.companyCode ?? null,
        adminNotes: emp.adminNotes ?? null,

        annualLeaveBalance: balance,
        annualLeaveUsed: used,
        annualLeaveRemaining: remaining,

        nationalIdExpiryDate: emp.nationalIdExpiryDate ?? null,
        companyNumber: emp.companyNumber ?? null,
        personalPhone: emp.personalPhone ?? null,
        missingPapersText: emp.missingPapersText ?? null,
        sheetLastUpdateAt: emp.sheetLastUpdateAt ?? null,
      },
    };
  }

  // ===== Helpers =====
  private toNumber(value: any, fallback: number): number {
    if (value === null || value === undefined || value === '') return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  recalcAnnualLeave(): void {
    if (!this.form.employment) {
      this.form.employment = createEmptyEmployment();
    }

    const bal = this.toNumber(this.form.employment.annualLeaveBalance, 21);
    const used = this.toNumber(this.form.employment.annualLeaveUsed, 0);

    this.form.employment.annualLeaveBalance = bal;
    this.form.employment.annualLeaveUsed = used;
    this.form.employment.annualLeaveRemaining = Math.max(bal - used, 0);
  }

  // ===== UI Change handlers =====
  onWorkingChange(v: any): void {
    this.form.employment.isWorking = v === true || v === 'true';
  }

  onAnnualLeaveBalanceChange(v: any): void {
    this.form.employment.annualLeaveBalance = this.toNumber(v, 21);
    this.recalcAnnualLeave();
  }

  onAnnualLeaveUsedChange(v: any): void {
    this.form.employment.annualLeaveUsed = this.toNumber(v, 0);
    this.recalcAnnualLeave();
  }

  // ===== Submit =====
  onSubmit(): void {
    this.submitted = true;

    const fullName = (this.form.fullName || '').trim();
    const nationalId = (this.form.nationalId || '').trim();

    // لو في status قديم من السيرفر، نخليه يتقفل لما يبدأ تصحيح errors
    if (this.status) this.clearStatus.emit();

    if (!fullName || !nationalId) {
      return; // field errors already shown
    }

    this.recalcAnnualLeave();

    this.submit.emit({
      ...this.form,
      fullName,
      nationalId,
      employment: {
        ...this.form.employment,
        annualLeaveBalance: this.toNumber(this.form.employment.annualLeaveBalance, 21),
        annualLeaveUsed: this.toNumber(this.form.employment.annualLeaveUsed, 0),
        annualLeaveRemaining: this.toNumber(this.form.employment.annualLeaveRemaining, 0),
      },
    });
  }
}