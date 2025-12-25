// src/app/pages/operation pages/smv-tasks/smv-tasks.component.ts
import {
  Component,
  OnInit,
  inject,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import {
  TasksServiceService,
  Task,
  TaskStatus,
  TaskPriority,
} from '../../../services/tasks/tasks-service.service';
import { AuthService } from '../../../services/auth/auth-service.service';
import { ApiUser } from '../../../services/users/users-service.service';

type TimingState = 'no_deadline' | 'active' | 'overdue' | 'completed_on_time' | 'completed_late';

type TaskFormMode = 'create' | 'edit';

interface TaskFormState {
  id?: number;
  title: string;
  description: string;
  assigneeId: number | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;     // yyyy-MM-dd
  dueTime: string | null;     // HH:mm
}

@Component({
  selector: 'app-smv-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './smv-tasks.component.html',
  styleUrl: './smv-tasks.component.scss',
})
export class SmvTasksComponent implements OnInit {
  private auth = inject(AuthService);
  private tasksApi = inject(TasksServiceService);
  private router = inject(Router);

  currentUser = computed(() => this.auth.currentUser());

  loading = false;
  errorMsg = '';

  Math = Math;
  operationStaff: ApiUser[] = [];
  selectedAssignee: ApiUser | null = null;
  assigneeTasks: Task[] = [];

  // Filters
  statusFilter: TaskStatus | 'all' = 'all';
  fromDateFilter: string | null = null;
  toDateFilter: string | null = null;
  searchQuery = '';

  // Modal
  isModalOpen = false;
  modalMode: TaskFormMode = 'create';
  formState: TaskFormState = this.createEmptyForm();
  formSaving = false;

  // Pagination (per assignee)
  pageSizeOptions = [10, 25, 50];
  pageSize = 25;
  currentPage = 1;

  readonly statusOptions: { value: TaskStatus; label: string }[] = [
    { value: 'todo', label: 'To do' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'completed', label: 'Completed' },
  ];

  readonly priorityOptions: { value: TaskPriority; label: string }[] = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
  ];

  isManagerOrSupervisor = computed(() => {
    const user = this.currentUser();
    return (
      !!user &&
      user.role === 'operation' &&
      (user.position === 'manager' || user.position === 'supervisor')
    );
  });

  get totalPages(): number {
    if (!this.assigneeTasks.length) return 1;
    return Math.max(1, Math.ceil(this.assigneeTasks.length / this.pageSize));
  }

  get pagedTasks(): Task[] {
    if (!this.assigneeTasks.length) return [];
    const start = (this.currentPage - 1) * this.pageSize;
    return this.assigneeTasks.slice(start, start + this.pageSize);
  }

  get stats() {
    const rows = this.assigneeTasks;
    const total = rows.length;
    const todo = rows.filter((t) => t.status === 'todo').length;
    const inProgress = rows.filter((t) => t.status === 'in_progress').length;
    const completed = rows.filter((t) => t.status === 'completed').length;
    const overdue = rows.filter((t) => this.getTimingState(t) === 'overdue').length;
    const completedLate = rows.filter(
      (t) => this.getTimingState(t) === 'completed_late'
    ).length;

    return { total, todo, inProgress, completed, overdue, completedLate };
  }

ngOnInit(): void {
  const user = this.currentUser();
  if (!user) return;

  // لو مش Manager/Supervisor → يروح على My Tasks
  if (!this.isManagerOrSupervisor()) {
    this.router.navigateByUrl('/operations/my-tasks');
    return;
  }

  this.loadOperationStaff();
}

  // ===== Date helpers / timing =====

  private parseDate(value?: string | null): Date | null {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  getTimingState(task: Task): TimingState {
    const due = this.parseDate(task.due_at);
    const completedAt = this.parseDate(task.completed_at);

    if (!due) {
      if (task.status === 'completed') return 'completed_on_time';
      return 'no_deadline';
    }

    const now = new Date();

    if (task.status === 'completed') {
      if (completedAt && completedAt.getTime() > due.getTime()) {
        return 'completed_late';
      }
      return 'completed_on_time';
    }

    if (now.getTime() > due.getTime()) {
      return 'overdue';
    }

    return 'active';
  }

  getTimingLabel(task: Task): string {
    const state = this.getTimingState(task);
    switch (state) {
      case 'no_deadline':
        return 'No deadline';
      case 'active':
        return 'Before deadline';
      case 'overdue':
        return 'Overdue';
      case 'completed_on_time':
        return 'Completed on time';
      case 'completed_late':
        return 'Completed late';
      default:
        return '';
    }
  }

  getTimingClass(task: Task): string {
    const state = this.getTimingState(task);
    return `timing-pill timing-${state}`;
  }

  // ===== Staff / Tasks loading =====

  private loadOperationStaff(): void {
    this.loading = true;
    this.errorMsg = '';

    this.tasksApi.getOperationStaff(true).subscribe({
      next: (users) => {
        // نعرض Senior / Junior بس
        this.operationStaff = users.filter(
          (u) => u.position === 'senior' || u.position === 'junior'
        );
        this.loading = false;
      },
      error: (err) => {
        console.error('[SmvTasks] loadOperationStaff error', err);
        this.errorMsg = 'Failed to load operation staff';
        this.loading = false;
      },
    });
  }

  onSelectAssignee(user: ApiUser): void {
    this.selectedAssignee = user;
    this.currentPage = 1;
    this.loadTasksForAssignee(user.id);
  }

  private buildQueryParams() {
    const query: any = {};

    if (this.statusFilter && this.statusFilter !== 'all') {
      query.status = this.statusFilter;
    }
    if (this.fromDateFilter) {
      query.fromDate = this.fromDateFilter;
    }
    if (this.toDateFilter) {
      query.toDate = this.toDateFilter;
    }
    if (this.searchQuery) {
      query.q = this.searchQuery.trim();
    }

    return query;
  }

  private loadTasksForAssignee(assigneeId: number): void {
    this.loading = true;
    this.errorMsg = '';

    const query = this.buildQueryParams();

    this.tasksApi.getTasksByAssignee(assigneeId, query).subscribe({
      next: (rows) => {
        this.assigneeTasks = rows;
        this.currentPage = 1;
        this.loading = false;
      },
      error: (err) => {
        console.error('[SmvTasks] loadTasksForAssignee error', err);
        this.errorMsg = 'Failed to load tasks for assignee';
        this.loading = false;
      },
    });
  }

  onFiltersChange(): void {
    if (this.selectedAssignee) {
      this.loadTasksForAssignee(this.selectedAssignee.id);
    }
  }

  // ===== Pagination =====

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  onPageSizeChange(size: number): void {
    this.pageSize = Number(size) || 25;
    this.currentPage = 1;
  }

  // ===== Modal / Form =====

  private createEmptyForm(): TaskFormState {
    return {
      id: undefined,
      title: '',
      description: '',
      assigneeId: null,
      status: 'todo',
      priority: 'medium',
      dueDate: null,
      dueTime: null,
    };
  }

  openCreateModal(): void {
    this.modalMode = 'create';
    this.formState = this.createEmptyForm();
    if (this.selectedAssignee) {
      this.formState.assigneeId = this.selectedAssignee.id;
    }
    this.isModalOpen = true;
  }

  openEditModal(task: Task): void {
    this.modalMode = 'edit';
    const due = this.parseDate(task.due_at);

    let dueDate: string | null = null;
    let dueTime: string | null = null;
    if (due) {
      // yyyy-MM-dd
      dueDate = due.toISOString().slice(0, 10);
      // HH:mm
      dueTime = due.toISOString().slice(11, 16);
    }

    this.formState = {
      id: task.id,
      title: task.title || '',
      description: task.description || '',
      assigneeId: task.assignee_id,
      status: task.status,
      priority: task.priority || 'medium',
      dueDate,
      dueTime,
    };
    this.isModalOpen = true;
  }

  closeModal(): void {
    if (this.formSaving) return;
    this.isModalOpen = false;
  }

  private buildDueAtFromForm(): string | null {
    const { dueDate, dueTime } = this.formState;
    if (!dueDate && !dueTime) return null;

    const datePart = dueDate || new Date().toISOString().slice(0, 10);
    const timePart = dueTime || '09:00';

    return `${datePart}T${timePart}:00`;
  }

  submitForm(): void {
    if (this.formSaving) return;

    const payloadDueAt = this.buildDueAtFromForm();

    if (!this.formState.title.trim()) {
      alert('Title is required.');
      return;
    }

    if (!this.formState.assigneeId) {
      alert('Assignee is required.');
      return;
    }

    this.formSaving = true;

    if (this.modalMode === 'create') {
      this.tasksApi
        .createTask({
          title: this.formState.title.trim(),
          description: this.formState.description.trim() || null,
          assigneeId: this.formState.assigneeId,
          status: this.formState.status,
          priority: this.formState.priority,
          dueAt: payloadDueAt,
        })
        .subscribe({
          next: (created) => {
            if (
              this.selectedAssignee &&
              this.selectedAssignee.id === created.assignee_id
            ) {
              this.assigneeTasks = [created, ...this.assigneeTasks];
            }
            this.formSaving = false;
            this.isModalOpen = false;
          },
          error: (err) => {
            console.error('[SmvTasks] createTask error', err);
            this.formSaving = false;
          },
        });
    } else {
      const id = this.formState.id!;
      this.tasksApi
        .updateTask(id, {
          title: this.formState.title.trim(),
          description: this.formState.description.trim(),
          assigneeId: this.formState.assigneeId || undefined,
          status: this.formState.status,
          priority: this.formState.priority,
          dueAt: payloadDueAt,
        })
        .subscribe({
          next: (updated) => {
            const idx = this.assigneeTasks.findIndex((t) => t.id === updated.id);
            if (idx !== -1) {
              this.assigneeTasks[idx] = updated;
            }
            this.formSaving = false;
            this.isModalOpen = false;
          },
          error: (err) => {
            console.error('[SmvTasks] updateTask error', err);
            this.formSaving = false;
          },
        });
    }
  }

  deleteTask(task: Task): void {
    if (!confirm('Delete this task?')) return;

    this.tasksApi.deleteTask(task.id).subscribe({
      next: () => {
        this.assigneeTasks = this.assigneeTasks.filter((t) => t.id !== task.id);
      },
      error: (err) => {
        console.error('[SmvTasks] deleteTask error', err);
      },
    });
  }
}
