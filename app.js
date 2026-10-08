/* ENG.M.A.P.A — Portal do Cliente V6
 * Arquitetura híbrida:
 * - Supabase configurado: produção, autenticação e dados em nuvem.
 * - Sem Supabase: modo local de teste para o VS Code, sem bloquear cadastro/login.
 */
(() => {
  const cfg = window.ENGMAPA_CONFIG || {};
  const validUrl = typeof cfg.supabaseUrl === 'string' && /^https:\/\/[^\s]+\.supabase\.co(?:\/.*)?$/.test(cfg.supabaseUrl);
  const validKey = typeof cfg.supabaseAnonKey === 'string' && cfg.supabaseAnonKey.length > 30 && !cfg.supabaseAnonKey.startsWith('COLE_AQUI');
  const cloud = !!(window.supabase && validUrl && validKey);
  const supabaseClient = cloud ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

  const $ = s => document.querySelector(s);
  const clean = v => String(v ?? '').trim();
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function toast(msg, type='info') {
    document.querySelectorAll('.toast').forEach(x => x.remove());
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.setAttribute('role','status');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 5200);
  }
  function go(url){ location.assign(url); }
  function setBusy(form,busy,text='Processando...'){
    const b=form?.querySelector('button[type="submit"]'); if(!b)return;
    if(busy){ b.dataset.originalText=b.innerHTML; b.disabled=true; b.innerHTML=`<i class="fa-solid fa-spinner fa-spin"></i> ${text}`; }
    else { b.disabled=false; b.innerHTML=b.dataset.originalText||'Continuar'; }
  }

  /* ---------- armazenamento local de desenvolvimento ---------- */
  const LS_USERS='engmapa.v4.users';
  const LS_SESSION='engmapa.v4.session';
  const LS_PROPS='engmapa.v4.properties';
  const LS_SERV='engmapa.v4.services';
  const LS_DOCS='engmapa.v4.documents';
  const LS_PUBLIC='engmapa.v4.public_services';
  const read=(k,d=[])=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch{return d}};
  const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const uid=()=>crypto?.randomUUID?.() || ('id-'+Date.now()+'-'+Math.random().toString(16).slice(2));
  const now=()=>new Date().toISOString();
  function localUser(){ const id=localStorage.getItem(LS_SESSION); return read(LS_USERS,[]).find(u=>u.id===id)||null; }
  function localProfile(){ return localUser(); }
  function localSession(){ const u=localUser(); return u?{user:{id:u.id,email:u.email}}:null; }

  function ensureLocalAdmin(){
    const users=read(LS_USERS);
    if(!users.some(u=>u.email===cfg.localAdminEmail)){
      users.push({id:uid(),nome:'Administrador Eng.M.A.P.A',email:cfg.localAdminEmail,telefone:'',documento:'',password:'EngM@2026',role:'admin',created_at:now()});
      write(LS_USERS,users);
    }
  }
  ensureLocalAdmin();

  async function getSession(){
    if(cloud){ const {data}=await supabaseClient.auth.getSession(); return data.session; }
    return localSession();
  }
  async function getProfile(id){
    if(cloud){
      const {data,error}=await supabaseClient.from('profiles').select('*').eq('id',id).single();
      if(error)throw error; return data;
    }
    const u=read(LS_USERS).find(x=>x.id===id); if(!u)throw Error('Perfil não encontrado'); return u;
  }
  async function logout(){
    if(cloud) await supabaseClient.auth.signOut();
    localStorage.removeItem(LS_SESSION); go('login.html');
  }
  window.logout=logout;

  async function submitCadastro(e){
    e.preventDefault();
    const form=e.currentTarget, fd=new FormData(form);
    const nome=clean(fd.get('nome')), email=clean(fd.get('email')).toLowerCase(), telefone=clean(fd.get('telefone'));
    const documento=clean(fd.get('documento')), senha=String(fd.get('senha')||''), propriedade=clean(fd.get('propriedade'));
    const municipio=clean(fd.get('municipio')), matricula=clean(fd.get('matricula')), area=clean(fd.get('area')), servico=clean(fd.get('servico')), detalhes=clean(fd.get('detalhes'));
    if(nome.length<3)return toast('Informe o nome completo do proprietário.','error');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return toast('Informe um e-mail válido.','error');
    if(senha.length<8)return toast('A senha precisa ter pelo menos 8 caracteres.','error');

    setBusy(form,true,'Criando sua conta...');
    if(!cloud){
      const users=read(LS_USERS);
      if(users.some(u=>u.email===email)){setBusy(form,false);return toast('Este e-mail já possui cadastro. Acesse a Área do Cliente ou recupere sua senha.','error');}
      const user={id:uid(),nome,email,telefone,documento,password:senha,role:'cliente',created_at:now()};
      users.push(user); write(LS_USERS,users); localStorage.setItem(LS_SESSION,user.id);
      if(propriedade){
        const props=read(LS_PROPS); const prop={id:uid(),cliente_id:user.id,nome:propriedade,municipio,matricula,area_hectares:area?Number(area):null,created_at:now()}; props.push(prop); write(LS_PROPS,props);
        if(servico){const ss=read(LS_SERV);ss.push({id:uid(),cliente_id:user.id,property_id:prop.id,nome_servico:servico,detalhes,status:'Solicitado',requested_at:now(),updated_at:now()});write(LS_SERV,ss);}
      }
      setBusy(form,false);
      toast('Cadastro concluído. Bem-vindo à Área do Cliente!','success');
      setTimeout(()=>go('painel.html'),500); return;
    }

    const {data,error}=await supabaseClient.auth.signUp({email,password:senha,options:{data:{nome,telefone,documento}}});
    if(error){setBusy(form,false);return toast(/already registered|already been registered/i.test(error.message)?'Este e-mail já possui cadastro. Acesse a Área do Cliente ou recupere sua senha.':error.message,'error');}
    let session=data.session;
    if(!session){const si=await supabaseClient.auth.signInWithPassword({email,password:senha});session=si.data?.session||null;}
    if(!session){setBusy(form,false);return toast('Cadastro criado. Confirme o e-mail antes do primeiro acesso.','info');}
    if(propriedade){
      const {data:p,error:pe}=await supabaseClient.from('properties').insert({cliente_id:session.user.id,nome:propriedade,municipio,matricula,area_hectares:area?Number(area):null}).select().single();
      if(!pe&&p&&servico)await supabaseClient.from('services').insert({cliente_id:session.user.id,property_id:p.id,nome_servico:servico,detalhes,status:'Solicitado'});
    }
    setBusy(form,false); toast('Cadastro concluído. Bem-vindo à Área do Cliente!','success'); setTimeout(()=>go('painel.html'),500);
  }

  async function login(e){
    e.preventDefault(); const form=e.currentTarget,email=clean($('#loginEmail')?.value).toLowerCase(),senha=$('#loginSenha')?.value||'';
    if(!email||!senha)return toast('Informe seu e-mail e sua senha.','error'); setBusy(form,true,'Entrando...');
    if(!cloud){
      const u=read(LS_USERS).find(x=>x.email===email);
      if(!u || !(u.password===senha || u.password===senha)){setBusy(form,false);return toast('E-mail ou senha inválidos.','error');}
      localStorage.setItem(LS_SESSION,u.id); go('painel.html'); return;
    }
    const {data,error}=await supabaseClient.auth.signInWithPassword({email,password:senha});
    if(error||!data.session){setBusy(form,false);return toast('E-mail ou senha inválidos. Se esqueceu sua senha, use a recuperação.','error');}
    go('painel.html');
  }

  async function resetPassword(){
    const email=clean($('#loginEmail')?.value).toLowerCase();
    if(!email)return toast('Informe seu e-mail no campo acima.','error');
    if(!cloud){
      const u=read(LS_USERS).find(x=>x.email===email);
      if(!u)return toast('Não encontramos uma conta com este e-mail.','error');
      $('#localRecoveryBox')?.classList.remove('hidden');
      if($('#localRecoveryEmail')) $('#localRecoveryEmail').value=email;
      $('#localRecoveryPassword')?.focus();
      return;
    }
    const base=new URL('login.html',location.href).href;
    const {error}=await supabaseClient.auth.resetPasswordForEmail(email,{redirectTo:`${base}?reset=1`});
    if(error)return toast('Não foi possível iniciar a recuperação. Verifique o e-mail.','error');
    toast('Enviamos as instruções de recuperação para seu e-mail.','success');
  }

  async function updateLocalPassword(e){
    e?.preventDefault();
    const email=clean($('#localRecoveryEmail')?.value).toLowerCase();
    const nova=$('#localRecoveryPassword')?.value||'', confirmar=$('#localRecoveryConfirm')?.value||'';
    if(nova.length<8)return toast('A nova senha precisa ter pelo menos 8 caracteres.','error');
    if(nova!==confirmar)return toast('As senhas não coincidem.','error');
    const users=read(LS_USERS), user=users.find(x=>x.email===email);
    if(!user)return toast('Não encontramos essa conta.','error');
    user.password=nova;
    write(LS_USERS,users);
    $('#localRecoveryBox')?.classList.add('hidden');
    toast('Senha atualizada. Agora você já pode entrar.','success');
  }

  async function updatePassword(){
    if(!cloud)return toast('No modo local, use “Esqueci minha senha” na tela de login.','info');
    const senha=$('#novaSenha')?.value||'',confirm=$('#confirmaSenha')?.value||'';
    if(senha.length<8)return toast('A nova senha precisa ter pelo menos 8 caracteres.','error');
    if(senha!==confirm)return toast('As senhas não coincidem.','error');
    const {error}=await supabaseClient.auth.updateUser({password:senha});
    if(error)return toast(error.message,'error'); toast('Senha atualizada com sucesso.','success'); setTimeout(()=>go('painel.html'),800);
  }

  function togglePassword(id,btn){
    const el=document.getElementById(id); if(!el)return; const visible=el.type==='password'; el.type=visible?'text':'password';
    btn.setAttribute('aria-label',visible?'Ocultar senha':'Mostrar senha'); btn.innerHTML=visible?'<i class="fa-solid fa-eye-slash"></i>':'<i class="fa-solid fa-eye"></i>';
  }
  window.togglePassword=togglePassword;

  async function loadPainel(){
    const s=await getSession(); if(!s)return go('login.html');
    const profile=await getProfile(s.user.id).catch(()=>null); if(!profile)return toast('Não foi possível carregar seus dados.','error');
    $('#clienteNome').textContent=profile.nome||'Cliente'; $('#clienteEmail').textContent=profile.email||s.user.email||'';
    if(profile.role==='admin')$('#adminLink').hidden=false;
    let props=[],services=[],docs=[];
    if(cloud){
      [{data:props},{data:services},{data:docs}]=await Promise.all([
        supabaseClient.from('properties').select('*').eq('cliente_id',s.user.id).order('created_at',{ascending:false}),
        supabaseClient.from('services').select('*, properties(nome,municipio,matricula)').eq('cliente_id',s.user.id).order('requested_at',{ascending:false}),
        supabaseClient.from('documents').select('*, properties(nome,matricula), services(nome_servico)').eq('cliente_id',s.user.id).order('uploaded_at',{ascending:false})
      ]);
    }else{
      props=read(LS_PROPS).filter(x=>x.cliente_id===s.user.id);
      services=read(LS_SERV).filter(x=>x.cliente_id===s.user.id).map(x=>({...x,properties:props.find(p=>p.id===x.property_id)}));
      docs=read(LS_DOCS).filter(x=>x.cliente_id===s.user.id);
    }
    renderClient(props||[],services||[],docs||[]);
  }

  function renderClient(props,services,docs){
    $('#listaPropriedades').innerHTML=props.length?props.map(p=>`<article class="mini-card"><span class="card-eyebrow">PROPRIEDADE</span><h3>${esc(p.nome)}</h3><p>${esc(p.municipio||'Município não informado')}</p><small>Matrícula: ${esc(p.matricula||'Não informada')}</small></article>`).join(''):'<p class="muted">Nenhuma propriedade cadastrada.</p>';
    $('#listaServicos').innerHTML=services.length?services.map(s=>`<article class="service-history"><div><span class="badge">${esc(s.status)}</span><h3>${esc(s.nome_servico)}</h3><p>Propriedade: <strong>${esc(s.properties?.nome||'Não vinculada')}</strong></p><p>${esc(s.detalhes||'Sem observações.')}</p></div><time>${new Date(s.requested_at).toLocaleString('pt-BR')}</time></article>`).join(''):'<p class="muted">Nenhum serviço registrado.</p>';
    $('#listaDocumentos').innerHTML=docs.length?docs.map(d=>`<article class="document-card"><div class="doc-icon">${d.mime_type==='application/pdf'?'PDF':'IMG'}</div><div class="doc-body"><span class="card-eyebrow">${esc(d.categoria)}</span><h3>${esc(d.descricao||d.categoria)}</h3><p>${esc(d.properties?.nome||'')}</p><small>${esc(d.file_name)}</small></div><div class="doc-actions"><button class="btn-outline small" onclick="viewDoc('${d.id}')"><i class="fa-solid fa-eye"></i> Visualizar</button><button class="btn-outline small" onclick="downloadDoc('${d.id}')"><i class="fa-solid fa-download"></i> Baixar</button></div></article>`).join(''):'<p class="muted">Seus projetos e documentos aparecerão aqui quando nossa equipe anexá-los.</p>';
  }

  async function downloadDoc(id){
    if(cloud){
      const {data,error}=await supabaseClient.from('documents').select('storage_path,file_name').eq('id',id).single(); if(error)return toast('Não foi possível localizar o arquivo.','error');
      const {data:u,error:ue}=await supabaseClient.storage.from('documentos-clientes').createSignedUrl(data.storage_path,300); if(ue)return toast('Não foi possível gerar o acesso ao arquivo.','error');
      const a=document.createElement('a');a.href=u.signedUrl;a.target='_blank';a.rel='noopener';a.download=data.file_name;a.click();return;
    }
    const d=read(LS_DOCS).find(x=>x.id===id); if(!d?.dataUrl)return toast('Arquivo local não encontrado.','error');
    const a=document.createElement('a');a.href=d.dataUrl;a.download=d.file_name;a.click();
  }
  window.downloadDoc=downloadDoc;
  async function viewDoc(id){
    if(cloud){ const r=await supabaseClient.from('documents').select('storage_path').eq('id',id).single(); if(r.error)return toast('Não foi possível localizar o arquivo.','error'); const u=await supabaseClient.storage.from('documentos-clientes').createSignedUrl(r.data.storage_path,300); if(u.error)return toast('Não foi possível abrir o arquivo.','error'); window.open(u.data.signedUrl,'_blank','noopener'); return; }
    const d=read(LS_DOCS).find(x=>x.id===id); if(!d?.dataUrl)return toast('Arquivo local não encontrado.','error'); window.open(d.dataUrl,'_blank','noopener');
  }
  window.viewDoc=viewDoc;

  async function requestService(e){
    e.preventDefault(); const s=await getSession(); if(!s)return go('login.html');
    const nome=clean($('#novoServico')?.value),detalhes=clean($('#novoServicoDetalhes')?.value),propertyId=$('#novoServicoPropriedade')?.value||null;
    if(!nome)return toast('Escolha o serviço desejado.','error');
    if(cloud)await supabaseClient.from('services').insert({cliente_id:s.user.id,property_id:propertyId,nome_servico:nome,detalhes,status:'Solicitado'});
    else{const a=read(LS_SERV);a.push({id:uid(),cliente_id:s.user.id,property_id:propertyId,nome_servico:nome,detalhes,status:'Solicitado',requested_at:now(),updated_at:now()});write(LS_SERV,a);}
    toast('Solicitação registrada com sucesso.','success'); e.currentTarget.reset(); loadPainel();
  }
  window.requestService=requestService;

  async function populateClientProperties(){
    const s=await getSession();if(!s)return;
    let data=[];
    if(cloud){const r=await supabaseClient.from('properties').select('id,nome,matricula').eq('cliente_id',s.user.id).order('nome');data=r.data||[];}
    else data=read(LS_PROPS).filter(x=>x.cliente_id===s.user.id);
    $('#novoServicoPropriedade').innerHTML='<option value="">Selecione uma propriedade</option>'+data.map(p=>`<option value="${p.id}">${esc(p.nome)}${p.matricula?' — '+esc(p.matricula):''}</option>`).join('');
  }

  async function adminInit(){
    const s=await getSession();if(!s)return go('login.html');const me=await getProfile(s.user.id).catch(()=>null);
    if(!me||me.role!=='admin')return go('painel.html');
    if(cloud){
      const {data,error}=await supabaseClient.from('profiles').select('*').eq('role','cliente').order('nome');if(error)return toast('Não foi possível carregar os clientes.','error');
      $('#adminClients').innerHTML=(data||[]).map(c=>`<option value="${c.id}">${esc(c.nome)} — ${esc(c.email)}</option>`).join('');
    }else{
      const data=read(LS_USERS).filter(c=>c.role==='cliente');$('#adminClients').innerHTML=data.map(c=>`<option value="${c.id}">${esc(c.nome)} — ${esc(c.email)}</option>`).join('');
    }
    if(cloud){
      const [pc,sc,dc]=await Promise.all([supabaseClient.from('properties').select('id',{count:'exact',head:true}),supabaseClient.from('services').select('id',{count:'exact',head:true}),supabaseClient.from('documents').select('id',{count:'exact',head:true})]);
      $('#adminStatClientes').textContent=(await supabaseClient.from('profiles').select('id',{count:'exact',head:true}).eq('role','cliente')).count||0;
      $('#adminStatPropriedades').textContent=pc.count||0; $('#adminStatServicos').textContent=sc.count||0; $('#adminStatDocumentos').textContent=dc.count||0;
    }
    await adminLoadClient();
  }
  async function adminLoadClient(){
    const id=$('#adminClients')?.value;if(!id)return;
    let props=[],services=[];
    if(cloud){
      [{data:props},{data:services}]=await Promise.all([supabaseClient.from('properties').select('*').eq('cliente_id',id).order('nome'),supabaseClient.from('services').select('*, properties(nome)').eq('cliente_id',id).order('requested_at',{ascending:false})]);
    }else{props=read(LS_PROPS).filter(x=>x.cliente_id===id);services=read(LS_SERV).filter(x=>x.cliente_id===id).map(x=>({...x,properties:props.find(p=>p.id===x.property_id)}));}
    $('#adminProperties').innerHTML='<option value="">Sem propriedade</option>'+props.map(p=>`<option value="${p.id}">${esc(p.nome)}${p.matricula?' — matrícula '+esc(p.matricula):''}</option>`).join('');
    $('#adminServices').innerHTML='<option value="">Sem serviço</option>'+services.map(s=>`<option value="${s.id}">${esc(s.nome_servico)} — ${esc(s.properties?.nome||'')}</option>`).join('');
    $('#adminClientId').value=id;
    const dossier=$('#adminClientDossier');
    if(dossier){
      let client=null, docs=[];
      if(cloud){ const r=await supabaseClient.from('profiles').select('*').eq('id',id).single(); client=r.data; const d=await supabaseClient.from('documents').select('id,categoria,descricao,file_name').eq('cliente_id',id).order('uploaded_at',{ascending:false}); docs=d.data||[]; }
      else { client=read(LS_USERS).find(u=>u.id===id); docs=read(LS_DOCS).filter(d=>d.cliente_id===id); }
      dossier.innerHTML=`<div class="dossier-head"><div><span class="section-kicker">FICHA TÉCNICA</span><h3>${esc(client?.nome||'Cliente selecionado')}</h3><p>${esc(client?.email||'')} ${client?.telefone?'· '+esc(client.telefone):''}</p></div><span class="badge">${props.length} propriedade(s) · ${services.length} serviço(s) · ${docs.length} documento(s)</span></div><div class="dossier-grid"><div><strong>Propriedades</strong>${props.length?'<ul>'+props.map(p=>`<li>${esc(p.nome)} <small>${esc(p.matricula||'sem matrícula')} · ${p.area_hectares!=null?esc(Number(p.area_hectares).toLocaleString('pt-BR',{maximumFractionDigits:2})+' ha'):'área não informada'} · ${esc(p.municipio||'município não informado')}</small></li>`).join('')+'</ul>':'<p class="muted">Nenhuma registrada.</p>'}</div><div><strong>Serviços</strong>${services.length?'<ul>'+services.slice(0,6).map(x=>`<li><span class="badge">${esc(x.status)}</span> ${esc(x.nome_servico)} <small>${new Date(x.requested_at).toLocaleString('pt-BR')}</small></li>`).join('')+'</ul>':'<p class="muted">Nenhum registrado.</p>'}</div><div><strong>Documentos</strong>${docs.length?'<ul>'+docs.slice(0,6).map(d=>`<li>${esc(d.categoria)} <small>${esc(d.descricao||d.file_name)}</small></li>`).join('')+'</ul>':'<p class="muted">Nenhum anexado.</p>'}</div></div>`;
    }
  }
  async function adminAddProperty(e){
    e.preventDefault();const id=$('#adminClients').value,nome=clean($('#propNome').value),area=clean($('#propArea').value);if(!nome)return toast('Informe o nome da propriedade.','error');
    if(cloud)await supabaseClient.from('properties').insert({cliente_id:id,nome,municipio:clean($('#propMunicipio').value),matricula:clean($('#propMatricula').value),area_hectares:area?Number(area):null});
    else{const a=read(LS_PROPS);a.push({id:uid(),cliente_id:id,nome,municipio:clean($('#propMunicipio').value),matricula:clean($('#propMatricula').value),area_hectares:area?Number(area):null,created_at:now()});write(LS_PROPS,a);}
    toast('Propriedade adicionada.','success');e.currentTarget.reset();adminLoadClient();
  }
  async function adminAddService(e){
    e.preventDefault();const id=$('#adminClients').value,nome=clean($('#servNome').value),status=clean($('#servStatus').value),publicar=!!$('#servPublicar')?.checked;const completedAt=status==='Finalizado'?now():null;if(!nome)return toast('Informe o serviço.','error');
    if(cloud){const r=await supabaseClient.from('services').insert({cliente_id:id,property_id:$('#adminProperties').value||null,nome_servico:nome,detalhes:clean($('#servDetalhes').value),status,publicar_portfolio:publicar,completed_at:completedAt}).select().single();if(r.error)return toast(r.error.message,'error');}
    else{const a=read(LS_SERV);const item={id:uid(),cliente_id:id,property_id:$('#adminProperties').value||null,nome_servico:nome,detalhes:clean($('#servDetalhes').value),status,publicar_portfolio:publicar,completed_at:completedAt,requested_at:now(),updated_at:now()};a.push(item);write(LS_SERV,a);if(publicar&&status==='Finalizado'){const pub=read(LS_PUBLIC);if(!pub.includes(item.id)){pub.push(item.id);write(LS_PUBLIC,pub);}}}
    toast(status==='Finalizado'&&publicar?'Serviço finalizado e publicado em Nossos Clientes.':'Serviço registrado.','success');e.currentTarget.reset();adminLoadClient();
  }
  async function adminUpload(e){
    e.preventDefault();const file=$('#arquivo').files[0],client=$('#adminClients').value;if(!file)return toast('Selecione um arquivo.','error');
    if(!['application/pdf','image/png','image/jpeg'].includes(file.type))return toast('Formatos permitidos: PDF, PNG e JPG.','error');
    if(file.size>25*1024*1024)return toast('O arquivo deve ter no máximo 25 MB.','error');
    if(!cloud){
      const reader=new FileReader();reader.onload=()=>{const a=read(LS_DOCS);a.push({id:uid(),cliente_id:client,property_id:$('#adminProperties').value||null,service_id:$('#adminServices').value||null,categoria:$('#docCategoria').value,descricao:clean($('#docDescricao').value),file_name:file.name,mime_type:file.type,size_bytes:file.size,dataUrl:reader.result,uploaded_at:now()});write(LS_DOCS,a);toast('Documento anexado no modo local de teste.','success');e.currentTarget.reset();};reader.readAsDataURL(file);return;
    }
    const safeName=file.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\w.\-]+/g,'_'),path=`${client}/${crypto.randomUUID()}-${safeName}`;
    const {error:up}=await supabaseClient.storage.from('documentos-clientes').upload(path,file,{contentType:file.type,upsert:false});if(up)return toast(up.message,'error');
    const {error}=await supabaseClient.from('documents').insert({cliente_id:client,property_id:$('#adminProperties').value||null,service_id:$('#adminServices').value||null,categoria:$('#docCategoria').value,descricao:clean($('#docDescricao').value),file_name:file.name,storage_path:path,mime_type:file.type,size_bytes:file.size});
    if(error){await supabaseClient.storage.from('documentos-clientes').remove([path]);return toast(error.message,'error');}
    toast('Documento anexado com segurança.','success');e.currentTarget.reset();
  }

  async function syncAuthNavigation(){
    const link=document.querySelector('.nav-menu a[href="login.html"]');
    if(!link)return;
    const s=await getSession().catch(()=>null);
    if(s){
      link.href='painel.html';
      link.innerHTML='<i class="fa-solid fa-user-circle"></i> Minha Conta';
      link.setAttribute('aria-label','Abrir minha conta');
      document.querySelector('.login-link')?.classList.add('hidden');
    }else{
      link.href='login.html';
      link.innerHTML='<i class="fa-solid fa-right-to-bracket"></i> Área do Cliente';
      link.removeAttribute('aria-label');
      document.querySelector('.login-link')?.classList.remove('hidden');
    }
  }

  async function loadPublicClients(){
    const target=$('#tabelaClientes'); if(!target)return;
    let rows=[];
    if(cloud){
      const {data,error}=await supabaseClient.from('clientes_servicos_finalizados').select('*').order('finalizado_em',{ascending:false});
      if(error){ target.innerHTML='<tr><td colspan="7"><div class="empty-state"><i class="fa-solid fa-circle-info"></i><strong>O portfólio ainda não possui serviços publicados.</strong><span>Os registros precisam ser autorizados pela administração.</span></div></td></tr>'; return; }
      rows=data||[];
    }else{
      const users=read(LS_USERS).filter(u=>u.role==='cliente');
      const props=read(LS_PROPS), services=read(LS_SERV);
      rows=services.filter(x=>x.status==='Finalizado' && x.publicar_portfolio===true).map(x=>{const u=users.find(y=>y.id===x.cliente_id),p=props.find(y=>y.id===x.property_id);return {...x,nome_cliente:u?.nome||'Cliente',nome_propriedade:p?.nome||'Não informada',area_hectares:p?.area_hectares,matricula:p?.matricula,finalizado_em:x.completed_at||x.updated_at||x.requested_at};}).filter(x=>read(LS_PUBLIC).length===0 || read(LS_PUBLIC).includes(x.id));
    }
    target.innerHTML=rows.length?rows.map(r=>`<tr><td><strong>${esc(r.nome_cliente||r.cliente_nome||'Cliente')}</strong></td><td>${esc(r.nome_propriedade||r.propriedade_nome||'Não informada')}</td><td>${r.area_hectares!=null&&r.area_hectares!==''?esc(Number(r.area_hectares).toLocaleString('pt-BR',{maximumFractionDigits:2})+' ha'):'—'}</td><td>${esc(r.matricula||'—')}</td><td><span class="badge">${esc(r.nome_servico||'Serviço finalizado')}</span></td><td>${esc(r.detalhes||'Conclusão registrada pela equipe técnica')}</td><td>${r.finalizado_em?new Date(r.finalizado_em).toLocaleDateString('pt-BR'):'—'}</td></tr>`).join(''):'<tr><td colspan="7"><div class="empty-state"><i class="fa-solid fa-folder-open"></i><strong>Nenhum serviço finalizado publicado ainda.</strong><span>Quando a administração autorizar um projeto concluído, ele aparecerá aqui.</span></div></td></tr>';
  }

  window.submitCadastro=submitCadastro;window.login=login;window.resetPassword=resetPassword;window.updateLocalPassword=updateLocalPassword;window.updatePassword=updatePassword;
  window.adminInit=adminInit;window.adminLoadClient=adminLoadClient;window.adminAddProperty=adminAddProperty;window.adminAddService=adminAddService;window.adminUpload=adminUpload;

  document.addEventListener('DOMContentLoaded',async()=>{
    if(location.pathname.endsWith('painel.html'))await loadPainel();
    if(location.pathname.endsWith('admin.html'))await adminInit();
    if(location.pathname.endsWith('clientes.html'))await loadPublicClients();
    await syncAuthNavigation();
    $('#formCadastro')?.addEventListener('submit',submitCadastro);
    $('#formLogin')?.addEventListener('submit',login);
    $('#formNovaSenha')?.addEventListener('submit',e=>{e.preventDefault();updatePassword();});
    $('#formPropriedade')?.addEventListener('submit',adminAddProperty);
    $('#formServico')?.addEventListener('submit',adminAddService);
    $('#formDocumento')?.addEventListener('submit',adminUpload);
    $('#formNovoServico')?.addEventListener('submit',requestService);
    $('#adminClients')?.addEventListener('change',adminLoadClient);
    $('#novoServicoPropriedade')?.addEventListener('focus',populateClientProperties,{once:true});
  });
})();