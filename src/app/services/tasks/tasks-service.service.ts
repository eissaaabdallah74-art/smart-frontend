// src/app/services/tasks/tasks-service.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiUser } from '../users/users-service.service';

export type TaskStatus = 'todo' | 'in_progress' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: number;

  title: string | null;
  description: string | null;

  status: TaskStatus;
  priority: TaskPriority | null;

  assignee_id: number;
  created_by_id: number;

  due_at: string | null;
  completed_at: string | null;

  assignee?: ApiUser;
  createdBy?: ApiUser;

  createdAt?: string;
  updatedAt?: string;
}

export interface ManagerTasksQuery {
  assigneeId?: number;
  status?: TaskStatus | 'all';
  fromDate?: string; // ISO date (yyyy-MM-dd)
  toDate?: string;   // ISO date (yyyy-MM-dd)
  q?: string;
}

export interface CreateTaskDto {
  title: string;
  description?: string | null;
  assigneeId: number;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueAt?: string | null; // ISO datetime
}

export interface UpdateTaskDto {
  title?: string;
  description?: string | null;
  assigneeId?: number;
  status?: TaskStatus;
  priority?: TaskPriority | null;
  dueAt?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class TasksServiceService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/tasks`;

  /**
   * ========== Operation Staff (سينيور / جونيور / مانجر) ==========
   * NOTE:
   * Backend موجود عندك في: GET /api/auth/operation/staff
   * وبيستخدم query param: active=true/false
   *
   * includeInactive:
   * - false => نجيب النشطين فقط => active=true
   * - true  => نجيب الكل => منبعتش active
   */
  getOperationStaff(includeInactive = false): Observable<ApiUser[]> {
    let params = new HttpParams();

    if (!includeInactive) {
      params = params.set('active', 'true');
    }

    return this.http.get<ApiUser[]>(
      `${environment.apiUrl}/auth/operation/staff`,
      { params }
    );
  }

  // ========== Manager / Supervisor ==========

  /**
   * Tasks للـ Manager عن طريق assignee (زي calls)
   */
  getTasksByAssignee(
    assigneeId: number,
    query?: ManagerTasksQuery
  ): Observable<Task[]> {
    let params = new HttpParams();

    if (query?.status && query.status !== 'all') {
      params = params.set('status', query.status);
    }
    if (query?.fromDate) {
      params = params.set('fromDate', query.fromDate);
    }
    if (query?.toDate) {
      params = params.set('toDate', query.toDate);
    }
    if (query?.q) {
      params = params.set('q', query.q);
    }

    return this.http.get<Task[]>(
      `${this.baseUrl}/by-assignee/${assigneeId}`,
      { params }
    );
  }

  createTask(payload: CreateTaskDto): Observable<Task> {
    return this.http.post<Task>(this.baseUrl, {
      title: payload.title,
      description: payload.description ?? null,
      assigneeId: payload.assigneeId,
      status: payload.status ?? 'todo',
      priority: payload.priority ?? 'medium',
      dueAt: payload.dueAt ?? null,
    });
  }

  updateTask(id: number, payload: UpdateTaskDto): Observable<Task> {
    return this.http.patch<Task>(`${this.baseUrl}/${id}`, {
      title: payload.title,
      description: payload.description,
      assigneeId: payload.assigneeId,
      status: payload.status,
      priority: payload.priority,
      dueAt: payload.dueAt,
    });
  }

  deleteTask(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`);
  }

  // ========== My Tasks (Senior / Junior) ==========

  getMyTasks(status: TaskStatus | 'all' = 'all'): Observable<Task[]> {
    let params = new HttpParams();
    if (status !== 'all') {
      params = params.set('status', status);
    }
    return this.http.get<Task[]>(`${this.baseUrl}/my/all`, { params });
  }
}
