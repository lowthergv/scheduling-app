async function sha256hex(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPin(pin) {
    return sha256hex(String(pin));
}

export async function verifyPin(pin, hash) {
    return (await sha256hex(String(pin))) === hash;
}

export function isPinSet(state) {
    return !!state.settings?.pin;
}
