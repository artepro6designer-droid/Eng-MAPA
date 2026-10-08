/*
 * ENG.M.A.P.A — configuração
 *
 * Para produção entre dispositivos, preencha SUPABASE_URL e SUPABASE_ANON_KEY.
 * Enquanto estiverem vazios, o projeto entra automaticamente em MODO LOCAL DE TESTE
 * para que cadastro/login possam ser testados no VS Code sem travar a tela.
 *
 * ATENÇÃO: o modo local NÃO sincroniza entre dispositivos e NÃO deve ser usado
 * como banco de produção. Para publicação definitiva no GitHub, conecte o Supabase.
 */
window.ENGMAPA_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  localMode: true,
  localAdminEmail: "admin@engmapa.local"
};
