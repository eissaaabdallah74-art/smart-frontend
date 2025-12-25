// src/app/pages/operation pages/my-tasks/my-tasks.component.ts
import {
  Component,
  OnInit,
  inject,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  TasksServiceService,
  Task,
  TaskStatus,
} from '../../../services/tasks/tasks-service.service';
import { AuthService } from '../../../services/auth/auth-service.service';
import { Router } from '@angular/router';

type RowState = {
  status: TaskStatus;
  dirty: boolean;
  saving: boolean;
};

type TimingState = 'no_deadline' | 'active' | 'overdue' | 'completed_on_time' | 'completed_late';

@Component({
  selector: 'app-my-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './my-tasks.component.html',
  styleUrl: './my-tasks.component.scss',
})
export class MyTasksComponent implements OnInit {
  private auth = inject(AuthService);
  private tasksApi = inject(TasksServiceService);
  private router = inject(Router);

  currentUser = computed(() => this.auth.currentUser());

  loading = false;
  errorMsg = '';

  tasks: Task[] = [];
  Math = Math;

  selectedStatusFilter: TaskStatus | 'all' = 'all';

  pageSizeOptions = [10, 25, 50];
  pageSize = 25;
  currentPage = 1;

  rowState: { [id: number]: RowState } = {};

  readonly statusOptions: { value: TaskStatus; label: string }[] = [
    { value: 'todo', label: 'To do' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'completed', label: 'Completed' },
  ];

  get totalPages(): number {
    if (!this.tasks.length) return 1;
    return Math.max(1, Math.ceil(this.tasks.length / this.pageSize));
  }

  get pagedTasks(): Task[] {
    if (!this.tasks.length) return [];
    const start = (this.currentPage - 1) * this.pageSize;
    return this.tasks.slice(start, start + this.pageSize);
  }

  get stats() {
    const total = this.tasks.length;
    const todo = this.tasks.filter((t) => t.status === 'todo').length;
    const inProgress = this.tasks.filter((t) => t.status === 'in_progress').length;
    const completed = this.tasks.filter((t) => t.status === 'completed').length;
    const overdue = this.tasks.filter((t) => this.getTimingState(t) === 'overdue').length;
    const completedLate = this.tasks.filter(
      (t) => this.getTimingState(t) === 'completed_late'
    ).length;

    return { total, todo, inProgress, completed, overdue, completedLate };
  }

ngOnInit(): void {
  const user = this.currentUser();
  if (!user) return;

  // Manager / Supervisor يروحوا على صفحة الـ manager taskboard
  if (
    user.role === 'operation' &&
    (user.position === 'manager' || user.position === 'supervisor')
  ) {
    this.router.navigateByUrl('/operations/tasks-board');
    return;
  }

  this.loadMyTasks();
}


  // ====== Helpers للـ timing ======

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

  // ====== Data loading ======

  loadMyTasks(): void {
    this.loading = true;
    this.errorMsg = '';

    this.tasksApi.getMyTasks(this.selectedStatusFilter).subscribe({
      next: (rows) => {
        this.tasks = rows;
        this.currentPage = 1;
        this.initRowState(rows);
        this.loading = false;
      },
      error: (err) => {
        console.error('[MyTasks] loadMyTasks error', err);
        this.errorMsg = 'Failed to load your tasks';
        this.loading = false;
      },
    });
  }

  private initRowState(rows: Task[]): void {
    this.rowState = {};
    for (const t of rows) {
      this.rowState[t.id] = {
        status: t.status || 'todo',
        dirty: false,
        saving: false,
      };
    }
  }

  // ====== Filters / Pagination ======

  onStatusFilterChange(value: any): void {
    this.selectedStatusFilter = value as TaskStatus | 'all';
    this.currentPage = 1;
    this.loadMyTasks();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  onPageSizeChange(size: number): void {
    this.pageSize = Number(size) || 25;
    this.currentPage = 1;
  }

  // ====== Row update ======

  onRowChanged(taskId: number): void {
    const state = this.rowState[taskId];
    if (state) {
      state.dirty = true;
    }
  }

  markDone(task: Task): void {
    const state = this.rowState[task.id];
    if (!state) return;
    state.status = 'completed';
    this.onRowChanged(task.id);
    this.saveRow(task);
  }

  saveRow(task: Task): void {
    const state = this.rowState[task.id];
    if (!state || !state.dirty || state.saving) return;

    state.saving = true;

    this.tasksApi
      .updateTask(task.id, {
        status: state.status,
      })
      .subscribe({
        next: (updated) => {
          const idx = this.tasks.findIndex((t) => t.id === updated.id);
          if (idx !== -1) {
            this.tasks[idx] = updated;
          }

          this.rowState[task.id] = {
            status: updated.status,
            dirty: false,
            saving: false,
          };
        },
        error: (err) => {
          console.error('[MyTasks] saveRow error', err);
          state.saving = false;
        },
      });
  }
}
