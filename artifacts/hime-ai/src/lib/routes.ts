import type { UserRole } from '@/contexts/auth-context';

/**
 * The canonical landing route for each role. Every redirect — after login,
 * after registration, from the "already signed in" guard — resolves through
 * here so a role can never end up on another role's dashboard.
 */
export const ROLE_HOME: Record<UserRole, string> = {
  seeker: '/seeker/dashboard',
  company: '/company/dashboard',
  admin: '/admin/dashboard',
};

export function roleHome(role: UserRole | undefined | null): string {
  return role ? ROLE_HOME[role] : '/login';
}

/** Public routes a signed-in user should never be pushed back to. */
export const PUBLIC_ROUTES = ['/', '/login', '/register', '/about'] as const;

export function isPublicRoute(path: string): boolean {
  const clean = path.split('?')[0].replace(/\/+$/, '') || '/';
  return PUBLIC_ROUTES.some((route) => route === clean);
}

/**
 * The route section owned by each role. Used to validate ?next= so a seeker
 * cannot follow it into /admin/* — but it must cover every page under the
 * role, not just its dashboard.
 */
export const ROLE_SECTION: Record<UserRole, string> = {
  seeker: '/seeker',
  company: '/company',
  admin: '/admin',
};

/** True when `path` belongs to the given role's section. */
export function isInRoleSection(path: string, role: UserRole): boolean {
  const section = ROLE_SECTION[role];
  return path === section || path.startsWith(`${section}/`);
}

/**
 * Where to send someone after they authenticate.
 *
 * `next` is captured by the caller *before* any navigation happens, because
 * the router rewrites the query string once it takes over. It is only honoured
 * when it belongs to the role that just signed in — otherwise a seeker could
 * follow ?next=/admin/jobs into the admin area.
 */
export function resolvePostAuthRedirect(role: UserRole, next?: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return roleHome(role);
  }
  // Strip any query/hash before checking the section.
  const path = next.split('?')[0].split('#')[0];
  if (isInRoleSection(path, role)) return next;
  return roleHome(role);
}

/** Reads the ?next= target from a search string. */
export function readNextParam(search: string): string | null {
  return new URLSearchParams(search).get('next');
}