import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth/auth-service.service';
import { Permissions } from '../models/types';

// نفس الـ roles اللي بتستخدمها في الباك/الفرونت
type AuthRole = 'admin' | 'crm' | 'operation' | 'hr' | 'finance' | 'supply_chain';

// دي الفانكشن اللي بتحدد الـ landing page لكل role
function getDefaultRouteForRole(role: AuthRole): string {
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

export const permissionsGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // لو مفيش توكن → روح للّوجين
  if (!auth.isAuthenticated) {
    return router.createUrlTree(['/login']);
  }

  const user = auth.currentUser();
  const perms = auth.permissions();

  // user مش محمّل أو inactive
  if (!user || !user.isActive) {
    auth.logout();
    return router.createUrlTree(['/login']);
  }

  const requiredPerm = route.data['perm'] as keyof Permissions | undefined;
  const requiredRoles = route.data['roles'] as AuthRole[] | undefined;

  // Admin bypass: يدخل أي صفحة
  if (perms.isAdmin) {
    return true;
  }

  // ===== check roles لو الصفحة مقيّدة بأدوار معينة =====
  if (requiredRoles && requiredRoles.length > 0) {
    if (!requiredRoles.includes(user.role as AuthRole)) {
      const fallback = getDefaultRouteForRole(user.role as AuthRole);

      // أمان زيادة: لو (لأي سبب) المسار الحالي هو نفس الـ fallback
      // متدخلش في loop → رجّعه للّوجين
      if (state.url === fallback) {
        return router.createUrlTree(['/login']);
      }

      return router.createUrlTree([fallback]);
    }
  }

  // ===== check permissions لو الصفحة مقيّدة بـ perm معين =====
  if (requiredPerm) {
    if (!(perms as any)[requiredPerm]) {
      const fallback = getDefaultRouteForRole(user.role as AuthRole);

      if (state.url === fallback) {
        return router.createUrlTree(['/login']);
      }

      return router.createUrlTree([fallback]);
    }
  }

  // لو عدّى كل الشروط → يسمح بالدخول
  return true;
};
