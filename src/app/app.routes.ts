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


  // ===== Tracking (Operations) =====
{
  path: 'operations/tracking/gps',
  loadComponent: () =>
    import('./pages/operation pages/tracking-gps/tracking-gps.component').then(
      (m) => m.TrackingGpsComponent
    ),
  canActivate: [permissionsGuard],
  data: {
    roles: ['operation', 'supply_chain', 'admin'],
  },
},
{
  path: 'operations/tracking/expired-drivers-data',
  loadComponent: () =>
    import(
      './pages/operation pages/expired-drivers-data/expired-drivers-data.component'
    ).then((m) => m.ExpiredDriversDataComponent),
  canActivate: [permissionsGuard],
  data: {
    roles: ['operation', 'supply_chain', 'admin'],
  },
},

// ===== Sub Contractors (Operations) =====
{
  path: 'operations/sub-contractors',
  loadComponent: () =>
    import(
      './pages/operation pages/sub-contractors/sub-contractors.component'
    ).then((m) => m.SubContractorsComponent),
  canActivate: [permissionsGuard],
  data: {
    roles: ['operation', 'supply_chain', 'admin'],
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



    // ===== HR Employees =====
  {
    path: 'hr/employees',
    loadComponent: () =>
      import('./pages/hr pages/employees/employees.component').then(
        (m) => m.EmployeesComponent
      ),
    canActivate: [permissionsGuard],
    data: {
      roles: ['hr', 'admin'],
    },
  },

  {
    path: 'hr/employees/:id',
    loadComponent: () =>
      import('./pages/hr pages/employees/components/employee-details/employee-details.component').then(
        (m) => m.EmployeeDetailsComponent
      ),
    canActivate: [permissionsGuard],
    data: {
      roles: ['hr', 'admin', 'finance'], // لو هتسمح payroll تبقى finance/admin
    },
  },


  {
  path: 'hr/deductions',
  loadComponent: () =>
    import('./pages/hr pages/deduction/deduction.component').then(
      (m) => m.DeductionComponent
    ),
  canActivate: [permissionsGuard],
  data: {
    roles: ['hr', 'admin'],
  },
},


// ===== Loans (Operation) =====

// Loans Approvals (Manager/Supervisor view)
{
  path: 'operations/loans-approvals',
  loadComponent: () =>
    import('./pages/operation pages/loans-approvals/loans-approvals.component').then(
      (m) => m.LoansApprovalsComponent
    ),
  canActivate: [permissionsGuard],
  data: {
    roles: ['operation'], // جوه الكومبوننت فلترة position
  },
},

// Loans Request (Senior/Junior view)
{
  path: 'operations/loans-request',
  loadComponent: () =>
    import('./pages/operation pages/loans-request/loans-request.component').then(
      (m) => m.LoansRequestComponent
    ),
  canActivate: [permissionsGuard],
  data: {
    roles: ['operation'],
  },
},

{
  path: 'hr/clients-contracts',
  loadComponent: () =>
    import('./pages/hr pages/clients-contracts/clients-contracts.component')
      .then((m) => m.ClientsContractsComponent),
  canActivate: [permissionsGuard],
  data: {
    roles: ['hr', 'admin'],
  },
},

// ===== HR Attendance =====
{
  path: 'hr/attendance',
  loadComponent: () =>
    import('./pages/hr pages/attendance/hr-attendance/hr-attendance.component').then(
      (m) => m.HrAttendanceComponent
    ),
  canActivate: [permissionsGuard],
  data: { roles: ['hr', 'admin'] },
},

{
  path: 'hr/attendance/import',
  loadComponent: () =>
    import('./pages/hr pages/attendance-import/hr-attendance-import/hr-attendance-import.component').then(
      (m) => m.HrAttendanceImportComponent
    ),
  canActivate: [permissionsGuard],
  data: { roles: ['hr', 'admin'] },
},

{
  path: 'hr/attendance/mapping',
  loadComponent: () =>
    import('./pages/hr pages/attendance-mapping/hr-attendance-mapping/hr-attendance-mapping.component').then(
      (m) => m.HrAttendanceMappingComponent
    ),
  canActivate: [permissionsGuard],
  data: { roles: ['hr', 'admin'] },
},

// تفاصيل موظف واحد (اللي اشتغلنا عليها)
{
  path: 'hr/attendance/employee/:id',
  loadComponent: () =>
    import('./pages/hr pages/attendance-employee/hr-attendance-employee/hr-attendance-employee.component').then(
      (m) => m.HrAttendanceEmployeeComponent
    ),
  canActivate: [permissionsGuard],
  data: { roles: ['hr', 'admin'] },
},

{
  path: 'hr/attendance/excuses',
  loadComponent: () =>
    import('./pages/hr pages/attendance-excuses/hr-attendance-excuses/hr-attendance-excuses.component').then(
      (m) => m.HrAttendanceExcusesComponent
    ),
  canActivate: [permissionsGuard],
  data: { roles: ['hr', 'admin'] },
},




  { path: '**', redirectTo: '' },
];
  