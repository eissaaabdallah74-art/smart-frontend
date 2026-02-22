// src/app/components/sidebar/sidebar.component.ts
import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  OnInit,
  computed,
  inject,
  DestroyRef,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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

  openGroup: SidebarGroup = null;

  private readonly bgFollowService = inject(BackgroundFollowUpService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private currentUrl = '';

  readonly bgFollowUpCount = computed(() => this.bgFollowService.pendingCount());

  ngOnInit(): void {
    // background follow-up badge
    this.bgFollowService.refresh();

    // init url + group
    this.currentUrl = this.router.url || '';
    this.syncMenusWithUrl(this.currentUrl);

    // keep syncing on navigation
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((e) => {
        const ev = e as NavigationEnd;
        const url = ev.urlAfterRedirects || ev.url || '';
        this.currentUrl = url;
        this.syncMenusWithUrl(url);
      });

    // default open group (if no match happened)
    if (!this.openGroup) {
      this.openGroup = this.getDefaultGroupByRole();
    }
  }

  // ===== Role helpers =====
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

  // ===== positions داخل operations =====
  get isOperationManagerOrSupervisor(): boolean {
    if (this.role !== 'operation') return false;
    return this.position === 'manager' || this.position === 'supervisor';
  }

  get isOperationStaffWithCalls(): boolean {
    if (this.role !== 'operation') return false;
    return this.position === 'senior' || this.position === 'junior';
  }

  // ===== Menu visibility (logical) =====
  get canSeeOperationsGroup(): boolean {
    // group contains shared pages (pending/interviews) + operations pages
    return this.isAdmin || this.isOperations || this.isHr || this.isCrm || this.isFinance;
  }

  get canSeeCrmGroup(): boolean {
    // /clients is allowed for crm + operation + finance (and admin often)
    return this.isAdmin || this.isCrm || this.isOperations || this.isFinance;
  }

  get canSeePendingRequests(): boolean {
    // based on your route data
    return this.isAdmin || this.isHr || this.isOperations || this.isCrm || this.isFinance;
  }

  get canSeeInterviews(): boolean {
    // based on your route data (hr/admin/operation/supply_chain/crm/finance)
    return this.isAdmin || this.isHr || this.isOperations || this.isCrm || this.isFinance;
  }

  // ===== UI actions =====
  toggleGroup(group: Exclude<SidebarGroup, null>): void {
    this.openGroup = this.openGroup === group ? null : group;
  }

  // highlight parent group as active when any child route is active
  isGroupActive(group: Exclude<SidebarGroup, null>): boolean {
    const url = this.currentUrl || '';
    const hasAnyPrefix = (prefixes: string[]) =>
      prefixes.some((p) => url === p || url.startsWith(p + '/') || url.startsWith(p + '?'));

    switch (group) {
      case 'hr':
        return hasAnyPrefix(['/hr', '/attendance/requests', '/employment-contracts-status', '/security-background-check']);
      case 'tracking':
        return hasAnyPrefix(['/operations/tracking', '/drivers-tracking', '/drivers-tracking-details']);
      case 'crm':
        return hasAnyPrefix(['/clients', '/crm']);
      case 'finance':
        return hasAnyPrefix(['/finance']);
      case 'operations':
        return hasAnyPrefix([
          '/pending-requests',
          '/interviews',
          '/calls',
          '/my-calls',
          '/operations',
        ]);
      default:
        return false;
    }
  }

  private syncMenusWithUrl(url: string): void {
    // HR pages + My attendance requests
    if (
      url.startsWith('/hr') ||
      url.startsWith('/attendance/requests') ||
      url.startsWith('/employment-contracts-status') ||
      url.startsWith('/security-background-check')
    ) {
      this.openGroup = 'hr';
      return;
    }

    // Tracking
    if (
      url.startsWith('/operations/tracking') ||
      url.startsWith('/drivers-tracking') ||
      url.startsWith('/drivers-tracking-details')
    ) {
      this.openGroup = 'tracking';
      return;
    }

    // CRM
    if (url.startsWith('/clients') || url.startsWith('/crm')) {
      this.openGroup = 'crm';
      return;
    }

    // Finance
    if (url.startsWith('/finance')) {
      this.openGroup = 'finance';
      return;
    }

    // Operations
    if (
      url.startsWith('/operations') ||
      url.startsWith('/pending-requests') ||
      url.startsWith('/interviews') ||
      url.startsWith('/calls') ||
      url.startsWith('/my-calls')
    ) {
      this.openGroup = 'operations';
      return;
    }
  }

  private getDefaultGroupByRole(): Exclude<SidebarGroup, null> {
    if (this.isHr) return 'hr';
    if (this.isFinance) return 'finance';
    if (this.isCrm) return 'crm';
    if (this.isOperations) return 'operations';
    return 'hr'; // safe default (because it contains "My attendance requests")
  }
}
