import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  AuthService,
  AuthRole,
  AuthPosition,
} from '../../../services/auth/auth-service.service';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage {
  email = 'admin@smart.com';
  password = 'admin';
  loading = false;
  error = '';

  selectedRole: AuthRole = 'admin';
  selectedPosition: AuthPosition | '' = '';

  constructor(private auth: AuthService, private router: Router) {}

  private getDefaultRouteForRole(role: AuthRole): string {
    switch (role) {
      case 'operation':
      case 'supply_chain':
        return '/drivers';

      case 'crm':
      case 'finance':
        return '/clients';

      case 'hr':
        return '/interviews';

      case 'admin':
      default:
        return '/';
    }
  }

  async submit() {
    if (!this.email || !this.password) {
      this.error = 'الرجاء إدخال البريد الإلكتروني وكلمة المرور';
      return;
    }

    this.loading = true;
    this.error = '';

    try {
      await this.auth.login(this.email, this.password);

      const user = this.auth.currentUser();
      const target = user
        ? this.getDefaultRouteForRole(user.role)
        : '/';

      await this.router.navigateByUrl(target);
    } catch (e: any) {
      console.error('[LoginPage] login error', e);
      this.error = e?.error?.message || e?.message || 'Login failed';
    } finally {
      this.loading = false;
    }
  }
}
