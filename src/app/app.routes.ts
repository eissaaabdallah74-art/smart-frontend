import { Routes } from '@angular/router';
import { permissionsGuard } from './guards/permissions.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/shared pages/login/login.page').then(
        (m) => m.LoginPage
      ),
  },

  // ===== Dashboard (Admin only) =====
  {
    path: '',
    loadComponent: () =>
      import('./pages/shared pages/dashboard/dashboard.page').then(
        (m) => m.DashboardPage
      ),
    canActivate: [permissionsGuard],
    data: {
      roles: ['admin'],
    },
  },

  // ===== Drivers (Operations + Supply Chain) =====
  {
    path: 'drivers',
    loadComponent: () =>
      import('./pages/shared pages/drivers/drivers.page').then(
        (m) => m.DriversPage
      ),
    canActivate: [permissionsGuard],
    data: {
      roles: ['operation', 'supply_chain'],
    },
  },

  {
    path: 'drivers-tracking',
    loadComponent: () =>
      import(
        './pages/operation pages/drivers-tracker/drivers-tracker.component'
      ).then((m) => m.DriversTrackerComponent),
    canActivate: [permissionsGuard],
    data: {
      roles: ['operation', 'supply_chain'],
    },
  },

  {
    path: 'drivers-tracking-details/:id',
    loadComponent: () =>
      import(
        './pages/operation pages/drivers-tracker/components/tracking-details/tracking-details.component'
      ).then((m) => m.TrackingDetailsComponent),
    canActivate: [permissionsGuard],
    data: {
      roles: ['operation', 'supply_chain'],
    },
  },

  {
    path: 'drivers/:id',
    loadComponent: () =>
      import(
        './pages/shared pages/drivers/components/drivers-details-modal/drivers-details-modal.component'
      ).then((m) => m.DriversDetailsModalComponent),
    canActivate: [permissionsGuard],
    data: {
      roles: ['operation', 'supply_chain'],
    },
  },

  // ===== Clients (CRM + Operations + Finance) =====
  {
    path: 'clients',
    loadComponent: () =>
      import('./pages/shared pages/clients/clients.page').then(
        (m) => m.ClientsPage
      ),
    canActivate: [permissionsGuard],
    data: {
      roles: ['crm', 'operation', 'finance'],
    },
  },

  {
    path: 'clients/:id',
    loadComponent: () =>
      import(
        './pages/operation pages/client-page/client-page.component'
      ).then((m) => m.ClientPageComponent),
    canActivate: [permissionsGuard],
    data: {
      roles: ['crm', 'operation', 'finance'],
    },
  },

  // ===== Interviews (HR + باقي الأقسام اللي أنت سامح لها) =====
  {
    path: 'interviews',
    loadComponent: () =>
      import('./pages/shared pages/interview/interview.component').then(
        (m) => m.InterviewComponent
      ),
    canActivate: [permissionsGuard],
    data: {
      roles: ['hr', 'admin', 'operation', 'supply_chain', 'crm', 'finance'],
    },
  },

  // PendingRequestComponent
  {
    path: 'pending-requests',
    loadComponent: () =>
      import(
        './pages/shared pages/pending-request/pending-request.component'
      ).then((m) => m.PendingRequestComponent),
    canActivate: [permissionsGuard],
    data: {
      roles: ['hr', 'admin', 'operation', 'supply_chain', 'crm', 'finance'],
    },
  },

  // صفحة details مستقلة للـ Interview
  {
    path: 'interviews/:id',
    loadComponent: () =>
      import(
        './pages/shared pages/interview/components/interview-driver-details/interview-driver-details.component'
      ).then((m) => m.InterviewDriverDetailsComponent),
    canActivate: [permissionsGuard],
    data: {
      roles: ['hr', 'admin', 'operation', 'supply_chain', 'crm', 'finance'],
    },
  },

  // ===== Users (Admin + HR مع perm معين) =====
  {
    path: 'users',
    loadComponent: () =>
      import('./pages/admin pages/users/users.page').then(
        (m) => m.UsersPage
      ),
    canActivate: [permissionsGuard],
    data: {
      perm: 'canViewUsers',
      roles: ['admin', 'hr'],
    },
  },

  // ===== Employment Contracts Status (HR) =====
  {
    path: 'employment-contracts-status',
    loadComponent: () =>
      import(
        './pages/hr pages/employment-contracts-status/employment-contracts-status.component'
      ).then((m) => m.EmploymentContractsStatusComponent),
    canActivate: [permissionsGuard],
    data: {
      roles: ['hr'],
    },
  },

  // ===== Security Background Check (HR) =====
  {
    path: 'security-background-check',
    loadComponent: () =>
      import(
        './pages/hr pages/security-background-check/security-background-check.component'
      ).then((m) => m.SecurityBackgroundCheckComponent),
    canActivate: [permissionsGuard],
    data: {
      roles: ['hr'],
    },
  },

  // ===== Tasks (Operation – Manager/Supervisor view) =====
  {
    path: 'operations/tasks-board',
    loadComponent: () =>
      import('./pages/operation pages/smv-tasks/smv-tasks.component').then(
        (m) => m.SmvTasksComponent
      ),
    canActivate: [permissionsGuard],
    data: {
      roles: ['operation'], // جوه الكومبوننت هنفلتر position
    },
  },

  // ===== My Tasks (Operation – Senior/Junior view) =====
  {
    path: 'operations/my-tasks',
    loadComponent: () =>
      import('./pages/operation pages/my-tasks/my-tasks.component').then(
        (m) => m.MyTasksComponent
      ),
    canActivate: [permissionsGuard],
    data: {
      roles: ['operation'],
    },
  },

  {
  path: 'operations/team-reports',
  loadComponent: () =>
    import('./pages/operation pages/team-reports/team-reports.component').then(
      (m) => m.TeamReportsComponent
    ),
},


  // ===== Calls (Operation – Manager/Supervisor view) =====
  {
    path: 'calls',
    loadComponent: () =>
      import('./pages/operation pages/smv-calls/smv-calls.component').then(
        (m) => m.SmvCallsComponent
      ),
    canActivate: [permissionsGuard],
    data: {
      roles: ['operation'], // جوه الكومبوننت هنفلتر position
    },
  },


  // ===== Background Follow Up (Operations) =====
{
  path: 'operations/background-follow-up',
  loadComponent: () =>
    import(
      './pages/operation pages/background-follow-up/background-follow-up.component'
    ).then((m) => m.BackgroundFollowUpComponent),
  canActivate: [permissionsGuard],
  data: {
    roles: ['operation', 'supply_chain', 'admin'],
  },
},


  // ===== My Calls (Operation – Senior/Junior view) =====
  {
    path: 'my-calls',
    loadComponent: () =>
      import('./pages/operation pages/calls/calls.component').then(
        (m) => m.CallsComponent
      ),
    canActivate: [permissionsGuard],
    data: {
      roles: ['operation'],
    },
  },

  { path: '**', redirectTo: '' },
];
