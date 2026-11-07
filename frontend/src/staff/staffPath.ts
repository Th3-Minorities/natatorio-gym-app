/**
 * The staff dashboard lives at /staff (team decision on E-124's open path name, 2026-11-06), on the same
 * name as the app and with no link from the User sign-in. /staff/recuperar is the password reset of #84.
 */
export const STAFF_PATH = '/staff'

export function isStaffPath(pathname: string): boolean {
  return pathname === STAFF_PATH || pathname.startsWith(`${STAFF_PATH}/`)
}
