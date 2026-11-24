import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface User {
  id: string;
  name: string;
  email: string;
  password: string; // Em produção usar hash bcrypt; aqui sha256 simples
  role: 'admin' | 'operator';
  storeId?: string; // Se for operator, vinculado a uma loja específica
  createdAt: string;
}

export interface SessionToken {
  token: string;
  userId: string;
  expiresAt: number;
}

export class AuthService {
  private usersFile: string;
  private users: Map<string, User> = new Map();
  private activeTokens: Map<string, SessionToken> = new Map();

  constructor() {
    this.usersFile = path.resolve(__dirname, '../../src/presets/users.json');
    this.loadUsers();
  }

  private hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  private loadUsers(): void {
    if (fs.existsSync(this.usersFile)) {
      try {
        const content = fs.readFileSync(this.usersFile, 'utf-8');
        const list: User[] = JSON.parse(content);
        list.forEach(u => this.users.set(u.email.toLowerCase(), u));
        return;
      } catch (err) {
        console.error('Erro ao ler users.json:', err);
      }
    }

    // Usuários padrão iniciais para teste imediato
    const defaultUsers: User[] = [
      {
        id: 'user-admin',
        name: 'Administrador SaaS (Dyego)',
        email: 'admin@autoatende.com',
        password: this.hashPassword('admin123'),
        role: 'admin',
        createdAt: new Date().toISOString()
      },
      {
        id: 'user-secretaria',
        name: 'Camila (Secretária OdontoVida)',
        email: 'secretaria@odontovida.com',
        password: this.hashPassword('senha123'),
        role: 'operator',
        storeId: 'loja-1', // Acesso restrito à Clínica OdontoVida
        createdAt: new Date().toISOString()
      },
      {
        id: 'user-atendente',
        name: 'Beto (Atendente Disk Bebidas)',
        email: 'atendente@diskbebidas.com',
        password: this.hashPassword('senha123'),
        role: 'operator',
        storeId: 'loja-2', // Acesso restrito à Distribuidora
        createdAt: new Date().toISOString()
      }
    ];

    defaultUsers.forEach(u => this.users.set(u.email.toLowerCase(), u));
    this.saveUsers();
  }

  public login(email: string, passwordPlain: string): { user: Omit<User, 'password'>; token: string } {
    const user = this.users.get(email.toLowerCase().trim());
    if (!user) {
      throw new Error('E-mail ou senha inválidos.');
    }

    const hashedInput = this.hashPassword(passwordPlain);
    if (user.password !== hashedInput) {
      throw new Error('E-mail ou senha inválidos.');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 dias

    this.activeTokens.set(token, {
      token,
      userId: user.id,
      expiresAt
    });

    const { password, ...safeUser } = user;
    return { user: safeUser, token };
  }

  public getUserByToken(token: string): Omit<User, 'password'> | null {
    if (!token) return null;
    const session = this.activeTokens.get(token);
    if (!session || session.expiresAt < Date.now()) {
      if (session) this.activeTokens.delete(token);
      return null;
    }

    const user = Array.from(this.users.values()).find(u => u.id === session.userId);
    if (!user) return null;

    const { password, ...safeUser } = user;
    return safeUser;
  }

  public logout(token: string): void {
    this.activeTokens.delete(token);
  }

  public listUsers(): Omit<User, 'password'>[] {
    return Array.from(this.users.values()).map(({ password, ...safe }) => safe);
  }

  public createUser(data: { name: string; email: string; password: string; role: 'admin' | 'operator'; storeId?: string }): Omit<User, 'password'> {
    const emailKey = data.email.toLowerCase().trim();
    if (this.users.has(emailKey)) {
      throw new Error('Já existe um usuário cadastrado com este e-mail.');
    }

    const id = `user-${Date.now().toString(36)}`;
    const newUser: User = {
      id,
      name: data.name,
      email: emailKey,
      password: this.hashPassword(data.password),
      role: data.role,
      storeId: data.storeId,
      createdAt: new Date().toISOString()
    };

    this.users.set(emailKey, newUser);
    this.saveUsers();

    const { password, ...safeUser } = newUser;
    return safeUser;
  }

  public deleteUser(id: string): boolean {
    const user = Array.from(this.users.values()).find(u => u.id === id);
    if (!user) return false;
    if (user.role === 'admin' && this.listUsers().filter(u => u.role === 'admin').length <= 1) {
      throw new Error('Não é possível remover o único administrador do sistema.');
    }

    this.users.delete(user.email.toLowerCase());
    this.saveUsers();
    return true;
  }

  private saveUsers(): void {
    const list = Array.from(this.users.values());
    fs.writeFileSync(this.usersFile, JSON.stringify(list, null, 2), 'utf-8');
  }
}

export const authService = new AuthService();
