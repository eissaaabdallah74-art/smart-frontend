// src/app/components/sidebar/sidebar.component.ts
import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';

import { Permissions } from '../../models/types';
import { AuthRole, AuthPosition } from '../../services/auth/auth-service.service';
import { BackgroundFollowUpService } from '../../services/background-follow-up/background-follow-up-service.service';

type SidebarGroup = 'operations' | 'tracking' | 'hr' | 'finance' | 'crm' | null;

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent implements OnInit {
  @Input() perms!: Permissions;
  @Input() role!: AuthRole;
  @Input() position: AuthPosition | null = null;

  // جروب واحد بس يبقى مفتوح
  openGroup: SidebarGroup = 'operations';

  // nested contracts تحت HR (لو عندك استخدام له بعدين)
  hrContractsOpen = false;

  private readonly bgFollowService = inject(BackgroundFollowUpService);
  private readonly router = inject(Router);

  readonly bgFollowUpCount = computed(() => this.bgFollowService.pendingCount());

  ngOnInit(): void {
    this.bgFollowService.refresh();

    this.syncMenusWithUrl(this.router.url);

    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e) => {
        const ev = e as NavigationEnd;
        const url = ev.urlAfterRedirects || ev.url;
        this.syncMenusWithUrl(url);
      });
  }

  private syncMenusWithUrl(url: string): void {
    // Tracking top-level
    if (url.startsWith('/operations/tracking')) {
      this.openGroup = 'tracking';
      return;
    }

    // Sub Contractors under Operations
    if (url.startsWith('/operations/sub-contractors')) {
      this.openGroup = 'operations';
      return;
    }

    // Drivers page exists but hidden from sidebar for now
    if (url.startsWith('/drivers')) {
      this.openGroup = 'operations';
      return;
    }

    // any other operations pages
    if (url.startsWith('/operations')) {
      this.openGroup = 'operations';
      return;
    }
  }

  // ===== Helpers بحسب الـ role =====
  get isAdmin(): boolean {
    return this.role === 'admin';
  }

  get isOperations(): boolean {
    return this.role === 'operation' || this.role === 'supply_chain';
  }

  get isHr(): boolean {
    return this.role === 'hr';
  }

  get isFinance(): boolean {
    return this.role === 'finance';
  }

  get isCrm(): boolean {
    return this.role === 'crm';
  }

  // ===== Positions داخل Operations =====
  get isOperationManagerOrSupervisor(): boolean {
    if (this.role !== 'operation') return false;
    return this.position === 'manager' || this.position === 'supervisor';
  }

  get isOperationStaffWithCalls(): boolean {
    if (this.role !== 'operation') return false;
    return this.position === 'senior' || this.position === 'junior';
  }

  // ===== Top-level accordion =====
  toggleGroup(group: Exclude<SidebarGroup, null>): void {
    this.openGroup = this.openGroup === group ? null : group;
  }

  toggleHrContracts(): void {
    this.hrContractsOpen = !this.hrContractsOpen;
  }
}
