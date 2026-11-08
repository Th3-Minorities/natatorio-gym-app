const USER_PATHS = ['/welcome', '/sign-in', '/recover-password', '/reset-password', '/account', '/account/settings', '/account/delete', '/install']

export function isUserPath(path: string) { return USER_PATHS.includes(path) }
