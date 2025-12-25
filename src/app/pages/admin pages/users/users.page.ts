import {
  Component,
  OnInit,
  OnDestroy,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  StatusType,
  StatusMsgComponent,
} from '../../../components/status-msg/status-msg.component';
import {
  ApiUser,
  UserRole,
  UsersServiceService,
  UpdateUserDto,
  CreateUserDto,
} from '../../../services/users/users-service.service';
import { ExportButtonComponent } from '../../../shared/export-button/export-button';
import {
  UserFormValue,
  UsersFormModalComponent,
} from './components/users-form-modal/users-form-modal.component';

export type UserPosition = 'manager' | 'supervisor' | 'senior' | 'junior';

export interface UIUser extends ApiUser {
  position?: UserPosition | null;
}

interface StatusState {
  type: StatusType;
  message: string;
}

@Component({
  standalone: true,
  selector: 'app-users',
  templateUrl: './users.page.html',
  styleUrls: ['./users.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    ExportButtonComponent,
    UsersFormModalComponent,
    StatusMsgComponent,
  ],
})
export class UsersPage implements OnInit, OnDestroy {
  /** مؤقتًا نفترض إن اللي على الصفحة Admin – تقدر تربطها بالـ Auth بعدين */
  isAdmin = true;

  /** البيانات */
  users = signal<UIUser[]>([]);

  /** البحث */
  search = signal<string>('');

  /** حال المودال */
  isModalOpen = signal<boolean>(false);
  userToEdit = signal<UIUser | null>(null);

  /** الفلاتر */
  departmentFilter = signal<string>('');
  statusFilter = signal<string>('');
  positionFilter = signal<string>('');

  /** Pagination */
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);
  pageSizes = signal<number[]>([5, 10, 20, 50]);

  /** أدوار النظام (Departments) */
  readonly roles: UserRole[] = [
    'admin',
    'hr',
    'crm',
    'operation',
    'finance',
    'supply_chain',
  ];

  /** Labels لطيفة للعرض */
  private readonly roleLabels: Record<UserRole, string> = {
    admin: 'Admin',
    hr: 'HR',
    crm: 'CRM',
    operation: 'Operations',
    finance: 'Finance',
    supply_chain: 'Supply Chain',
  };

  /** حالة الرسالة العلوية */
  status: StatusState | null = null;

  /** تايمر لإخفاء الرسالة */
  private statusTimer: any = null;

  /** الناتج بعد التصفية */
  filtered = computed<UIUser[]>(() => {
    const term = this.search().toLowerCase().trim();
    const department = this.departmentFilter();
    const status = this.statusFilter();
    const position = this.positionFilter();

    return this.users().filter((u) => {
      // البحث
      const matchesSearch = !term || 
        u.fullName.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        u.role.toLowerCase().includes(term) ||
        (u.position || '').toLowerCase().includes(term);

      // الفلتر حسب القسم
      const matchesDepartment = !department || u.role === department;

      // الفلتر حسب الحالة
      const matchesStatus = !status || 
        (status === 'active' && u.isActive) ||
        (status === 'inactive' && !u.isActive);

      // الفلتر حسب المنصب
      const matchesPosition = !position || u.position === position;

      return matchesSearch && matchesDepartment && matchesStatus && matchesPosition;
    });
  });

  /** البيانات المعروضة في الصفحة الحالية */
  paginatedUsers = computed<UIUser[]>(() => {
    const startIndex = (this.currentPage() - 1) * this.pageSize();
    const endIndex = startIndex + this.pageSize();
    return this.filtered().slice(startIndex, endIndex);
  });

  /** إحصائيات Pagination */
  paginationStats = computed(() => {
    const totalUsers = this.filtered().length;
    const totalPages = Math.ceil(totalUsers / this.pageSize());
    const currentPage = this.currentPage();
    const startItem = ((currentPage - 1) * this.pageSize()) + 1;
    const endItem = Math.min(currentPage * this.pageSize(), totalUsers);

    return {
      totalUsers,
      totalPages,
      currentPage,
      startItem,
      endItem,
      hasPrevious: currentPage > 1,
      hasNext: currentPage < totalPages
    };
  });

  /** أرقام الصفحات المعروضة */
  visiblePages = computed<(number | string)[]>(() => {
    const stats = this.paginationStats();
    const totalPages = stats.totalPages;
    const currentPage = stats.currentPage;
    
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }

    if (currentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  });

  /** الصفحات الرقمية فقط (بدون الـ ellipsis) */
  numberPages = computed<number[]>(() => {
    return this.visiblePages().filter(page => typeof page === 'number') as number[];
  });

  constructor(private usersService: UsersServiceService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  ngOnDestroy(): void {
    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }
  }

  formatRole(role: UserRole): string {
    return this.roleLabels[role] ?? role;
  }

  // ===== دوال التواريخ =====

  formatDate(dateString: string | null | undefined): string {
    if (!dateString) return '—';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  calculateDuration(hireDate: string): string {
    const start = new Date(hireDate);
    const today = new Date();
    
    const years = today.getFullYear() - start.getFullYear();
    const months = today.getMonth() - start.getMonth();
    
    let totalMonths = years * 12 + months;
    
    if (today.getDate() < start.getDate()) {
      totalMonths--;
    }
    
    if (totalMonths < 12) {
      return `${totalMonths} ${totalMonths === 1 ? 'month' : 'months'}`;
    } else {
      const years = Math.floor(totalMonths / 12);
      const remainingMonths = totalMonths % 12;
      
      if (remainingMonths === 0) {
        return `${years} ${years === 1 ? 'year' : 'years'}`;
      } else {
        return `${years}.${remainingMonths}y`;
      }
    }
  }

  // ===== Pagination Methods =====

  goToPage(page: number): void {
    if (page >= 1 && page <= this.paginationStats().totalPages) {
      this.currentPage.set(page);
    }
  }

  nextPage(): void {
    if (this.paginationStats().hasNext) {
      this.currentPage.update(page => page + 1);
    }
  }

  previousPage(): void {
    if (this.paginationStats().hasPrevious) {
      this.currentPage.update(page => page - 1);
    }
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1); // العودة للصفحة الأولى عند تغيير الحجم
  }

  // ===== Helpers للرسائل =====

  private setStatus(type: StatusType, message: string): void {
    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }

    this.status = { type, message };

    this.statusTimer = setTimeout(() => {
      this.status = null;
      this.statusTimer = null;
    }, 3000);
  }

  private setSuccess(message: string): void {
    this.setStatus('success', message);
  }

  private setError(message: string): void {
    this.setStatus('error', message);
  }

  clearStatus(): void {
    this.status = null;
    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }
  }

  // ===== تحميل من الـ backend =====

  loadUsers(): void {
    this.usersService.getUsers().subscribe({
      next: (list) => {
        this.users.set(list as UIUser[]);
      },
      error: (err) => {
        console.error('Failed to load users', err);
        const msg = err?.error?.message || 'Failed to load users from server.';
        this.setError(msg);
      },
    });
  }

  // ===== تطبيق الفلاتر =====

  applyFilters(): void {
    this.currentPage.set(1); // العودة للصفحة الأولى عند التصفية
  }

  clearFilters(): void {
    this.departmentFilter.set('');
    this.statusFilter.set('');
    this.positionFilter.set('');
    this.search.set('');
    this.currentPage.set(1);
  }

  // ===== أزرار الإجراء =====

  openAddModal(): void {
    this.userToEdit.set(null);
    this.isModalOpen.set(true);
    this.clearStatus();
  }

  openEditModal(user: UIUser): void {
    this.userToEdit.set(user);
    this.isModalOpen.set(true);
    this.clearStatus();
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.userToEdit.set(null);
  }

  submitForm(value: UserFormValue): void {
    const trim = (s: string | undefined | null) => (s || '').trim();

    if (this.userToEdit()) {
      // ===== تعديل =====
      const current = this.userToEdit()!;
      const body: UpdateUserDto = {
        fullName: value.fullName ? trim(value.fullName) : current.fullName,
        email: value.email ? trim(value.email) : current.email,
        role: (value.role as UserRole) || current.role,
        isActive: value.isActive !== undefined ? value.isActive : current.isActive,
        position: value.position ? (value.position as UserPosition) : (current.position || null),
        hireDate: value.hireDate || current.hireDate,
        terminationDate: value.terminationDate || current.terminationDate
      };

      // إذا كان هناك باسورد جديد
      if (value.password && trim(value.password)) {
        body.password = trim(value.password);
      }

      this.usersService.updateUser(current.id, body).subscribe({
        next: (updated) => {
          this.users.update((list) =>
            list.map((u) => 
              u.id === updated.id ? 
              { ...u, ...updated, position: updated.position || null } as UIUser : u
            )
          );
          this.closeModal();
          this.setSuccess('User updated successfully.');
        },
        error: (err) => {
          console.error('Failed to update user', err);
          const msg = err?.error?.message || 'Failed to update user. Please try again.';
          this.setError(msg);
        },
      });
    } else {
      // ===== إضافة =====
      const body: CreateUserDto = {
        fullName: trim(value.fullName),
        email: trim(value.email),
        password: trim(value.password),
        role: (value.role as UserRole) || 'operation',
        isActive: value.isActive !== undefined ? value.isActive : true,
        position: value.position ? (value.position as UserPosition) : null,
        hireDate: value.hireDate || new Date().toISOString().split('T')[0]
      };

      this.usersService.createUser(body).subscribe({
        next: (created) => {
          this.users.update((list) => [...list, { ...created } as UIUser]);
          this.closeModal();
          this.setSuccess('User created successfully.');
        },
        error: (err) => {
          console.error('Failed to create user', err);
          const msg = err?.error?.message || 'Failed to create user. Please try again.';
          this.setError(msg);
        },
      });
    }
  }

  deleteUser(id: number): void {
    if (!confirm('Are you sure you want to delete this account?')) return;

    this.usersService.deleteUser(id).subscribe({
      next: () => {
        this.users.update((list) => list.filter((u) => u.id !== id));
        this.setSuccess('User deleted successfully.');
      },
      error: (err) => {
        console.error('Failed to delete user', err);
        const msg =
          err?.error?.message || 'Failed to delete user. Please try again.';
        this.setError(msg);
      },
    });
  }

  /** لتحسين *ngFor */
  trackById(_index: number, item: UIUser): number {
    return item.id;
  }
}