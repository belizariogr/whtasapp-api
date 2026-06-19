import type { LoginStatus } from './types.ts';

export function resolveLoginStatus(
    hasCreds: boolean,
    activeQrLogin: boolean,
): LoginStatus {
    if (activeQrLogin) {
        return 'qr_pending';
    }

    return hasCreds ? 'logged_in' : 'logged_out';
}
