// Demo-grade storage: everything lives in this browser's localStorage.
const USERS = 'pt_users';
const SESSION = 'pt_session';
const acctKey = (u) => `pt_account_${u}`;

const read = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } };
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

export const getUsers = () => read(USERS, {});
export const saveUsers = (u) => write(USERS, u);
export const getSession = () => localStorage.getItem(SESSION);
export const setSession = (u) => (u ? localStorage.setItem(SESSION, u) : localStorage.removeItem(SESSION));

export const emptyAccount = () => ({ cash: 0, positions: [], orders: [], history: [], txs: [] });
export const loadAccount = (u) => ({ ...emptyAccount(), ...read(acctKey(u), {}) });
export const saveAccount = (u, a) => write(acctKey(u), a);

export async function hash(text) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return btoa(unescape(encodeURIComponent(text)));
  }
}
