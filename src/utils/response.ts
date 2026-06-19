import type { Context } from 'hono';

export interface ApiSuccess<T = unknown> {
    success: true;
    data: T;
}

export interface ApiError {
    success: false;
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
}

export function jsonSuccess<T>(c: Context, data: T, status = 200) {
    return c.json({ success: true, data } satisfies ApiSuccess<T>, status);
}

export function jsonError(
    c: Context,
    code: string,
    message: string,
    status = 400,
    details?: unknown,
) {
    return c.json(
        {
            success: false,
            error: { code, message, ...(details !== undefined ? { details } : {}) },
        } satisfies ApiError,
        status,
    );
}
