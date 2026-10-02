# Grupo Solutions — Gestão de Frota e Controle de Veículos

Sistema web completo, moderno e responsivo para organização e controle de frota veicular, saídas/retornos, quilometragem e acompanhamento de revisões preventivas com sincronização direta com o GitHub.

## 🚀 Como Abrir e Usar

1. **Abra com 1 clique**: Dê dois cliques no arquivo **`ABRIR_SITE.bat`**.
2. O sistema iniciará o servidor local e abrirá automaticamente o seu navegador em `http://localhost:3000`.
3. Todas as alterações que você fizer (cadastrar veículo, editar quilometragem, registrar viagem, etc.) podem ser enviadas diretamente para o repositório GitHub com um clique no botão **`🚀 Subir para o GitHub`** no topo da página.

---

## ✨ Principais Funcionalidades

### 1. Veículos da Frota
- Cadastro e edição completa de qualquer veículo (próprio ou alugado).
- Visualização de placas estilizadas no padrão brasileiro Mercosul.
- Busca em tempo real por placa, modelo ou condutor.
- Filtros por tipo (próprio / alugado) e status de revisão.
- Exclusão com verificação de histórico vinculado.

### 2. Saída e Retorno (Utilização)
- Registro ágil de utilização: ao selecionar o veículo, o **KM de saída** é preenchido automaticamente com o KM atual do veículo e o condutor padrão é selecionado.
- Botão "Hoje" para data e "Agora" para horários.
- Cálculo automático da quilometragem rodada e alerta caso o KM de chegada seja inconsistente.
- Atualização em tempo real do odômetro do veículo e dos alertas de revisão.

### 3. Revisões e Alertas
- Comparativo contínuo entre o KM atual e o KM da próxima revisão.
- Indicador visual de progresso e badges de status:
  - **EM DIA** (Verde)
  - **PERTO DA REVISÃO** (Amarelo - faltando menos de 1.000 km)
  - **REVISÃO VENCIDA** (Vermelho)
- Botão rápido **`✅ Feita (+10k)`** para registrar a revisão concluída e avançar o odômetro da revisão com apenas 1 clique.

### 4. Pastas Digitais por Veículo
- Ficha técnica completa de cada carro da frota.
- Tabela exclusiva de todas as viagens já realizadas por aquele veículo e soma total de quilômetros rodados.
- Botão para impressão da pasta do veículo.

### 5. Histórico e Relatórios
- Listagem completa com filtros por período e condutor.
- Edição e exclusão de viagens passadas.
- Botão para **Exportar em CSV (Excel)** e **Imprimir**.

### 6. Sincronização Direta com o GitHub
- **Envio pelo próprio site**: Botão no topo e na aba "GitHub e Backup" para subir commits e push diretamente para o repositório `https://github.com/italogh77/site-do-bn`.
- **Auto-push opcional**: Opção de salvar e sincronizar automaticamente no GitHub a cada ação no site.
- Suporte a token PAT para acesso remoto ou celular.
- Exportação e importação de backups em formato JSON.

---

## 🛠️ Estrutura do Projeto

- **`index.html`**: Interface do usuário e aplicativo principal.
- **`controle_veiculos_prototipo_v5.html`**: Versão mantida sincronizada para compatibilidade.
- **`dados.json`**: Base de dados da frota e registros em formato JSON.
- **`server.js`**: Servidor local nativo em Node.js com endpoints de API para salvar e executar `git push`/`git pull`.
- **`ABRIR_SITE.bat`**: Atalho para iniciar o servidor e abrir no navegador.
- **`SINCRONIZAR_GITHUB.bat`**: Atalho alternativo para sincronização rápida pelo terminal.
