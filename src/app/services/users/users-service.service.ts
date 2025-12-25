// src/app/services/users/users-service.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type UserRole =
  | 'admin'
  | 'crm'
  | 'operation'
  | 'hr'
  | 'finance'
  | 'supply_chain';

export type UserPosition = 'manager' | 'supervisor' | 'senior' | 'junior';

export interface ApiUser {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
  position?: UserPosition | null;
  isActive: boolean;
  hireDate?: string | null; // جديد
  terminationDate?: string | null; // جديد
  creationDate: string; // جديد
  created_at?: string;
  updated_at?: string;
}

export interface CreateUserDto {
  fullName: string;
  email: string;
  password: string;
  role?: UserRole;
  position?: UserPosition | null;
  isActive?: boolean;
  hireDate?: string | null; // جديد
  terminationDate?: string | null; // جديد
}

export interface UpdateUserDto {
  fullName?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  position?: UserPosition | null;
  isActive?: boolean;
  hireDate?: string | null; // جديد
  terminationDate?: string | null; // جديد
}

@Injectable({
  providedIn: 'root',
})
export class UsersServiceService {
  private readonly baseUrl = `${environment.apiUrl}/auth/users`;

  constructor(private http: HttpClient) {}

  getUsers(params?: {
    role?: UserRole;
    active?: boolean;
    q?: string;
  }): Observable<ApiUser[]> {
    let httpParams = new HttpParams();
    if (params?.role) httpParams = httpParams.set('role', params.role);
    if (params?.active !== undefined)
      httpParams = httpParams.set('active', String(params.active));
    if (params?.q) httpParams = httpParams.set('q', params.q);

    return this.http.get<ApiUser[]>(this.baseUrl, { params: httpParams });
  }

  getUser(id: number): Observable<ApiUser> {
    return this.http.get<ApiUser>(`${this.baseUrl}/${id}`);
  }

  createUser(body: CreateUserDto): Observable<ApiUser> {
    return this.http.post<ApiUser>(this.baseUrl, body);
  }

  updateUser(id: number, body: UpdateUserDto): Observable<ApiUser> {
    return this.http.put<ApiUser>(`${this.baseUrl}/${id}`, body);
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}