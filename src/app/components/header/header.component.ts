// src/app/components/header/header.component.ts
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthUser } from '../../services/auth/auth-service.service';
import { Permissions } from '../../models/types';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent {
  @Input() user: AuthUser | null = null;
  @Input() perms?: Permissions | null;
  @Output() logout = new EventEmitter<void>();

  mobileMenuOpen = false;
  driversMobileOpen = false;

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;

    if (!this.mobileMenuOpen) {
      this.driversMobileOpen = false;
    }
  }

  toggleDriversMobile(): void {
    this.driversMobileOpen = !this.driversMobileOpen;
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen = false;
    this.driversMobileOpen = false;
  }
}
