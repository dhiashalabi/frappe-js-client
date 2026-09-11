export interface AuthResponse {
    message?: string
    home_page?: string
    full_name?: string
    tmp_id?: string
    verification?: { method: string; message?: string; status?: boolean }
    exc_type?: string
    /** Extra server-provided fields exist at runtime but are intentionally untyped here. */
    [key: string]: unknown
}

/** Username/password login. OTP fields may be sent on the same request after the first factor. */
export interface UserPassCredentials {
    username: string
    password: string
    device?: string
    otp?: string
    tmpId?: string
}

/** Second-factor login using a `tmp_id` from the previous `login` response. */
export interface OTPCredentials {
    otp: string
    tmpId: string
    device?: string
    username?: string
    password?: string
}

export type AuthCredentials = UserPassCredentials | OTPCredentials
