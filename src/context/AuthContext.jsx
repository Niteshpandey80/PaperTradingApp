import { createContext, useContext, useState } from 'react';
import { getUsers, saveUsers, getSession, setSession, hash } from '../services/storage.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getSession());

  const register = async (name, password) => {
    const username = name.trim().toLowerCase();
    if (username.length < 3) throw new Error('Username must be at least 3 characters.');
    if (password.length < 4) throw new Error('Password must be at least 4 characters.');
    const users = getUsers();
    if (users[username]) throw new Error('That username is taken.');
    users[username] = { hash: await hash(password), createdAt: Date.now() };
    saveUsers(users);
    setSession(username);
    setUser(username);
  };

  const login = async (name, password) => {
    const username = name.trim().toLowerCase();
    const u = getUsers()[username];
    if (!u || u.hash !== (await hash(password))) throw new Error('Wrong username or password.');
    setSession(username);
    setUser(username);
  };

  const logout = () => { setSession(null); setUser(null); };

  return <Ctx.Provider value={{ user, register, login, logout }}>{children}</Ctx.Provider>;
}
