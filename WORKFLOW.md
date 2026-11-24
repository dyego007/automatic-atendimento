# 🔄 Fluxo de Trabalho em Equipe (Sincronização Contínua)

Para garantir que o código **nunca quebre** e que ninguém sobrescreva o trabalho do colega, seguimos esta regra estrita em todas as sessões com IA e desenvolvimento manual:

---

## ⚡ Regra de Ouro: Ciclo Puxar ➔ Codificar ➔ Publicar

Toda alteração deve seguir impreterivelmente estes 3 passos:

### 1. ANTES de iniciar qualquer tarefa (Puxar)
Sempre sincronize com o repositório remoto para receber o que o outro colega subiu:
```bash
git pull origin main
```
> ⚠️ **Atenção da IA:** Antes de criar arquivos ou sugerir alterações, verifique e garanta que o repositório local está com o último commit da `main`.

---

### 2. DURANTE o desenvolvimento
- Modifique apenas os arquivos necessários para a tarefa atual.
- Evite refatorar partes do sistema feitas pelo colega sem alinhamento prévio.
- Mantenha os arquivos de configuração e dependências sempre alinhados.

---

### 3. APÓS concluir a tarefa (Publicar Imediatamente)
Nunca deixe alterações locais acumuladas sem enviar para o Git:
```bash
# 1. Verifique se entraram novidades enquanto você codificava
git pull origin main

# 2. Adicione e commite suas mudanças
git add .
git commit -m "feat/fix: descrição clara do que foi feito"

# 3. Publique imediatamente no GitHub
git push origin main
```

---

## 🚫 O que NUNCA fazer
1. **Nunca use `git push --force`**: Isso apaga o trabalho do colega.
2. **Nunca acumule dias ou horas de código sem commitar e dar push**: Pequenos commits frequentes evitam conflitos de merge.
3. **Nunca suba arquivos de ambiente com senhas (`.env`) ou pastas de dependências (`node_modules`)**.
