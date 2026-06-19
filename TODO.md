# TODO — Acompanhamento de Desenvolvimento

## Concluído

- [x] Setup Bun + Hono + Baileys 7.0.0-rc13
- [x] Estrutura multi-tenant (JWT + MariaDB)
- [x] Migrations iniciais (`001_initial.sql`)
- [x] Auth state Baileys persistido no MariaDB
- [x] Connection manager (connect, disconnect, logout, status)
- [x] Envio de mensagens: texto, link, imagem, link-button, bulk
- [x] Recebimento básico de mensagens (salva em `received_messages`)
- [x] Middleware JWT (validação via `token.ts` existente)
- [x] Rotas separadas (`health.routes.ts`, `whatsapp.routes.ts`)
- [x] Utilitários agrupados (`utils/strings.ts`, `utils/phone.ts`, `utils/response.ts`)
- [x] Testes unitários (utils, token, message-sender)
- [x] Testes de integração (auth, validação, health)
- [x] Testes de ação (configuráveis via `.env`)
- [x] Documentação: README.md, AGENTS.md, TODO.md

## Em andamento

_Nenhum item no momento._

## Próximos passos (backlog)

### Alta prioridade

- [ ] Webhook/callback para mensagens recebidas (notificar tenant)
- [ ] Rate limiting por tenant
- [ ] Retry policy configurável para envio em massa
- [ ] Endpoint para obter QR code via polling/SSE

### Média prioridade

- [ ] Suporte a envio de documentos (PDF, etc.)
- [ ] Suporte a envio de áudio e vídeo
- [ ] Suporte a listas (`single_select`)
- [ ] Logs estruturados (JSON) por tenant
- [ ] Métricas de conexão (Prometheus/OpenTelemetry)

### Baixa prioridade

- [ ] Dashboard admin para status de tenants
- [ ] Pairing code como alternativa ao QR
- [ ] Cache de metadados de grupos
- [ ] Docker Compose (app + MariaDB)

## Débitos técnicos

- [ ] Melhorar parser de migrations (suporte a statements complexos)
- [ ] Pool de conexões DB configurável via env
- [ ] Testes E2E com MariaDB em container (CI)
- [ ] Validar compatibilidade do botão de link (cta_url) em contas Business vs pessoal

## Como usar este arquivo

1. Ao iniciar uma tarefa, mova o item para **Em andamento**
2. Ao concluir, marque `[x]` e mova para **Concluído** com data
3. Novas ideias vão para **Próximos passos** com prioridade adequada

## Histórico

| Data | Item |
|------|------|
| 2026-06-19 | Setup inicial completo da API multi-tenant |
