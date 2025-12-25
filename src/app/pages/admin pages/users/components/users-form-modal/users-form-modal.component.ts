import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { UserRole } from '../../../../../services/users/users-service.service';

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
}

@Component({
  selector: 'app-users-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users-form-modal.component.html',
  styleUrls: ['./users-form-modal.component.scss'],
})
export class UsersFormModalComponent implements OnChanges {
  @Input() userToEdit: UserToEdit | null = null;
  @Input() roles: UserRole[] = [];

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
  };

  /** Positions per department */
  readonly positionsMap: Record<
    UserRole,
    { value: UserPosition; label: string }[]
  > = {
    admin: [], // admin ملوش levels
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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['userToEdit']) {
      if (this.userToEdit) {
        // Edit mode - تعبئة البيانات الحالية
        this.model = {
          fullName: this.userToEdit.fullName,
          email: this.userToEdit.email,
          password: '',
          role: this.userToEdit.role,
          position: (this.userToEdit.position as UserPosition | null) || '',
          isActive: this.userToEdit.isActive,
          hireDate: this.userToEdit.hireDate || null,
          terminationDate: this.userToEdit.terminationDate || null,
        };
      } else {
        // Add mode - إعادة التعيين للقيم الافتراضية
        this.model = {
          fullName: '',
          email: '',
          password: '',
          role: '',
          position: '',
          isActive: true,
          hireDate: new Date().toISOString().split('T')[0], // تاريخ اليوم كافتراضي
          terminationDate: null,
        };
      }
    }
  }

  onSubmit(form: NgForm): void {
    if (!form.valid) {
      // عرض أخطاء التحقق
      Object.keys(form.controls).forEach(key => {
        form.controls[key].markAsTouched();
      });
      return;
    }

    // تحقق من الإيميل
    if (!/\S+@\S+\.\S+/.test(this.model.email)) {
      alert('Please enter a valid email address');
      return;
    }

    // في حالة الإضافة لازم باسورد
    if (!this.isEditMode && !this.model.password.trim()) {
      alert('Password is required for new users');
      return;
    }

    // لازم role
    if (!this.model.role) {
      alert('Department is required');
      return;
    }

    const role = this.model.role as UserRole;
    const needPosition = 
      role !== 'admin' && 
      (this.positionsMap[role]?.length ?? 0) > 0;

    if (needPosition && !this.model.position) {
      alert('Position is required for this department');
      return;
    }

    // تحقق من تاريخ الإنهاء إذا كان الحساب inactive
    if (!this.model.isActive && !this.model.terminationDate) {
      this.model.terminationDate = new Date().toISOString().split('T')[0];
    }

    // إذا كان الحساب active، تأكد من مسح تاريخ الإنهاء
    if (this.model.isActive) {
      this.model.terminationDate = null;
    }

    // إرسال البيانات
    this.submit.emit({ 
      ...this.model,
      isActive: this.model.isActive !== undefined ? this.model.isActive : true
    });
  }

  // دالة لتحديث التواريخ بناءً على حالة الحساب
  onStatusChange(): void {
    if (!this.model.isActive && !this.model.terminationDate) {
      // إذا تم تعطيل الحساب ولم يكن هناك تاريخ إنهاء، استخدم تاريخ اليوم
      this.model.terminationDate = new Date().toISOString().split('T')[0];
    } else if (this.model.isActive) {
      // إذا تم تفعيل الحساب، امسح تاريخ الإنهاء
      this.model.terminationDate = null;
    }
  }
}