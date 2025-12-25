import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Permissions } from '../../models/types';

export type AuthRole =
  | 'admin'
  | 'crm'
  | 'operation'
  | 'hr'
  | 'finance'
  | 'supply_chain';

export type AuthPosition = 'manager' | 'supervisor' | 'senior' | 'junior';

export interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  role: AuthRole;
  position?: AuthPosition | null;
  isActive: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
  perms: Permissions;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly baseUrl = environment.apiUrl; // لازم تكون مثلا: http://localhost:5000/api

  // ========= Signals =========
  private readonly _currentUser = signal<AuthUser | null>(
    this.loadUserFromStorage()
  );
  private readonly _permissions = signal<Permissions>(
    this.loadPermsFromStorage() ?? {
      isAdmin: false,
      canUseAiAssistant: false,
      canViewUsers: false,
      canCreateEntries: false,
      canViewFinance: false,
    }
  );
  private readonly _token = signal<string | null>(
    localStorage.getItem('auth_token')
  );

  // exposed signals
  readonly currentUser = computed(() => this._currentUser());
  readonly permissions = computed(() => this._permissions());
  readonly token = computed(() => this._token());

  constructor(private http: HttpClient) {}

  // ========= Helpers =========
  private loadUserFromStorage(): AuthUser | null {
    const raw = localStorage.getItem('auth_user');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }

  private loadPermsFromStorage(): Permissions | null {
    const raw = localStorage.getItem('auth_perms');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Permissions;
    } catch {
      return null;
    }
  }

  // ========= API =========
  async login(email: string, password: string): Promise<void> {
    const url = `${this.baseUrl}/auth/login`;
    console.log('[AuthService] login →', url, { email });

    const res = await firstValueFrom(
      this.http.post<LoginResponse>(url, { email, password })
    );

    console.log('[AuthService] login success', res);

    // update signals
    this._currentUser.set(res.user);
    this._permissions.set(res.perms);
    this._token.set(res.token);

    // persist
    localStorage.setItem('auth_user', JSON.stringify(res.user));
    localStorage.setItem('auth_perms', JSON.stringify(res.perms));
    localStorage.setItem('auth_token', res.token);
  }

  logout(): void {
    this._currentUser.set(null);
    this._permissions.set({
      isAdmin: false,
      canUseAiAssistant: false,
      canViewUsers: false,
      canCreateEntries: false,
      canViewFinance: false,
    });
    this._token.set(null);

    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_perms');
    localStorage.removeItem('auth_token');
  }

  get isAuthenticated(): boolean {
    return !!this._token();
  }


  getAuthorizationHeader(): { [header: string]: string } {
  const token = this._token();
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
  };
}

}
