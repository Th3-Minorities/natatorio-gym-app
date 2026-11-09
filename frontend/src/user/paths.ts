const USER_PATHS = ['/welcome', '/sign-in', '/recover-password', '/reset-password', '/account', '/account/settings', '/account/delete', '/account/privacy', '/check-in', '/install', '/gym']

export const REGISTRATION_PATHS = ['/register', '/register/identify', '/register/password', '/register/photo', '/register/contact', '/register/waiver', '/register/athlete', '/privacy']

export function isUserPath(path: string) { return USER_PATHS.includes(path) || REGISTRATION_PATHS.includes(path) }
