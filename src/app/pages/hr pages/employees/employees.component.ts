import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { StatusMsgComponent, StatusType } from '../../../components/status-msg/status-msg.component';
import { ExportButtonComponent } from '../../../shared/export-button/export-button';
import { Employee, EmployeesService } from '../../../services/employs/employs-service.service';
import { EmployeeFormModalComponent, EmployeeFormValue } from './components/employee-form-modal/employee-form-modal.component';


interface StatusState {
  type: StatusType;
  message: string;
}

@Component({
  standalone: true,
  selector: 'app-employees',
  templateUrl: './employees.component.html',
  styleUrl: './employees.component.scss',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    StatusMsgComponent,
    ExportButtonComponent,
    EmployeeFormModalComponent,
  ],
})
export class EmployeesComponent implements OnInit, OnDestroy {
  // ===== Data =====
  rows = signal<Employee[]>([]);
  total = signal<number>(0);

  // ===== Filters =====
  q = signal<string>('');
  department = signal<string>('');
  isWorking = signal<string>(''); // '', 'true', 'false'
  hasAccount = signal<string>(''); // '', 'true', 'false'
  includeAccount = signal<boolean>(true);

  // ===== Pagination =====
  pageSize = signal<number>(10);
  pageSizes = signal<number[]>([5, 10, 20, 50]);
  currentPage = signal<number>(1);

  // ===== UI =====
  isModalOpen = signal<boolean>(false);
  employeeToEdit = signal<Employee | null>(null);

  status: StatusState | null = null;
  private statusTimer: any = null;

  loading = signal<boolean>(false);

  // Departments list (free text in sheet, but you can hardcode or load distinct)
  departmentOptions = ['HR', 'Operation', 'Supply chain', 'Accounting', 'CRM', 'Finance'];

  paginationStats = computed(() => {
    const total = this.total();
    const pageSize = this.pageSize();
    const totalPages = Math.max(Math.ceil(total / pageSize), 1);
    const currentPage = Math.min(this.currentPage(), totalPages);
    const startItem = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, total);

    return {
      total,
      totalPages,
      currentPage,
      startItem,
      endItem,
      hasPrevious: currentPage > 1,
      hasNext: currentPage < totalPages,
    };
  });

  constructor(private employeesService: EmployeesService) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    if (this.statusTimer) clearTimeout(this.statusTimer);
  }

  // ===== Status helpers =====
  private setStatus(type: StatusType, message: string): void {
    if (this.statusTimer) clearTimeout(this.statusTimer);
    this.status = { type, message };
    this.statusTimer = setTimeout(() => {
      this.status = null;
      this.statusTimer = null;
    }, 3000);
  }
  clearStatus(): void {
    this.status = null;
    if (this.statusTimer) clearTimeout(this.statusTimer);
    this.statusTimer = null;
  }

  // ===== Load =====
  load(): void {
    this.loading.set(true);

    const limit = this.pageSize();
    const offset = (this.currentPage() - 1) * limit;

    this.employeesService.getEmployees({
      q: this.q().trim() || undefined,
      department: this.department().trim() || undefined,
      isWorking: this.isWorking() ? this.isWorking() === 'true' : undefined,
      hasAccount: this.hasAccount() ? this.hasAccount() === 'true' : undefined,
      includeAccount: this.includeAccount(),
      limit,
      offset,
    }).subscribe({
      next: (res) => {
        this.rows.set(res.data || []);
        this.total.set(res.total || 0);
        this.loading.set(false);

        // clamp current page if needed
        const totalPages = Math.max(Math.ceil((res.total || 0) / limit), 1);
        if (this.currentPage() > totalPages) this.currentPage.set(totalPages);
      },
      error: (err) => {
        console.error('Failed to load employees', err);
        this.loading.set(false);
        this.setStatus('error', err?.error?.message || 'Failed to load employees.');
      },
    });
  }

  // ===== Filters =====
  applyFilters(): void {
    this.currentPage.set(1);
    this.load();
  }

  clearFilters(): void {
    this.q.set('');
    this.department.set('');
    this.isWorking.set('');
    this.hasAccount.set('');
    this.currentPage.set(1);
    this.load();
  }

  // ===== Pagination =====
  goToPage(page: number): void {
    const totalPages = this.paginationStats().totalPages;
    if (page >= 1 && page <= totalPages) {
      this.currentPage.set(page);
      this.load();
    }
  }

  nextPage(): void {
    if (!this.paginationStats().hasNext) return;
    this.currentPage.update((p) => p + 1);
    this.load();
  }

  previousPage(): void {
    if (!this.paginationStats().hasPrevious) return;
    this.currentPage.update((p) => p - 1);
    this.load();
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(Number(size));
    this.currentPage.set(1);
    this.load();
  }

  // ===== Modal =====
  openAddModal(): void {
    this.employeeToEdit.set(null);
    this.isModalOpen.set(true);
    this.clearStatus();
  }

  openEditModal(emp: Employee): void {
    this.employeeToEdit.set(emp);
    this.isModalOpen.set(true);
    this.clearStatus();
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.employeeToEdit.set(null);
  }

  submitForm(value: EmployeeFormValue): void {
    const body = value; // already matches Create/Update dto structure

    if (this.employeeToEdit()) {
      const id = this.employeeToEdit()!.id;
      this.employeesService.updateEmployee(id, body).subscribe({
        next: () => {
          this.closeModal();
          this.setStatus('success', 'Employee updated successfully.');
          this.load();
        },
        error: (err) => {
          console.error('Update employee failed', err);
          this.setStatus('error', err?.error?.message || 'Failed to update employee.');
        },
      });
    } else {
      this.employeesService.createEmployee(body).subscribe({
        next: () => {
          this.closeModal();
          this.setStatus('success', 'Employee created successfully.');
          this.load();
        },
        error: (err) => {
          console.error('Create employee failed', err);
          this.setStatus('error', err?.error?.message || 'Failed to create employee.');
        },
      });
    }
  }

  // ===== UI helpers =====
  formatDate(dateString?: string | null): string {
    if (!dateString) return '—';
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  trackById(_i: number, e: Employee): number {
    return e.id;
  }
}
