import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnDestroy,
  OnInit,
  computed,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import {
  DocType,
  EmployeeDocument,
  EmployeeEducation,
  EmployeePayrollInsurance,
  InsuranceStatus,
  EmployeesService,
} from '../../../../../services/employs/employs-service.service';

type MaritalStatus = 'unknown' | 'single' | 'married' | 'divorced' | 'widowed' | 'engaged';
type Religion = 'unknown' | 'muslim' | 'christian' | 'other';

interface EmployeeEmployment {
  isWorking?: boolean;
  department?: string | null;
  jobTitle?: string | null;
  corporateEmail?: string | null;
  hireDate?: string | null;
  terminationDate?: string | null;

  companyCode?: string | null;
  adminNotes?: string | null;

  missingPapersText?: string | null;
  sheetLastUpdateAt?: string | null;

  annualLeaveBalance?: number | null;
  annualLeaveUsed?: number | null;
  annualLeaveRemaining?: number | null;
}

interface EmployeeEducationVm {
  university?: string | null;
  faculty?: string | null;
  degree?: string | null;
  graduationYear?: number | null;
  gpa?: string | null;
  notes?: string | null; // UI only unless you add DB column
}

interface EmployeeDetailsVm {
  id: number;
  fullName: string;
  nationalId: string;

  birthDate?: string | null;
  maritalStatus?: MaritalStatus | null;
  religion?: Religion | null;
  nationality?: string | null;
  birthPlace?: string | null;
  fullAddress?: string | null;

  employment?: EmployeeEmployment | null;

  documents?: EmployeeDocument[];
  educations?: EmployeeEducation[];
  education?: EmployeeEducationVm | null;

  payroll?: EmployeePayrollInsurance | null;
}

@Component({
  standalone: true,
  selector: 'app-employee-details-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './employee-details.component.html',
  styleUrl: './employee-details.component.scss',
})
export class EmployeeDetailsComponent implements OnInit, OnDestroy {
  /** Optional: use as drawer by passing employeeId, and listening to close */
  @Input() employeeId: number | null = null;
  @Output() close = new EventEmitter<void>();

  loading = signal<boolean>(true);
  employee = signal<EmployeeDetailsVm | null>(null);
  errorMsg = signal<string | null>(null);

  editingBasic = signal<boolean>(false);
  editingEmployment = signal<boolean>(false);
  editingEducation = signal<boolean>(false);
  editingDocuments = signal<boolean>(false);
  editingPayroll = signal<boolean>(false);

  statusMsg = signal<{ type: 'success' | 'error'; text: string } | null>(null);
  private statusTimer: any = null;

  private sub?: Subscription;

  // ===== Documents checklist options =====
  documentOptions: Array<{ key: DocType; label: string }> = [
    { key: 'work_stub', label: 'Work stub' },
    { key: 'insurance_print', label: 'Insurance print' },
    { key: 'id_copy', label: 'ID copy' },
    { key: 'criminal_record', label: 'Criminal record' },
    { key: 'utilities_receipt', label: 'Utilities receipt' },
    { key: 'personal_photos', label: 'Personal photos' },
    { key: 'qualification', label: 'Qualification' },
    { key: 'birth_certificate', label: 'Birth certificate' },
    { key: 'military_status', label: 'Military status' },
    { key: 'employment_contract', label: 'Employment contract' },
    { key: 'other', label: 'Other' },
  ];

  // checkbox map: docType -> received?
  docsForm: Record<string, boolean> = {};

  docsMissingCount = computed(() => {
    let missing = 0;
    for (const d of this.documentOptions) if (this.docsForm[d.key] !== true) missing++;
    return missing;
  });

  docsReceivedCount = computed(() => {
    let ok = 0;
    for (const d of this.documentOptions) if (this.docsForm[d.key] === true) ok++;
    return ok;
  });

  // ===== Payroll =====
  payrollLoading = signal<boolean>(false);
  payrollError = signal<string | null>(null);
  payrollRow = signal<EmployeePayrollInsurance | null>(null);
  private payrollLoadedForId: number | null = null;

  payrollPendingCount = computed(() => {
    const p = this.payrollRow();
    if (!p) return 0;
    let c = 0;
    if (p.medicalInsuranceStatus !== 'done') c++;
    if (p.socialInsuranceStatus !== 'done') c++;
    return c;
  });

  payrollForm: {
    medicalInsuranceStatus: InsuranceStatus;
    socialInsuranceStatus: InsuranceStatus;
    grossSalary: string | null;
    insuredSalary: string | null;
    employeeShare11: string | null;
    employerShare1875: string | null;
  } = {
    medicalInsuranceStatus: 'not_insured',
    socialInsuranceStatus: 'not_insured',
    grossSalary: null,
    insuredSalary: null,
    employeeShare11: null,
    employerShare1875: null,
  };

  insuranceStatusOptions: Array<{ key: InsuranceStatus; label: string }> = [
    { key: 'done', label: 'Done' },
    { key: 'pending', label: 'Pending' },
    { key: 'not_insured', label: 'Not insured' },
  ];

  // ===== Local forms =====
  basicForm = {
    fullName: '',
    nationalId: '',
    birthDate: null as string | null,
    maritalStatus: 'unknown' as MaritalStatus,
    religion: 'unknown' as Religion,
    nationality: null as string | null,
    birthPlace: null as string | null,
    fullAddress: null as string | null,
  };

  employmentForm = {
    isWorking: true,
    department: null as string | null,
    jobTitle: null as string | null,
    corporateEmail: null as string | null,
    hireDate: null as string | null,
    terminationDate: null as string | null,

    companyCode: null as string | null,
    adminNotes: null as string | null,

    missingPapersText: null as string | null,
    sheetLastUpdateAt: null as string | null,

    annualLeaveBalance: 21,
    annualLeaveUsed: 0,
    annualLeaveRemaining: 21,
  };

  educationForm = {
    university: null as string | null,
    faculty: null as string | null,
    degree: null as string | null,
    graduationYear: null as number | null,
    gpa: null as string | null,
    notes: null as string | null,
  };

  missingPapersList = computed(() => {
    const e = this.employee();
    const txt = e?.employment?.missingPapersText || '';
    if (!txt) return [];
    return String(txt)
      .split(/\r?\n|,|;/g)
      .map((s) => s.trim())
      .filter(Boolean);
  });

  // ===== Quick header stats =====
  isWorkingLabel = computed(() => {
    const e = this.employee();
    const v = e?.employment?.isWorking;
    if (typeof v !== 'boolean') return '—';
    return v ? 'Working' : 'Not working';
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private employees: EmployeesService
  ) {}

  ngOnInit(): void {
    // Init docs defaults once
    this.initDocsFormDefaults();

    // Drawer usage (Input employeeId)
    if (this.employeeId && Number.isFinite(this.employeeId)) {
      this.fetch(this.employeeId);
      return;
    }

    // Page usage (/hr/employees/:id)
    this.sub = this.route.paramMap.subscribe((pm) => {
      const id = Number(pm.get('id'));
      if (!id) {
        this.loading.set(false);
        this.errorMsg.set('Invalid employee id.');
        return;
      }
      this.fetch(id);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.statusTimer) clearTimeout(this.statusTimer);
  }

  /** Used to emulate the Interview UX: drawer vs standalone route */
  get isStandaloneRoute(): boolean {
    const idParam = this.route.snapshot.paramMap.get('id');
    return !!idParam && !this.close.observers.length;
  }

  get initials(): string {
    const name = this.employee()?.fullName || '';
    if (!name.trim()) return '?';
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
    return (first + last).toUpperCase();
  }

  editingAny(): boolean {
    return (
      this.editingBasic() ||
      this.editingEmployment() ||
      this.editingEducation() ||
      this.editingDocuments() ||
      this.editingPayroll()
    );
  }

  onCloseClick(): void {
    if (this.isStandaloneRoute) {
      this.router.navigate(['/hr/employees']);
    } else {
      this.close.emit();
    }
  }

  // ===== Fetch =====
  private fetch(id: number): void {
    this.loading.set(true);
    this.errorMsg.set(null);

    // reset payroll cache for new employee
    this.payrollLoadedForId = null;
    this.payrollRow.set(null);
    this.payrollError.set(null);

    this.employees.getEmployeeById(id).subscribe({
      next: (res: any) => {
        const adapted = this.adaptEmployeeResponse(res);
        this.employee.set(adapted);

        this.editingBasic.set(false);
        this.editingEmployment.set(false);
        this.editingEducation.set(false);
        this.editingDocuments.set(false);
        this.editingPayroll.set(false);

        this.fillFormsFromEmployee();

        // Documents
        const docsFromEmployee = (res?.documents || []) as EmployeeDocument[];
        if (Array.isArray(docsFromEmployee) && docsFromEmployee.length) {
          this.patchDocsFormFromList(docsFromEmployee);
        } else {
          this.loadDocuments(id);
        }

        // Education
        const eduFromEmployee = (res?.educations || []) as EmployeeEducation[];
        if (Array.isArray(eduFromEmployee) && eduFromEmployee.length) {
          this.patchEducationFromList(eduFromEmployee);
        } else {
          this.loadEducation(id);
        }

        // Payroll
        this.loadPayroll(id, true);

        this.loading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.loading.set(false);
        this.errorMsg.set(err?.error?.message || 'Failed to load employee.');
      },
    });
  }

  // ===== Adapter =====
  private adaptEmployeeResponse(res: any): EmployeeDetailsVm {
    const educations = (res?.educations || []) as EmployeeEducation[];

    const educationVm = educations.length
      ? this.mapEducationRowToVm(this.pickLatestEducation(educations))
      : (res?.education as EmployeeEducationVm) || null;

    return {
      ...(res as EmployeeDetailsVm),
      educations,
      education: educationVm,
    };
  }

  private pickLatestEducation(list: EmployeeEducation[]): EmployeeEducation {
    return [...list].sort((a, b) => Number(b.graduationYear || 0) - Number(a.graduationYear || 0))[0];
  }

  private mapEducationRowToVm(row: EmployeeEducation | null): EmployeeEducationVm | null {
    if (!row) return null;
    return {
      degree: row.degree ?? null,
      university: row.institute ?? null, // institute -> university
      faculty: row.major ?? null,        // major -> faculty
      graduationYear: row.graduationYear ?? null,
      gpa: row.grade ?? null,            // grade -> gpa
      notes: null,
    };
  }

  // ===== Status =====
  private setStatus(type: 'success' | 'error', text: string): void {
    if (this.statusTimer) clearTimeout(this.statusTimer);
    this.statusMsg.set({ type, text });
    this.statusTimer = setTimeout(() => {
      this.statusMsg.set(null);
      this.statusTimer = null;
    }, 3200);
  }

  // ===== Helpers =====
  formatDate(dateString?: string | null): string {
    if (!dateString) return '—';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return String(dateString);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  private toNumber(v: any, fallback: number): number {
    if (v === null || v === undefined || v === '') return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  private calcAnnualRemaining(balance: any, used: any): number {
    const b = this.toNumber(balance, 21);
    const u = this.toNumber(used, 0);
    return Math.max(b - u, 0);
  }

  private normalizeMoneyString(v: any): string | null {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (!s) return null;
    return s.replace(/,/g, '');
  }

  async copyToClipboard(value?: string | null): Promise<void> {
    const text = String(value || '').trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.setStatus('success', 'Copied.');
    } catch {
      // fallback
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        this.setStatus('success', 'Copied.');
      } catch {
        this.setStatus('error', 'Copy failed.');
      }
    }
  }

  // ===== Fill forms from current employee =====
  private fillFormsFromEmployee(): void {
    const e = this.employee();
    if (!e) return;

    this.basicForm = {
      fullName: e.fullName ?? '',
      nationalId: e.nationalId ?? '',
      birthDate: e.birthDate ?? null,
      maritalStatus: (e.maritalStatus ?? 'unknown') as MaritalStatus,
      religion: (e.religion ?? 'unknown') as Religion,
      nationality: e.nationality ?? null,
      birthPlace: e.birthPlace ?? null,
      fullAddress: e.fullAddress ?? null,
    };

    const emp = e.employment ?? {};

    const balance = this.toNumber(emp.annualLeaveBalance, 21);
    const used = this.toNumber(emp.annualLeaveUsed, 0);
    const remaining =
      emp.annualLeaveRemaining != null
        ? this.toNumber(emp.annualLeaveRemaining, this.calcAnnualRemaining(balance, used))
        : this.calcAnnualRemaining(balance, used);

    this.employmentForm = {
      isWorking: emp.isWorking ?? true,
      department: emp.department ?? null,
      jobTitle: emp.jobTitle ?? null,
      corporateEmail: emp.corporateEmail ?? null,
      hireDate: emp.hireDate ?? null,
      terminationDate: emp.terminationDate ?? null,

      companyCode: emp.companyCode ?? null,
      adminNotes: emp.adminNotes ?? null,

      missingPapersText: emp.missingPapersText ?? null,
      sheetLastUpdateAt: emp.sheetLastUpdateAt ?? null,

      annualLeaveBalance: balance,
      annualLeaveUsed: used,
      annualLeaveRemaining: remaining,
    };

    const edu = e.education ?? null;
    this.educationForm = {
      university: edu?.university ?? null,
      faculty: edu?.faculty ?? null,
      degree: edu?.degree ?? null,
      graduationYear: edu?.graduationYear ?? null,
      gpa: edu?.gpa ?? null,
      notes: edu?.notes ?? null,
    };
  }

  // ===== Edit toggles =====
  startEditBasic(): void {
    this.fillFormsFromEmployee();
    this.editingBasic.set(true);
    this.statusMsg.set(null);
  }
  cancelEditBasic(): void {
    this.editingBasic.set(false);
    this.fillFormsFromEmployee();
  }

  startEditEmployment(): void {
    this.fillFormsFromEmployee();
    this.editingEmployment.set(true);
    this.statusMsg.set(null);
  }
  cancelEditEmployment(): void {
    this.editingEmployment.set(false);
    this.fillFormsFromEmployee();
  }

  startEditEducation(): void {
    this.fillFormsFromEmployee();
    const e = this.employee();
    if (e) this.loadEducation(e.id);
    this.editingEducation.set(true);
    this.statusMsg.set(null);
  }
  cancelEditEducation(): void {
    this.editingEducation.set(false);
    this.fillFormsFromEmployee();
  }

  startEditDocuments(): void {
    const e = this.employee();
    if (!e) return;
    this.loadDocuments(e.id);
    this.editingDocuments.set(true);
    this.statusMsg.set(null);
  }

  cancelEditDocuments(): void {
    this.editingDocuments.set(false);
    const e = this.employee();
    if (!e) return;

    const docsFromEmployee = ((this.employee() as any)?.documents || []) as EmployeeDocument[];
    if (Array.isArray(docsFromEmployee) && docsFromEmployee.length) {
      this.patchDocsFormFromList(docsFromEmployee);
    } else {
      this.loadDocuments(e.id);
    }
  }

  startEditPayroll(): void {
    const e = this.employee();
    if (!e) return;
    this.loadPayroll(e.id, true);
    this.editingPayroll.set(true);
    this.statusMsg.set(null);
  }

  cancelEditPayroll(): void {
    this.editingPayroll.set(false);
    this.fillPayrollFormFromRow(this.payrollRow());
  }

  // ===== Annual leave recalculation =====
  onAnnualLeaveBalanceChange(v: any): void {
    this.employmentForm.annualLeaveBalance = this.toNumber(v, 21);
    this.employmentForm.annualLeaveRemaining = this.calcAnnualRemaining(
      this.employmentForm.annualLeaveBalance,
      this.employmentForm.annualLeaveUsed
    );
  }
  onAnnualLeaveUsedChange(v: any): void {
    this.employmentForm.annualLeaveUsed = this.toNumber(v, 0);
    this.employmentForm.annualLeaveRemaining = this.calcAnnualRemaining(
      this.employmentForm.annualLeaveBalance,
      this.employmentForm.annualLeaveUsed
    );
  }

  // ===== Documents =====
  private initDocsFormDefaults(): void {
    const next: Record<string, boolean> = {};
    for (const d of this.documentOptions) next[d.key] = false;
    this.docsForm = next;
  }

  private patchDocsFormFromList(list: EmployeeDocument[]): void {
    this.initDocsFormDefaults();
    for (const row of list || []) {
      const key = row.docType;
      if (!key) continue;
      const status = (row.status || 'missing') as any;
      this.docsForm[key] = status !== 'missing';
    }
  }

  private loadDocuments(employeeId: number): void {
    this.employees.listDocuments(employeeId).subscribe({
      next: (rows) => this.patchDocsFormFromList(rows || []),
      error: (err) => {
        console.error(err);
        this.setStatus('error', err?.error?.message || 'Failed to load documents.');
      },
    });
  }

  toggleDoc(key: DocType, ev: Event): void {
    const target = ev.target as HTMLInputElement;
    this.docsForm[key] = target.checked === true;
  }

  markAllDocumentsReceived(): void {
    for (const d of this.documentOptions) this.docsForm[d.key] = true;
  }

  markAllDocumentsMissing(): void {
    for (const d of this.documentOptions) this.docsForm[d.key] = false;
  }

  saveDocuments(): void {
    const e = this.employee();
    if (!e) return;

    const payload = {
      documents: this.documentOptions.map((d) => ({
        docType: d.key,
        status: this.docsForm[d.key] === true ? 'provided' : 'missing',
      })),
    };

    this.loading.set(true);
    this.employees.upsertDocuments(e.id, payload as any).subscribe({
      next: (saved) => {
        this.patchDocsFormFromList(saved || []);
        const current = this.employee();
        if (current) {
          (current as any).documents = saved || [];
          this.employee.set({ ...current });
        }

        this.loading.set(false);
        this.editingDocuments.set(false);
        this.setStatus('success', 'Documents updated.');
      },
      error: (err) => {
        console.error(err);
        this.loading.set(false);
        this.setStatus('error', err?.error?.message || 'Failed to update documents.');
      },
    });
  }

  // ===== Education =====
  private patchEducationFromList(list: EmployeeEducation[]): void {
    const latest = list?.length ? this.pickLatestEducation(list) : null;
    const vm = this.mapEducationRowToVm(latest);

    const current = this.employee();
    if (!current) return;

    this.employee.set({ ...current, educations: list || [], education: vm });

    if (!this.editingEducation()) {
      this.fillFormsFromEmployee();
    }
  }

  private loadEducation(employeeId: number): void {
    this.employees.listEducation(employeeId).subscribe({
      next: (rows) => this.patchEducationFromList(rows || []),
      error: (err) => {
        console.error(err);
        this.setStatus('error', err?.error?.message || 'Failed to load education.');
      },
    });
  }

  saveEducation(): void {
    const e = this.employee();
    if (!e) return;

    const degree = String(this.educationForm.degree || '').trim();
    if (!degree) {
      this.setStatus('error', 'Degree is required.');
      return;
    }

    const graduationYear =
      this.educationForm.graduationYear === null || (this.educationForm.graduationYear as any) === ''
        ? null
        : this.toNumber(this.educationForm.graduationYear, 0);

    const payload = {
      educations: [
        {
          degree,
          institute: this.educationForm.university ?? null,
          major: this.educationForm.faculty ?? null,
          graduationYear,
          grade: this.educationForm.gpa ?? null,
        },
      ],
    };

    this.loading.set(true);
    this.employees.replaceEducation(e.id, payload as any).subscribe({
      next: (saved) => {
        this.patchEducationFromList(saved || []);
        this.loading.set(false);
        this.editingEducation.set(false);
        this.setStatus('success', 'Education data updated.');
        this.fetch(e.id);
      },
      error: (err) => {
        console.error(err);
        this.loading.set(false);
        this.setStatus('error', err?.error?.message || 'Failed to update education data.');
      },
    });
  }

  // ===== Payroll =====
  private fillPayrollFormFromRow(row: EmployeePayrollInsurance | null): void {
    this.payrollForm = {
      medicalInsuranceStatus: (row?.medicalInsuranceStatus || 'not_insured') as InsuranceStatus,
      socialInsuranceStatus: (row?.socialInsuranceStatus || 'not_insured') as InsuranceStatus,
      grossSalary: row?.grossSalary ?? null,
      insuredSalary: row?.insuredSalary ?? null,
      employeeShare11: row?.employeeShare11 ?? null,
      employerShare1875: row?.employerShare1875 ?? null,
    };
  }

  private loadPayroll(employeeId: number, force = false): void {
    if (!force && this.payrollLoadedForId === employeeId) return;

    this.payrollLoading.set(true);
    this.payrollError.set(null);

    this.employees.getPayroll(employeeId).subscribe({
      next: (row) => {
        this.payrollLoadedForId = employeeId;
        this.payrollRow.set(row || null);
        this.fillPayrollFormFromRow(row || null);
        this.payrollLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.payrollLoading.set(false);

        const status = err?.status;
        if (status === 403) {
          this.payrollLoadedForId = employeeId;
          this.payrollError.set('You are not authorized to view Payroll/Insurances (Finance/Admin only).');
          this.payrollRow.set(null);
          return;
        }

        this.payrollError.set(err?.error?.message || 'Failed to load payroll.');
      },
    });
  }

  recalcSharesFromInsuredSalary(): void {
    const insured = this.normalizeMoneyString(this.payrollForm.insuredSalary);
    if (!insured) return;

    const base = Number(insured);
    if (!Number.isFinite(base) || base < 0) return;

    const employeeShare = base * 0.11;
    const employerShare = base * 0.1875;

    this.payrollForm.employeeShare11 = String(Math.round(employeeShare * 100) / 100);
    this.payrollForm.employerShare1875 = String(Math.round(employerShare * 100) / 100);
  }

  savePayroll(): void {
    const e = this.employee();
    if (!e) return;

    const payload = {
      medicalInsuranceStatus: this.payrollForm.medicalInsuranceStatus,
      socialInsuranceStatus: this.payrollForm.socialInsuranceStatus,
      grossSalary: this.normalizeMoneyString(this.payrollForm.grossSalary),
      insuredSalary: this.normalizeMoneyString(this.payrollForm.insuredSalary),
      employeeShare11: this.normalizeMoneyString(this.payrollForm.employeeShare11),
      employerShare1875: this.normalizeMoneyString(this.payrollForm.employerShare1875),
    };

    this.loading.set(true);
    this.payrollError.set(null);

    this.employees.upsertPayroll(e.id, payload as any).subscribe({
      next: (saved) => {
        this.payrollLoadedForId = e.id;
        this.payrollRow.set(saved || null);
        this.fillPayrollFormFromRow(saved || null);
        this.loading.set(false);
        this.editingPayroll.set(false);
        this.setStatus('success', 'Payroll updated.');
        this.fetch(e.id);
      },
      error: (err) => {
        console.error(err);
        this.loading.set(false);

        if (err?.status === 403) {
          this.payrollError.set('Not authorized to update Payroll (Finance/Admin only).');
          this.setStatus('error', 'Not authorized to update Payroll.');
          return;
        }

        this.payrollError.set(err?.error?.message || 'Failed to update payroll.');
        this.setStatus('error', err?.error?.message || 'Failed to update payroll.');
      },
    });
  }

  // ===== Save Basic / Employment =====
  saveBasic(): void {
    const e = this.employee();
    if (!e) return;

    const fullName = String(this.basicForm.fullName || '').trim();
    const nationalId = String(this.basicForm.nationalId || '').trim();

    if (!fullName || !nationalId) {
      this.setStatus('error', 'fullName and nationalId are required.');
      return;
    }

    const payload: Partial<EmployeeDetailsVm> = {
      fullName,
      nationalId,
      birthDate: this.basicForm.birthDate ?? null,
      maritalStatus: this.basicForm.maritalStatus ?? 'unknown',
      religion: this.basicForm.religion ?? 'unknown',
      nationality: this.basicForm.nationality ?? null,
      birthPlace: this.basicForm.birthPlace ?? null,
      fullAddress: this.basicForm.fullAddress ?? null,
    };

    this.loading.set(true);
    this.employees.updateEmployee(e.id, payload as any).subscribe({
      next: () => {
        this.setStatus('success', 'Basic data updated.');
        this.editingBasic.set(false);
        this.fetch(e.id);
      },
      error: (err) => {
        console.error(err);
        this.loading.set(false);
        this.setStatus('error', err?.error?.message || 'Failed to update basic data.');
      },
    });
  }

  saveEmployment(): void {
    const e = this.employee();
    if (!e) return;

    this.employmentForm.annualLeaveBalance = this.toNumber(this.employmentForm.annualLeaveBalance, 21);
    this.employmentForm.annualLeaveUsed = this.toNumber(this.employmentForm.annualLeaveUsed, 0);
    this.employmentForm.annualLeaveRemaining = this.calcAnnualRemaining(
      this.employmentForm.annualLeaveBalance,
      this.employmentForm.annualLeaveUsed
    );

    const payload: any = {
      employment: {
        ...(e.employment || {}),

        isWorking: !!this.employmentForm.isWorking,
        department: this.employmentForm.department ?? null,
        jobTitle: this.employmentForm.jobTitle ?? null,
        corporateEmail: this.employmentForm.corporateEmail ?? null,
        hireDate: this.employmentForm.hireDate ?? null,
        terminationDate: this.employmentForm.terminationDate ?? null,

        companyCode: this.employmentForm.companyCode ?? null,
        adminNotes: this.employmentForm.adminNotes ?? null,

        missingPapersText: this.employmentForm.missingPapersText ?? null,
        sheetLastUpdateAt: this.employmentForm.sheetLastUpdateAt ?? null,

        annualLeaveBalance: this.employmentForm.annualLeaveBalance,
        annualLeaveUsed: this.employmentForm.annualLeaveUsed,
        annualLeaveRemaining: this.employmentForm.annualLeaveRemaining,
      },
    };

    this.loading.set(true);
    this.employees.updateEmployee(e.id, payload).subscribe({
      next: () => {
        this.setStatus('success', 'Employment data updated.');
        this.editingEmployment.set(false);
        this.fetch(e.id);
      },
      error: (err) => {
        console.error(err);
        this.loading.set(false);
        this.setStatus('error', err?.error?.message || 'Failed to update employment data.');
      },
    });
  }
}
