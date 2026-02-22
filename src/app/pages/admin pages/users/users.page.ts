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
import { finalize } from 'rxjs/operators';

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
  isAdmin = true;

  users = signal<UIUser[]>([]);
  search = signal<string>('');

  isModalOpen = signal<boolean>(false);
  userToEdit = signal<UIUser | null>(null);

  modalApiError = signal<string | null>(null);
  submitSuccessTick = signal<number>(0);

  departmentFilter = signal<string>('');
  statusFilter = signal<string>('');
  positionFilter = signal<string>('');

  currentPage = signal<number>(1);
  pageSize = signal<number>(10);
  pageSizes = signal<number[]>([5, 10, 20, 50]);

  saving = signal<boolean>(false);

  readonly roles: UserRole[] = [
    'admin',
    'hr',
    'crm',
    'operation',
    'finance',
    'supply_chain',
  ];

  private readonly roleLabels: Record<UserRole, string> = {
    admin: 'Admin',
    hr: 'HR',
    crm: 'CRM',
    operation: 'Operations',
    finance: 'Finance',
    supply_chain: 'Supply Chain',
  };

  status: StatusState | null = null;
  private statusTimer: any = null;

  filtered = computed<UIUser[]>(() => {
    const term = this.search().toLowerCase().trim();
    const department = this.departmentFilter();
    const status = this.statusFilter();
    const position = this.positionFilter();

    return this.users().filter((u) => {
      const matchesSearch =
        !term ||
        u.fullName.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        u.role.toLowerCase().includes(term) ||
        (u.position || '').toLowerCase().includes(term);

      const matchesDepartment = !department || u.role === department;

      const matchesStatus =
        !status ||
        (status === 'active' && u.isActive) ||
        (status === 'inactive' && !u.isActive);

      const matchesPosition = !position || u.position === position;

      return matchesSearch && matchesDepartment && matchesStatus && matchesPosition;
    });
  });

  paginatedUsers = computed<UIUser[]>(() => {
    const startIndex = (this.currentPage() - 1) * this.pageSize();
    const endIndex = startIndex + this.pageSize();
    return this.filtered().slice(startIndex, endIndex);
  });

  paginationStats = computed(() => {
    const totalUsers = this.filtered().length;
    const totalPages = Math.ceil(totalUsers / this.pageSize()) || 1;
    const currentPage = this.currentPage();
    const startItem = totalUsers === 0 ? 0 : (currentPage - 1) * this.pageSize() + 1;
    const endItem = Math.min(currentPage * this.pageSize(), totalUsers);

    return {
      totalUsers,
      totalPages,
      currentPage,
      startItem,
      endItem,
      hasPrevious: currentPage > 1,
      hasNext: currentPage < totalPages,
    };
  });

  visiblePages = computed<(number | string)[]>(() => {
    const stats = this.paginationStats();
    const totalPages = stats.totalPages;
    const currentPage = stats.currentPage;

    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (currentPage <= 4) return [1, 2, 3, 4, 5, '...', totalPages];
    if (currentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  });

  numberPages = computed<number[]>(() => {
    return this.visiblePages().filter((page) => typeof page === 'number') as number[];
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

  formatDate(dateString: string | null | undefined): string {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  calculateDuration(hireDate: string): string {
    const start = new Date(hireDate);
    const today = new Date();

    const years = today.getFullYear() - start.getFullYear();
    const months = today.getMonth() - start.getMonth();
    let totalMonths = years * 12 + months;

    if (today.getDate() < start.getDate()) totalMonths--;

    if (totalMonths < 12) return `${totalMonths} ${totalMonths === 1 ? 'month' : 'months'}`;
    const y = Math.floor(totalMonths / 12);
    const m = totalMonths % 12;
    return m === 0 ? `${y} ${y === 1 ? 'year' : 'years'}` : `${y}.${m}y`;
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.paginationStats().totalPages) {
      this.currentPage.set(page);
    }
  }
  nextPage(): void { if (this.paginationStats().hasNext) this.currentPage.update((p) => p + 1); }
  previousPage(): void { if (this.paginationStats().hasPrevious) this.currentPage.update((p) => p - 1); }

  onPageSizeChange(size: number): void {
    this.pageSize.set(Number(size));
    this.currentPage.set(1);
  }

  private setStatus(type: StatusType, message: string): void {
    if (this.statusTimer) { clearTimeout(this.statusTimer); this.statusTimer = null; }
    this.status = { type, message };
    this.statusTimer = setTimeout(() => { this.status = null; this.statusTimer = null; }, 3000);
  }

  private setSuccess(message: string): void { this.setStatus('success', message); }
  private setError(message: string): void { this.setStatus('error', message); }

  clearStatus(): void {
    this.status = null;
    if (this.statusTimer) { clearTimeout(this.statusTimer); this.statusTimer = null; }
  }

  loadUsers(): void {
    this.usersService.getUsers({ includeEmployee: true }).subscribe({
      next: (list) => this.users.set(list as UIUser[]),
      error: (err) => {
        console.error('Failed to load users', err);
        this.setError(err?.error?.message || 'Failed to load users from server.');
      },
    });
  }

  private refreshUserFromServer(id: number): void {
    this.usersService.getUser(id, { includeEmployee: true }).subscribe({
      next: (fresh) => {
        this.users.update((list) => list.map((u) => (u.id === id ? ({ ...u, ...fresh } as UIUser) : u)));
      },
      error: () => this.loadUsers(),
    });
  }

  applyFilters(): void { this.currentPage.set(1); }

  clearFilters(): void {
    this.departmentFilter.set('');
    this.statusFilter.set('');
    this.positionFilter.set('');
    this.search.set('');
    this.currentPage.set(1);
  }

  openAddModal(): void {
    if (this.saving()) return;
    this.modalApiError.set(null);
    this.userToEdit.set(null);
    this.isModalOpen.set(true);
  }

  openEditModal(user: UIUser): void {
    if (this.saving()) return;
    this.modalApiError.set(null);
    this.userToEdit.set(user);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    if (this.saving()) return;
    this.isModalOpen.set(false);
    this.userToEdit.set(null);
    this.modalApiError.set(null);
  }

  submitForm(value: UserFormValue): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.modalApiError.set(null);

    const trim = (s: string | undefined | null) => (s || '').trim();

    if (this.userToEdit()) {
      const current = this.userToEdit()!;

      const body: UpdateUserDto = {
        fullName: trim(value.fullName) || current.fullName,
        email: trim(value.email) || current.email,
        role: (value.role as UserRole) || current.role,
        isActive: value.isActive !== undefined ? value.isActive : current.isActive,
        position: value.position ? (value.position as any) : current.position || null,
        hireDate: value.hireDate || current.hireDate,
        terminationDate: value.terminationDate || current.terminationDate,
      };

      if (typeof value.employeeId !== 'undefined') body.employeeId = value.employeeId;
      if (value.password && trim(value.password)) body.password = trim(value.password);

      this.usersService.updateUser(current.id, body)
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: (updated) => {
            this.users.update((list) =>
              list.map((u) => (u.id === updated.id ? ({ ...u, ...updated } as UIUser) : u))
            );

            this.modalApiError.set(null);
            this.submitSuccessTick.update((x) => x + 1);
            this.closeModal();

            this.setSuccess('User updated successfully.');
            this.refreshUserFromServer(updated.id);
          },
          error: (err) => {
            console.error('Failed to update user', err);
            this.modalApiError.set(err?.error?.message || 'Failed to update user. Please try again.');
          },
        });

      return;
    }

    const body: CreateUserDto = {
      fullName: trim(value.fullName),
      email: trim(value.email),
      password: trim(value.password),
      role: (value.role as UserRole) || 'operation',
      isActive: value.isActive !== undefined ? value.isActive : true,
      position: value.position ? (value.position as any) : null,
      hireDate: value.hireDate || new Date().toISOString().split('T')[0],
    };

    if (typeof value.employeeId !== 'undefined') body.employeeId = value.employeeId;

    this.usersService.createUser(body)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (created) => {
          this.users.update((list) => [...list, created as UIUser]);

          this.modalApiError.set(null);
          this.submitSuccessTick.update((x) => x + 1);
          this.closeModal();

          this.setSuccess('User created successfully.');
          this.refreshUserFromServer(created.id);
        },
        error: (err) => {
          console.error('Failed to create user', err);
          this.modalApiError.set(err?.error?.message || 'Failed to create user. Please try again.');
        },
      });
  }

  deleteUser(id: number): void {
    if (this.saving()) return;
    if (!confirm('Are you sure you want to delete this account?')) return;

    this.saving.set(true);

    this.usersService.deleteUser(id)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.users.update((list) => list.filter((u) => u.id !== id));
          this.setSuccess('User deleted successfully.');
        },
        error: (err) => {
          console.error('Failed to delete user', err);
          this.setError(err?.error?.message || 'Failed to delete user. Please try again.');
        },
      });
  }

  trackById(_index: number, item: UIUser): number {
    return item.id;
  }
}