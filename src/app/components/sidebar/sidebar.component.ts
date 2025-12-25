// src/app/components/sidebar/sidebar.component.ts
import { Component, Input, OnInit, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Permissions } from '../../models/types';
import {
  AuthRole,
  AuthPosition,
} from '../../services/auth/auth-service.service';
import { BackgroundFollowUpService } from '../../services/background-follow-up/background-follow-up-service.service';

type SidebarGroup = 'operations' | 'hr' | 'finance' | 'crm' | null;

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

  // nested contracts تحت HR
  hrContractsOpen = false;

  // Follow-up badge service
  private bgFollowService = inject(BackgroundFollowUpService);

  // count for badge (Negative & not Active)
  readonly bgFollowUpCount = computed(() => this.bgFollowService.pendingCount());

  ngOnInit(): void {
    // علشان الـ badge يظهر حتى قبل ما حد يفتح الصفحة
    // (لو مش حابب ده، شيل السطر ده وخليه يتعمل refresh من الصفحة بس)
    this.bgFollowService.refresh();
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
  toggleGroup(group: 'operations' | 'hr' | 'finance' | 'crm'): void {
    this.openGroup = this.openGroup === group ? null : group;
  }

  toggleHrContracts(): void {
    this.hrContractsOpen = !this.hrContractsOpen;
  }
}
