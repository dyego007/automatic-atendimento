import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface NicheConfig {
  id: string;
  name: string;
  category: string;
  description: string;
  persona: {
    agentName: string;
    tone: string;
    instructions: string;
  };
  businessInfo: {
    hours: string;
    address: string;
    phone: string;
    paymentMethods?: string;
    deliveryRules?: string;
  };
  services?: Array<{ name: string; price: string; duration?: string; description?: string }>;
  products?: Array<{ name: string; price: string; category?: string; status?: string }>;
  agreements?: string[];
  faq?: Array<{ question: string; answer: string }>;
}

export class NicheService {
  private presetsDir: string;
  private activeNicheId: string;
  private nichesCache: Map<string, NicheConfig> = new Map();

  constructor() {
    this.presetsDir = path.resolve(__dirname, '../presets');
    this.activeNicheId = process.env.DEFAULT_NICHE || 'dentista';
    this.loadNiches();
  }

  public loadNiches(): void {
    this.nichesCache.clear();
    if (!fs.existsSync(this.presetsDir)) {
      return;
    }

    const files = fs.readdirSync(this.presetsDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(this.presetsDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const niche: NicheConfig = JSON.parse(content);
          this.nichesCache.set(niche.id, niche);
        } catch (err) {
          console.error(`Erro ao carregar nicho ${file}:`, err);
        }
      }
    }
  }

  public listNiches(): NicheConfig[] {
    return Array.from(this.nichesCache.values());
  }

  public getActiveNiche(): NicheConfig {
    const niche = this.nichesCache.get(this.activeNicheId);
    if (!niche) {
      const fallback = this.nichesCache.values().next().value;
      if (fallback) return fallback;
      throw new Error(`Nenhum nicho configurado encontrado.`);
    }
    return niche;
  }

  public setActiveNiche(id: string): NicheConfig {
    const niche = this.nichesCache.get(id);
    if (!niche) {
      throw new Error(`Nicho '${id}' não encontrado.`);
    }
    this.activeNicheId = id;
    return niche;
  }

  public saveNiche(niche: NicheConfig): NicheConfig {
    if (!niche.id) {
      throw new Error("O campo 'id' do nicho é obrigatório.");
    }
    const filePath = path.join(this.presetsDir, `${niche.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(niche, null, 2), 'utf-8');
    this.nichesCache.set(niche.id, niche);
    return niche;
  }
}

export const nicheService = new NicheService();
