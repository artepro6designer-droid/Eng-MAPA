# Eng.M.A.P.A — Portal do Cliente V5 UX/UI

Projeto completo para VS Code e publicação no GitHub Pages, preservando a identidade visual verde escuro + dourado do Eng.M.A.P.A.

## O que foi melhorado nesta versão

- Cadastro gratuito sem cartão, PIX ou pagamento.
- Fluxo de cadastro: **criar conta → acesso ao portal do cliente**.
- Login por e-mail e senha.
- Recuperação de acesso com interface própria, sem `prompt()` do navegador.
- Mostrar/ocultar senha.
- Área do cliente responsiva para notebook, desktop, tablet, Android e iPhone.
- Propriedades múltiplas por cliente.
- Histórico técnico de serviços com data/hora, status e propriedade.
- Solicitação de novos serviços pelo portal.
- Área administrativa protegida por perfil `admin`.
- Ficha técnica de cada cliente com propriedades, serviços e documentos.
- Upload de CAR, croquis, matrículas/áreas desmembradas, croqui geral, projeto final, memorial e outros arquivos.
- Arquivos associados ao cliente + propriedade + serviço.
- Documentos privados no Supabase Storage.
- Download pelo portal do cliente.
- Cards de estado vazio e mensagens de feedback mais claras.
- Navegação mobile corrigida, com menu acessível e estado ativo da página.
- Responsividade e suporte a `prefers-reduced-motion`.
- Live Server configurado na porta 5501 para reduzir conflito com outros projetos.
- PWA com cache versionado.

## Teste imediato no VS Code

Se `config.js` estiver sem credenciais do Supabase, o projeto entra em **Modo Local de Teste**. Isso permite testar cadastro, login, painel, propriedades, solicitações e administração no próprio computador.

### Conta administrativa local

- E-mail: `admin@engmapa.local`
- Senha: `EngM@2026`

Essa conta existe somente para desenvolvimento local e não deve ser usada em produção.

### Importante sobre sincronização

O modo local **não sincroniza** entre notebook, desktop e celular. Para o comportamento definitivo entre dispositivos, conecte o Supabase.

## Produção com Supabase

1. Crie um projeto no Supabase.
2. Abra o SQL Editor e execute `supabase-schema.sql`.
3. Ative o provedor Email em Authentication > Providers.
4. Para o fluxo de acesso imediato solicitado, desative a confirmação obrigatória de e-mail. Se optar por mantê-la, o cliente deverá confirmar o e-mail antes do primeiro login.
5. Em Authentication > URL Configuration, configure o endereço do GitHub Pages como Site URL e Redirect URL.
6. Em `config.js`, preencha somente a URL do projeto e a chave pública `anon`.
7. Nunca coloque `service_role` no frontend.
8. Depois de criar sua conta administrativa, execute no SQL Editor:

```sql
update public.profiles
set role = 'admin'
where email = 'SEU_EMAIL_ADMIN';
```

## Estrutura de dados

- `profiles`: proprietário/cliente e perfil administrativo.
- `properties`: uma ou várias propriedades do cliente.
- `services`: serviços realizados ou solicitados, com data/hora e status.
- `documents`: arquivos vinculados ao cliente, propriedade e serviço.
- Storage `documentos-clientes`: bucket privado para documentos técnicos.

Para uma propriedade com três áreas desmembradas, por exemplo, cadastre as matrículas/áreas separadamente e anexe cada croqui individual com descrição própria.

## Recuperação de senha

No ambiente de produção, a recuperação atual usa o fluxo seguro de e-mail do Supabase. O código de 8 dígitos pelo WhatsApp solicitado anteriormente deve ser implementado por uma API oficial de WhatsApp via backend/Edge Function, nunca com segredo exposto no JavaScript público.

## Live Server

Abra **a pasta raiz deste projeto** no VS Code e clique com o botão direito em `index.html` → **Open with Live Server**.

A porta definida é `5501`, normalmente resultando em:

`http://127.0.0.1:5501/`

Não abra o `cadastro.html` diretamente pelo Explorer do Windows.

## Arquivos principais

- `index.html` — apresentação e jornada do serviço.
- `cadastro.html` — cadastro gratuito.
- `login.html` — login e recuperação.
- `painel.html` — portal do cliente.
- `admin.html` — gestão interna e ficha técnica.
- `clientes.html` — apresentação institucional.
- `contato.html` — canais de atendimento.
- `app.js` — autenticação, portal, solicitações e administração.
- `style.css` — identidade visual, UX/UI e responsividade.
- `config.js` — conexão com Supabase.
- `supabase-schema.sql` — banco, RLS e Storage.
- `manifest.json` / `sw.js` — PWA.
- `.vscode/settings.json` — Live Server.


## V6 — Portfólio técnico e contatos
- Após login/cadastro, o item “Área do Cliente” passa automaticamente para “Minha Conta”.
- A página “Nossos Clientes” possui tabela de serviços finalizados autorizados para divulgação.
- Cada registro pode apresentar cliente, propriedade, área, matrícula, serviço e data de conclusão.
- No Supabase, a publicação é controlada pelo campo `publicar_portfolio`; somente serviços `Finalizado` e autorizados aparecem publicamente.
- A propriedade agora possui área em hectares.
- O formulário administrativo permite marcar um serviço finalizado para divulgação no portfólio; a caixa fica marcada por padrão, mas a administração pode desmarcar para manter o registro privado.
- Contato possui os dois WhatsApps e abre conversa com a mensagem padrão solicitada.
