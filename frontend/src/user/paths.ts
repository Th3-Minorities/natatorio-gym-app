const USER_PATHS = ['/welcome', '/sign-in', '/recover-password', '/reset-password', '/account', '/account/settings', '/account/delete', '/check-in', '/gym']

export function isUserPath(path: string) { return USER_PATHS.includes(path) }
