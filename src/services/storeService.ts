import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface Store {
  id: string;
  name: string;
  nicheId: string;
  phone?: string;
  createdAt: string;
}

export class StoreService {
  private filePath: string;
  private stores: Map<string, Store> = new Map();
  private activeStoreId: string = 'loja-1';

  constructor() {
    this.filePath = path.resolve(__dirname, '../../src/presets/stores.json');
    this.loadStores();
  }

  public loadStores(): void {
    if (fs.existsSync(this.filePath)) {
      try {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        const list: Store[] = JSON.parse(content);
        this.stores.clear();
        list.forEach(s => this.stores.set(s.id, s));
        if (list.length > 0 && !this.stores.has(this.activeStoreId)) {
          this.activeStoreId = list[0].id;
        }
        return;
      } catch (err) {
        console.error('Erro ao ler stores.json, recriando padrão:', err);
      }
    }

    // Lojas iniciais padrão
    const defaults: Store[] = [
      {
        id: 'loja-1',
        name: 'Clínica OdontoVida (Matriz)',
        nicheId: 'dentista',
        createdAt: new Date().toISOString()
      },
      {
        id: 'loja-2',
        name: 'Disk Bebidas Express',
        nicheId: 'distribuidora',
        createdAt: new Date().toISOString()
      }
    ];

    defaults.forEach(s => this.stores.set(s.id, s));
    this.saveStoresToFile();
  }

  public listStores(): Store[] {
    return Array.from(this.stores.values());
  }

  public getStore(id: string): Store | undefined {
    return this.stores.get(id);
  }

  public getActiveStore(): Store {
    let store = this.stores.get(this.activeStoreId);
    if (!store) {
      store = this.stores.values().next().value;
      if (!store) {
        store = {
          id: 'loja-1',
          name: 'Minha Primeira Loja',
          nicheId: 'dentista',
          createdAt: new Date().toISOString()
        };
        this.stores.set(store.id, store);
        this.saveStoresToFile();
      }
      this.activeStoreId = store.id;
    }
    return store;
  }

  public setActiveStoreId(id: string): Store {
    const store = this.stores.get(id);
    if (!store) {
      throw new Error(`Loja '${id}' não encontrada.`);
    }
    this.activeStoreId = id;
    return store;
  }

  public createStore(data: { name: string; nicheId: string; id?: string }): Store {
    const slug = (data.id || data.name.toLowerCase().replace(/[^a-z0-9]/g, '-')).replace(/-+/g, '-');
    const storeId = this.stores.has(slug) ? `${slug}-${Date.now().toString().slice(-4)}` : slug;

    const newStore: Store = {
      id: storeId,
      name: data.name,
      nicheId: data.nicheId || 'dentista',
      createdAt: new Date().toISOString()
    };

    this.stores.set(newStore.id, newStore);
    this.saveStoresToFile();
    return newStore;
  }

  public deleteStore(id: string): boolean {
    if (this.stores.size <= 1) {
      throw new Error('Você deve manter pelo menos uma loja cadastrada.');
    }
    const deleted = this.stores.delete(id);
    if (deleted) {
      if (this.activeStoreId === id) {
        this.activeStoreId = this.stores.keys().next().value || 'loja-1';
      }
      this.saveStoresToFile();
    }
    return deleted;
  }

  private saveStoresToFile(): void {
    const list = Array.from(this.stores.values());
    fs.writeFileSync(this.filePath, JSON.stringify(list, null, 2), 'utf-8');
  }
}

export const storeService = new StoreService();
