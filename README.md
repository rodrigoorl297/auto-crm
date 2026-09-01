# AutoCRM

CRM web para **estética automotiva** — clientes, ordens de serviço, financeiro, estoque e usuários. Interface responsiva (desktop e celular), tema claro/escuro e dados salvos no navegador (localStorage).

## Como rodar

Requer apenas um servidor HTTP estático (Python, Node ou extensão Live Server).

```bash
cd auto-crm
python -m http.server 8765
```

Abra no navegador: **http://127.0.0.1:8765/index.html**

## Contas de demonstração

| Perfil      | E-mail                    | Senha           |
|-------------|---------------------------|-----------------|
| Admin       | `admin@autocrm.com`       | `admin123`      |
| Atendente   | `atendente@autocrm.com`   | `atendente123`  |
| Financeiro  | `financeiro@autocrm.com`  | `financeiro123` |

Na tela de login, use **Acesso de demonstração** para entrar com um clique.

## Módulos

- **Dashboard** — indicadores, agenda do dia e atalhos
- **Clientes** — cadastro em cards (Bootstrap), veículos e WhatsApp
- **Ordens de Serviço** — quadro kanban (esteira) e lista; arraste para mudar status
- **Financeiro** — receitas, despesas e pagamentos de OS
- **Estoque** — produtos e movimentações
- **Usuários** — gestão de perfis (somente admin)

## Esteira (kanban) — finalizar uma OS

1. Acesse **Ordens de Serviço** → visualização **Quadro**
2. Arraste o card até a coluna **Concluído**, **ou**
3. Na visualização **Lista**, menu (⋯) → **Concluir**

> Concluir o serviço não registra pagamento. Use **Registrar pagamento** ou o módulo **Financeiro**.

**Permissões:** Admin e Atendente podem mudar status. Financeiro vê a esteira e registra pagamentos.

## Estrutura do projeto

```
auto-crm/
├── index.html          # Login
├── dashboard.html
├── clientes.html
├── ordens.html
├── financeiro.html
├── estoque.html
├── usuarios.html
└── assets/
    ├── css/style.css
    └── js/             # db, auth, ui e lógica de cada módulo
```

## Tecnologias

- HTML5, CSS3, JavaScript (vanilla)
- [Bootstrap 5](https://getbootstrap.com/) + [Bootstrap Icons](https://icons.getbootstrap.com/)
- [Chart.js](https://www.chartjs.org/) (dashboard e financeiro)
- Persistência: `localStorage` (sem backend)

## Licença

Uso livre para estudo e adaptação ao seu negócio.
