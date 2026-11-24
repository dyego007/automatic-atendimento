export interface ChatMessage {
  id: string;
  sender: 'customer' | 'bot' | 'agent';
  text: string;
  timestamp: string;
}

export interface ChatSession {
  phone: string;
  customerName: string;
  nicheId: string;
  status: 'bot' | 'human' | 'finished';
  messages: ChatMessage[];
  lastActivity: string;
  metadata?: Record<string, any>;
}

export class SessionService {
  private sessions: Map<string, ChatSession> = new Map();

  public getOrCreateSession(phone: string, customerName = 'Cliente', nicheId = 'default'): ChatSession {
    const cleanPhone = phone.replace(/\D/g, '');
    let session = this.sessions.get(cleanPhone);

    if (!session) {
      session = {
        phone: cleanPhone,
        customerName,
        nicheId,
        status: 'bot',
        messages: [],
        lastActivity: new Date().toISOString()
      };
      this.sessions.set(cleanPhone, session);
    }

    return session;
  }

  public getSession(phone: string): ChatSession | undefined {
    const cleanPhone = phone.replace(/\D/g, '');
    return this.sessions.get(cleanPhone);
  }

  public addMessage(phone: string, sender: 'customer' | 'bot' | 'agent', text: string): ChatMessage {
    const session = this.getOrCreateSession(phone);
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

  public setStatus(phone: string, status: 'bot' | 'human' | 'finished'): ChatSession {
    const session = this.getOrCreateSession(phone);
    session.status = status;
    return session;
  }

  public listSessions(): ChatSession[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );
  }

  public clearSession(phone: string): void {
    const cleanPhone = phone.replace(/\D/g, '');
    this.sessions.delete(cleanPhone);
  }
}

export const sessionService = new SessionService();
