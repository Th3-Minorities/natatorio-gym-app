const USER_PATHS = ['/welcome', '/sign-in', '/recover-password', '/reset-password', '/account', '/account/settings', '/account/delete', '/account/privacy', '/check-in', '/install']

export const REGISTRATION_PATHS = ['/register', '/register/identify', '/register/password', '/privacy']

export function isUserPath(path: string) { return USER_PATHS.includes(path) || REGISTRATION_PATHS.includes(path) }
