export interface ChatMessage {
  id: string;
  sender: 'customer' | 'bot' | 'agent';
  text: string;
  timestamp: string;
}

export interface ChatSession {
  storeId: string;
  phone: string;
  jid?: string;
  customerName: string;
  nicheId: string;
  status: 'bot' | 'human' | 'finished';
  messages: ChatMessage[];
  lastActivity: string;
  metadata?: Record<string, any>;
}

export class SessionService {
  private sessions: Map<string, ChatSession> = new Map();

  private getSessionKey(storeId: string, phone: string): string {
    const cleanPhone = phone.replace(/\D/g, '');
    return `${storeId || 'default'}:${cleanPhone}`;
  }

  public getOrCreateSession(storeId: string, phone: string, customerName = 'Cliente', nicheId = 'default', jid?: string): ChatSession {
    const cleanPhone = phone.replace(/\D/g, '');
    const key = this.getSessionKey(storeId, cleanPhone);
    let session = this.sessions.get(key);

    if (!session) {
      session = {
        storeId: storeId || 'default',
        phone: cleanPhone,
        jid,
        customerName,
        nicheId,
        status: 'bot',
        messages: [],
        lastActivity: new Date().toISOString()
      };
      this.sessions.set(key, session);
    } else {
      if (jid) session.jid = jid;
      if (customerName && customerName !== 'Cliente') session.customerName = customerName;
    }

    return session;
  }

  public getSession(storeId: string, phone: string): ChatSession | undefined {
    return this.sessions.get(this.getSessionKey(storeId, phone));
  }

  public addMessage(storeId: string, phone: string, sender: 'customer' | 'bot' | 'agent', text: string): ChatMessage {
    const session = this.getOrCreateSession(storeId, phone);
    const message: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      sender,
      text,
      timestamp: new Date().toISOString()
    };

    session.messages.push(message);
    session.lastActivity = message.timestamp;
    return message;
  }

  public setStatus(storeId: string, phone: string, status: 'bot' | 'human' | 'finished'): ChatSession {
    const session = this.getOrCreateSession(storeId, phone);
    session.status = status;
    return session;
  }

  public listSessions(storeId?: string): ChatSession[] {
    const list = Array.from(this.sessions.values());
    const filtered = storeId ? list.filter(s => s.storeId === storeId) : list;
    return filtered.sort(
      (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );
  }

  public clearSession(storeId: string, phone: string): void {
    this.sessions.delete(this.getSessionKey(storeId, phone));
  }
}

export const sessionService = new SessionService();
