import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import {
  EmployeeOption,
  UsersServiceService,
  UserRole,
} from '../../../../../services/users/users-service.service';
import { Subscription } from 'rxjs';

export type UserPosition = 'manager' | 'supervisor' | 'senior' | 'junior';

export interface UserToEdit {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
  position?: UserPosition | null;
  isActive: boolean;
  hireDate?: string | null;
  terminationDate?: string | null;

  employeeProfile?: {
    id: number;
    employment?: { corporateEmail?: string | null } | null;
  } | null;
}

export interface UserFormValue {
  fullName: string;
  email: string;
  password: string;
  role: UserRole | '';
  position: UserPosition | '';
  isActive: boolean;
  hireDate?: string | null;
  terminationDate?: string | null;

  employeeId?: number | null;
}

@Component({
  selector: 'app-users-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users-form-modal.component.html',
  styleUrls: ['./users-form-modal.component.scss'],
})
export class UsersFormModalComponent implements OnChanges, OnDestroy {
  @Input() userToEdit: UserToEdit | null = null;
  @Input() roles: UserRole[] = [];

  /** يمنع double submit ويقفل الـ UI */
  @Input() saving = false;

  /** ✅ NEW: error message from parent (api) */
  @Input() apiError: string | null = null;

  /**
   * ✅ NEW: parent increments this number on every successful save.
   * modal watches it and auto closes.
   */
  @Input() submitSuccessTick = 0;

  @Output() close = new EventEmitter<void>();
  @Output() submit = new EventEmitter<UserFormValue>();

  model: UserFormValue = {
    fullName: '',
    email: '',
    password: '',
    role: '',
    position: '',
    isActive: true,
    hireDate: null,
    terminationDate: null,
    employeeId: null,
  };

  // Employees dropdown state
  employees: EmployeeOption[] = [];
  employeesLoading = false;
  employeesError = '';

  employeeDropdownOpen = false;
  employeeQuery = '';
  private employeeChanged = false;

  private sub?: Subscription;

  // for detecting success changes
  private lastSuccessTick = 0;

  readonly positionsMap: Record<UserRole, { value: UserPosition; label: string }[]> = {
    admin: [],
    hr: [
      { value: 'manager', label: 'Manager' },
      { value: 'senior', label: 'Senior' },
      { value: 'junior', label: 'Junior' },
    ],
    crm: [
      { value: 'manager', label: 'Manager' },
      { value: 'supervisor', label: 'Supervisor' },
      { value: 'senior', label: 'Senior' },
      { value: 'junior', label: 'Junior' },
    ],
    operation: [
      { value: 'manager', label: 'Manager' },
      { value: 'senior', label: 'Senior' },
      { value: 'junior', label: 'Junior' },
    ],
    finance: [
      { value: 'manager', label: 'Manager' },
      { value: 'senior', label: 'Senior' },
      { value: 'junior', label: 'Junior' },
    ],
    supply_chain: [
      { value: 'manager', label: 'Manager' },
      { value: 'supervisor', label: 'Supervisor' },
      { value: 'senior', label: 'Senior' },
      { value: 'junior', label: 'Junior' },
    ],
  };

  constructor(private usersApi: UsersServiceService) {}

  get isEditMode(): boolean {
    return !!this.userToEdit;
  }

  get availablePositions() {
    if (!this.model.role) return [];
    const key = this.model.role as UserRole;
    return this.positionsMap[key] ?? [];
  }

  formatRole(r: UserRole): string {
    const labels: Record<UserRole, string> = {
      admin: 'Admin',
      hr: 'HR',
      crm: 'CRM',
      operation: 'Operations',
      finance: 'Finance',
      supply_chain: 'Supply Chain',
    };
    return labels[r] ?? r;
  }

  get selectedEmployee(): EmployeeOption | null {
    const id = typeof this.model.employeeId === 'number' ? this.model.employeeId : null;
    if (!id) return null;
    return this.employees.find((e) => e.id === id) || null;
  }

  filteredEmployees(): EmployeeOption[] {
    const q = (this.employeeQuery || '').trim().toLowerCase();
    if (!q) return this.employees;

    return this.employees.filter((e) => {
      const name = (e.fullName || '').toLowerCase();
      const mail = (e.corporateEmail || '').toLowerCase();
      return name.includes(q) || mail.includes(q);
    });
  }

  isEmployeeDisabled(e: EmployeeOption): boolean {
    if (!e.authUserId) return false;
    const currentAuthId = this.userToEdit?.id || null;
    return e.authUserId !== currentAuthId;
  }

  toggleEmployeeDropdown(): void {
    if (this.saving) return;
    this.employeeDropdownOpen = !this.employeeDropdownOpen;
  }

  selectEmployee(e: EmployeeOption): void {
    if (this.saving) return;
    if (this.isEmployeeDisabled(e)) return;

    this.model.employeeId = e.id;
    this.employeeChanged = true;
    this.employeeDropdownOpen = false;

    const canAutofillName =
      !this.isEditMode ||
      !this.model.fullName?.trim() ||
      this.model.fullName === this.userToEdit?.fullName;

    const canAutofillEmail =
      !this.isEditMode ||
      !this.model.email?.trim() ||
      this.model.email === this.userToEdit?.email;

    if (canAutofillName) this.model.fullName = e.fullName;
    if (canAutofillEmail && e.corporateEmail) this.model.email = e.corporateEmail;
  }

  clearEmployeeSelection(): void {
    if (this.saving) return;
    this.model.employeeId = null;
    this.employeeChanged = true;
    this.employeeDropdownOpen = false;
  }

  private loadEmployees(): void {
    const includeLinked = this.isEditMode;

    this.employeesLoading = true;
    this.employeesError = '';

    this.sub?.unsubscribe();
    this.sub = this.usersApi.getAvailableEmployees({ includeLinked }).subscribe({
      next: (list) => {
        this.employees = list || [];
        this.employeesLoading = false;
      },
      error: (err) => {
        console.error('[UsersFormModal] loadEmployees error', err);
        this.employeesLoading = false;
        this.employeesError = err?.error?.message || 'Failed to load employees list.';
      },
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // ✅ Auto close when parent indicates a successful save
    if (changes['submitSuccessTick']) {
      const t = Number(this.submitSuccessTick || 0);
      if (t && t !== this.lastSuccessTick) {
        this.lastSuccessTick = t;
        // close only if not saving
        if (!this.saving) {
          this.close.emit();
        }
      }
    }

    if (changes['userToEdit']) {
      this.employeeChanged = false;
      this.employeeQuery = '';
      this.employeeDropdownOpen = false;

      if (this.userToEdit) {
        const preLinkedEmployeeId = this.userToEdit.employeeProfile?.id ?? null;

        this.model = {
          fullName: this.userToEdit.fullName,
          email: this.userToEdit.email,
          password: '',
          role: this.userToEdit.role,
          position: (this.userToEdit.position as UserPosition | null) || '',
          isActive: this.userToEdit.isActive,
          hireDate: this.userToEdit.hireDate || null,
          terminationDate: this.userToEdit.terminationDate || null,
          employeeId: preLinkedEmployeeId,
        };
      } else {
        this.model = {
          fullName: '',
          email: '',
          password: '',
          role: '',
          position: '',
          isActive: true,
          hireDate: new Date().toISOString().split('T')[0],
          terminationDate: null,
          employeeId: null,
        };
      }

      this.loadEmployees();
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.sub = undefined;
  }

  onSubmit(form: NgForm): void {
    if (this.saving) return;

    // force show errors
    if (!form.valid) {
      Object.keys(form.controls).forEach((key) => {
        form.controls[key].markAsTouched();
      });
      return;
    }

    if (!/\S+@\S+\.\S+/.test(this.model.email)) {
      // UI inline? we'll keep simple alert for now, but you can move it to apiError if you want
      alert('Please enter a valid email address');
      return;
    }

    if (!this.isEditMode && !this.model.password.trim()) {
      alert('Password is required for new users');
      return;
    }

    if (!this.model.role) {
      alert('Department is required');
      return;
    }

    const role = this.model.role as UserRole;
    const needPosition = role !== 'admin' && (this.positionsMap[role]?.length ?? 0) > 0;

    if (needPosition && !this.model.position) {
      alert('Position is required for this department');
      return;
    }

    if (!this.model.isActive && !this.model.terminationDate) {
      this.model.terminationDate = new Date().toISOString().split('T')[0];
    }
    if (this.model.isActive) {
      this.model.terminationDate = null;
    }

    const payload: UserFormValue = {
      ...this.model,
      isActive: this.model.isActive !== undefined ? this.model.isActive : true,
      employeeId: this.employeeChanged ? (this.model.employeeId ?? null) : undefined,
    };

    this.submit.emit(payload);
  }

  onStatusChange(): void {
    if (this.saving) return;

    if (!this.model.isActive && !this.model.terminationDate) {
      this.model.terminationDate = new Date().toISOString().split('T')[0];
    } else if (this.model.isActive) {
      this.model.terminationDate = null;
    }
  }

  requestClose(): void {
    if (this.saving) return;
    this.close.emit();
  }
}