import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { getDatabase } from '../db/database';
import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabase';
import { AUTH } from '../config';
import { AuthenticatedRequest, requireAuth, requirePerfil, logAuditAction } from '../middleware/auth';

const router = Router();

// ============================================================
// HELPERS DE ISOLAMENTO MULTI-TENANT (RBAC + CNPJ SCOPING)
// ============================================================

/** Perfis que podem gerenciar usuários e colaboradores */
const PERFIS_GESTAO_USUARIOS = ['admin_master', 'suporte_ti', 'contador_gestor'];

/** Perfis privilegiados que suporte_ti e contador_gestor NÃO podem criar/atribuir/editar */
const PERFIS_PRIVILEGIADOS = ['admin_master', 'suporte_ti'];

/**
 * Retorna o Set normalizado de CNPJs (apenas dígitos) vinculados a um usuário.
 * Consulta a tabela usuario_empresa para obter os CNPJs reais.
 */
function getUserCnpjSet(userId: string): Set<string> {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT e.cnpj_completo
    FROM usuario_empresa ue
    JOIN empresas e ON e.id = ue.empresa_id
    WHERE ue.usuario_id = ?
  `).all(userId) as any[];
  return new Set(rows.map(r => (r.cnpj_completo || '').replace(/\D/g, '')).filter(Boolean));
}

/**
 * Verifica se dois conjuntos de CNPJs possuem interseção (compartilham empresa).
 */
function hasCnpjIntersection(setA: Set<string>, setB: Set<string>): boolean {
  for (const cnpj of setA) {
    if (setB.has(cnpj)) return true;
  }
  return false;
}

/**
 * Verifica se o solicitante tem permissão de escopo sobre o usuário alvo.
 * admin_master: acesso irrestrito.
 * suporte_ti / contador_gestor:
 * - O próprio usuário logado;
 * - Se o alvo foi criado pelo solicitante (criado_por);
 * - Ou se compartilham pelo menos 1 CNPJ.
 */
/**
 * Localiza usuário no SQLite ou no Supabase (se configurado) e garante sincronização
 */
async function getTargetUser(db: any, id: string): Promise<any> {
  let targetUser: any = null;
  try {
    targetUser = db.prepare('SELECT id, nome, email, perfil, status, criado_por FROM usuarios WHERE id = ?').get(id);
  } catch {
    targetUser = db.prepare('SELECT id, nome, email, perfil, status FROM usuarios WHERE id = ?').get(id);
  }

  if (!targetUser && isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const { data: supaUser } = await supabase
          .from('usuarios')
          .select('id, nome, email, perfil, status, criado_por')
          .eq('id', id)
          .maybeSingle();

        if (supaUser) {
          targetUser = supaUser;
          try {
            db.prepare(`
              INSERT OR IGNORE INTO usuarios (id, nome, email, senha_hash, perfil, status, criado_por)
              VALUES (?, ?, ?, 'SYNC_SUPABASE', ?, ?, ?)
            `).run(
              supaUser.id,
              supaUser.nome || supaUser.email.split('@')[0],
              supaUser.email,
              supaUser.perfil || 'analista_fiscal',
              supaUser.status || 'ativo',
              supaUser.criado_por || null
            );
          } catch {}
        }
      } catch (err) {
        console.warn('⚠️ Falha ao buscar usuário no Supabase:', err);
      }
    }
  }

  return targetUser;
}

async function hasUserScopeAccess(req: AuthenticatedRequest, targetUserId: string, preloadedUser?: any): Promise<boolean> {
  if (!req.user) return false;
  if (req.user.perfil === 'admin_master') return true;
  if (req.user.userId === targetUserId) return true;
  if (!PERFIS_GESTAO_USUARIOS.includes(req.user.perfil)) return false;

  const db = getDatabase();
  const targetUser = preloadedUser || await getTargetUser(db, targetUserId);
  if (!targetUser) return false;

  // Nunca permite suporte_ti ou contador_gestor alterarem admin_master
  if (targetUser.perfil === 'admin_master') return false;

  // contador_gestor não pode alterar suporte_ti
  if (req.user.perfil === 'contador_gestor' && targetUser.perfil === 'suporte_ti') return false;

  // Se foi criado pelo próprio usuário logado
  if (targetUser.criado_por && targetUser.criado_por === req.user.userId) return true;

  // Verifica interseção de empresas da carteira
  const callerCnpjs = getUserCnpjSet(req.user.userId);
  const targetCnpjs = getUserCnpjSet(targetUserId);
  return hasCnpjIntersection(callerCnpjs, targetCnpjs);
}

// ============================================================
// GET /api/users — Listar usuários com isolamento por CNPJ
// ============================================================
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const callerPerfil = req.user?.perfil;
    const callerUserId = req.user?.userId;

    // ── GATE: Apenas admin_master e suporte_ti podem listar usuários ──
    if (!PERFIS_GESTAO_USUARIOS.includes(callerPerfil || '')) {
      return res.json({ success: true, data: [] });
    }

    const db = getDatabase();
    let formatted: any[] = [];

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        try {
          const { data: supaUsers, error: uErr } = await supabase
            .from('usuarios')
            .select('*')
            .order('created_at', { ascending: false });

          if (!uErr && supaUsers && supaUsers.length > 0) {
            const { data: supaVinculos } = await supabase
              .from('usuario_empresa')
              .select('usuario_id, empresa_id, permissao, modulos_permitidos');

            const { data: supaEmpresas } = await supabase
              .from('empresas')
              .select('id, cnpj_completo, razao_social');

            const empMap = new Map((supaEmpresas || []).map(e => [e.id, e.cnpj_completo]));

            formatted = supaUsers.map(u => {
              const uVincs = (supaVinculos || []).filter(v => v.usuario_id === u.id);
              let cnpjsAutorizados: string[] = [];

              const empresasVinculadas = uVincs.map(v => {
                const emp = (supaEmpresas || []).find(e => e.id === v.empresa_id);
                return {
                  empresaId: v.empresa_id,
                  cnpjCompleto: emp?.cnpj_completo || v.empresa_id,
                  razaoSocial: emp?.razao_social || 'Empresa',
                  permissao: v.permissao || 'total',
                  modulosPermitidos: v.modulos_permitidos || '*'
                };
              });

              if (u.perfil === 'admin_master' && uVincs.length === 0) {
                cnpjsAutorizados = ['*'];
              } else if (uVincs.length > 0) {
                cnpjsAutorizados = uVincs.map(v => empMap.get(v.empresa_id) || v.empresa_id).filter(Boolean);
                if (supaEmpresas && supaEmpresas.length > 0 && cnpjsAutorizados.length === supaEmpresas.length && u.perfil === 'admin_master') {
                  cnpjsAutorizados = ['*'];
                }
              } else {
                cnpjsAutorizados = u.perfil === 'admin_master' ? ['*'] : [];
              }

              // Auto-sincronizar usuário ao SQLite local para consistência híbrida
              try {
                db.prepare(`
                  INSERT OR IGNORE INTO usuarios (id, nome, email, senha_hash, perfil, status, criado_por)
                  VALUES (?, ?, ?, 'SYNC_SUPABASE', ?, ?, ?)
                `).run(
                  u.id,
                  u.nome || u.email.split('@')[0],
                  u.email,
                  u.perfil || 'analista_fiscal',
                  u.status || 'ativo',
                  u.criado_por || null
                );
              } catch {}

              return {
                id: u.id,
                nome: u.nome,
                email: u.email,
                perfil: u.perfil,
                grupoContabil: 'Carteira Geral',
                cnpjsAutorizados,
                empresasVinculadas,
                modulosPermitidos: uVincs[0]?.modulos_permitidos || '*',
                permissao: uVincs[0]?.permissao || 'total',
                mfaHabilitado: Boolean(u.mfa_habilitado),
                status: u.status || 'ativo',
                ultimoAcesso: u.ultimo_acesso || 'Nunca',
                createdAt: u.created_at
              };
            });

            // ── Aplicar isolamento de tenant ──
            formatted = applyTenantIsolation(formatted, callerPerfil!, callerUserId!);

            return res.json({ success: true, data: formatted });
          }
        } catch (supaErr: any) {
          console.warn('⚠️ Erro ao listar usuários do Supabase, tentando SQLite:', supaErr?.message);
        }
      }
    }

    // Fallback SQLite
    let users: any[] = [];
    try {
      users = db.prepare(`
        SELECT id, nome, email, perfil, mfa_habilitado, status, ultimo_acesso, criado_por, created_at
        FROM usuarios 
        ORDER BY created_at DESC
      `).all() as any[];
    } catch {
      users = db.prepare(`
        SELECT id, nome, email, perfil, mfa_habilitado, status, ultimo_acesso, created_at
        FROM usuarios 
        ORDER BY created_at DESC
      `).all() as any[];
    }

    const vinculosStmt = db.prepare(`
      SELECT ue.usuario_id, ue.empresa_id, ue.permissao, ue.modulos_permitidos, e.cnpj_completo, e.razao_social
      FROM usuario_empresa ue
      JOIN empresas e ON e.id = ue.empresa_id
    `);
    const allVinculos = vinculosStmt.all() as any[];

    formatted = users.map((u: any) => {
      const userVinculos = allVinculos.filter((v: any) => v.usuario_id === u.id);
      let cnpjsAutorizados: string[] = [];
      let empresasVinculadas: any[] = [];
      if (userVinculos.length > 0) {
        cnpjsAutorizados = userVinculos.map((v: any) => v.cnpj_completo);
        empresasVinculadas = userVinculos.map((v: any) => ({
          empresaId: v.empresa_id,
          cnpjCompleto: v.cnpj_completo,
          razaoSocial: v.razao_social,
          permissao: v.permissao || 'total',
          modulosPermitidos: v.modulos_permitidos || '*'
        }));
      } else if (u.perfil === 'admin_master') {
        cnpjsAutorizados = ['*'];
      }

      return {
        id: u.id,
        nome: u.nome,
        email: u.email,
        perfil: u.perfil,
        grupoContabil: 'Carteira Geral',
        cnpjsAutorizados,
        empresasVinculadas,
        modulosPermitidos: userVinculos[0]?.modulos_permitidos || '*',
        criadoPor: u.criado_por || null,
        mfaHabilitado: Boolean(u.mfa_habilitado),
        status: u.status,
        ultimoAcesso: u.ultimo_acesso || 'Nunca',
        createdAt: u.created_at
      };
    });

    // ── Aplicar isolamento de tenant ──
    formatted = applyTenantIsolation(formatted, callerPerfil!, callerUserId!);

    return res.json({ success: true, data: formatted });
  } catch (err: any) {
    console.error('❌ Erro ao listar usuários:', err.message);
    return res.status(500).json({ success: false, message: 'Erro ao listar usuários: ' + err.message });
  }
});

/**
 * Filtra a lista de usuários com base no perfil e escopo CNPJ do solicitante.
 * - admin_master: vê todos.
 * - suporte_ti / contador_gestor: vê colaboradores da sua carteira ou criados por si.
 */
function applyTenantIsolation(users: any[], callerPerfil: string, callerUserId: string): any[] {
  // admin_master vê tudo
  if (callerPerfil === 'admin_master') return users;

  // suporte_ti ou contador_gestor: filtrar por escopo de CNPJ ou autoria
  if (callerPerfil === 'suporte_ti' || callerPerfil === 'contador_gestor') {
    const callerCnpjs = getUserCnpjSet(callerUserId);

    return users.filter(u => {
      // 1. NUNCA exibir admin_master para suporte_ti / contador_gestor
      if (u.perfil === 'admin_master') return false;

      // 2. Para contador_gestor, também nunca exibir suporte_ti
      if (callerPerfil === 'contador_gestor' && u.perfil === 'suporte_ti') return false;

      // 3. O próprio usuário logado sempre aparece
      if (u.id === callerUserId) return true;

      // 4. Se o usuário foi criado por este gestor, sempre exibe (mesmo com 0 CNPJs)
      if (u.criadoPor && u.criadoPor === callerUserId) return true;

      // 5. Se o usuário possui 0 CNPJs e o gestor pode gerenciar, exibe se compartilham equipe
      // 6. Verificar interseção de CNPJs
      const targetCnpjs = (u.cnpjsAutorizados || [])
        .filter((c: string) => c !== '*')
        .map((c: string) => c.replace(/\D/g, ''));
      const targetSet = new Set<string>(targetCnpjs);
      return hasCnpjIntersection(callerCnpjs, targetSet);
    });
  }

  // Demais perfis: retorna vazio (não deveriam chegar aqui pelo gate acima)
  return [];
}

// ============================================================
// POST /api/users — Criar usuário (admin_master, suporte_ti e contador_gestor)
// ============================================================
router.post('/', requireAuth, requirePerfil('admin_master', 'suporte_ti', 'contador_gestor'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { nome, email, perfil, senha, cnpjsAutorizados, permissao, modulosPermitidos, permissoesEmpresas } = req.body;
    if (!nome || !email) {
      return res.status(400).json({ success: false, message: 'Nome e Email são obrigatórios.' });
    }

    const callerPerfil = req.user?.perfil;
    const userPerfil = perfil || 'analista_fiscal';

    // ── TRAVA: suporte_ti e contador_gestor NÃO podem criar perfis privilegiados ──
    if ((callerPerfil === 'suporte_ti' || callerPerfil === 'contador_gestor') && PERFIS_PRIVILEGIADOS.includes(userPerfil)) {
      return res.status(403).json({
        success: false,
        message: `O perfil ${callerPerfil === 'contador_gestor' ? 'Contador Gestor' : 'Suporte TI'} não tem permissão para criar usuários com o perfil "${userPerfil}".`
      });
    }

    // ── TRAVA: suporte_ti e contador_gestor só podem vincular CNPJs que eles próprios possuem ──
    if (callerPerfil === 'suporte_ti' || callerPerfil === 'contador_gestor') {
      if (Array.isArray(cnpjsAutorizados) && cnpjsAutorizados.length > 0) {
        if (cnpjsAutorizados.includes('*')) {
          return res.status(403).json({
            success: false,
            message: 'Acesso global (*) a todos os CNPJs é exclusivo de Administradores Master.'
          });
        }
        const callerCnpjs = getUserCnpjSet(req.user!.userId);
        const requestedCnpjs = cnpjsAutorizados.map((c: string) => c.replace(/\D/g, ''));
        const unauthorized = requestedCnpjs.filter((c: string) => !callerCnpjs.has(c));
        if (unauthorized.length > 0) {
          return res.status(403).json({
            success: false,
            message: `Você não tem acesso aos seguintes CNPJs da sua carteira: ${unauthorized.join(', ')}`
          });
        }
      }
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanNome = nome.trim();
    const rawSenha = senha || 'Mudar@123456';
    const senhaHash = bcrypt.hashSync(rawSenha, AUTH.BCRYPT_ROUNDS);
    const id = uuid();

    const isGlobal = callerPerfil === 'admin_master' && (Array.isArray(cnpjsAutorizados) && cnpjsAutorizados.includes('*') || (!cnpjsAutorizados && userPerfil === 'admin_master'));

    // 1. Gravar no Supabase (se configurado)
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        try {
          const { data: existingSupa } = await supabase.from('usuarios').select('id').eq('email', cleanEmail).maybeSingle();
          if (existingSupa) {
            return res.status(409).json({ success: false, message: 'Já existe um usuário com este e-mail no Supabase.' });
          }

          const { error: insErr } = await supabase.from('usuarios').insert([{
            id,
            nome: cleanNome,
            email: cleanEmail,
            senha_hash: senhaHash,
            perfil: userPerfil,
            status: 'ativo'
          }]);
          if (insErr) throw insErr;

          const { data: supaEmpresas } = await supabase.from('empresas').select('id, cnpj_completo');
          const allEmpresas = supaEmpresas || [];

          let empIdsToLink: string[] = [];
          if (isGlobal) {
            empIdsToLink = allEmpresas.map(e => e.id);
          } else if (Array.isArray(cnpjsAutorizados) && cnpjsAutorizados.length > 0) {
            for (const cnpj of cnpjsAutorizados) {
              const cleanCnpjDigits = String(cnpj).replace(/\D/g, '');
              const found = allEmpresas.find(e => 
                e.id === cnpj || 
                e.cnpj_completo === cnpj || 
                (e.cnpj_completo && e.cnpj_completo.replace(/\D/g, '') === cleanCnpjDigits)
              );
              if (found) empIdsToLink.push(found.id);
            }
          }

          if (empIdsToLink.length > 0) {
            const vinculosRows = empIdsToLink.map(empId => ({
              id: uuid(),
              usuario_id: id,
              empresa_id: empId,
              permissao: permissao || 'total',
              modulos_permitidos: modulosPermitidos || '*'
            }));
            await supabase.from('usuario_empresa').insert(vinculosRows);
          }
        } catch (e: any) {
          console.warn('⚠️ Erro ao salvar usuário no Supabase:', e?.message);
        }
      }
    }

    // 2. Gravar no SQLite local
    const db = getDatabase();
    const existing = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(cleanEmail);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Já existe um usuário com este e-mail no sistema.' });
    }

    db.transaction(() => {
      try {
        db.prepare(`
          INSERT INTO usuarios (id, nome, email, senha_hash, perfil, status, criado_por)
          VALUES (?, ?, ?, ?, ?, 'ativo', ?)
        `).run(id, cleanNome, cleanEmail, senhaHash, userPerfil, req.user?.userId || null);
      } catch {
        db.prepare(`
          INSERT INTO usuarios (id, nome, email, senha_hash, perfil, status)
          VALUES (?, ?, ?, ?, ?, 'ativo')
        `).run(id, cleanNome, cleanEmail, senhaHash, userPerfil);
      }

      const todasEmpresas = db.prepare('SELECT id, cnpj_completo FROM empresas WHERE status = \'ativo\'').all() as any[];
      let empIdsToLink: { id: string; cnpj: string }[] = [];

      if (isGlobal) {
        empIdsToLink = todasEmpresas.map(e => ({ id: e.id, cnpj: e.cnpj_completo }));
      } else if (Array.isArray(cnpjsAutorizados) && cnpjsAutorizados.length > 0) {
        for (const cnpj of cnpjsAutorizados) {
          const cleanCnpjDigits = String(cnpj).replace(/\D/g, '');
          const found = todasEmpresas.find(e => 
            e.id === cnpj || 
            e.cnpj_completo === cnpj || 
            (e.cnpj_completo && e.cnpj_completo.replace(/\D/g, '') === cleanCnpjDigits)
          );
          if (found) empIdsToLink.push({ id: found.id, cnpj: found.cnpj_completo });
        }
      }

      const insertVinculo = db.prepare(`
        INSERT OR IGNORE INTO usuario_empresa (id, usuario_id, empresa_id, permissao, modulos_permitidos)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const item of empIdsToLink) {
        const customPerm = permissoesEmpresas?.[item.cnpj] || permissoesEmpresas?.[item.id];
        const nivelPermissao = customPerm?.permissao || permissao || 'total';
        const modulos = customPerm?.modulosPermitidos || modulosPermitidos || '*';
        const modulosStr = Array.isArray(modulos) ? JSON.stringify(modulos) : String(modulos || '*');
        insertVinculo.run(uuid(), id, item.id, nivelPermissao, modulosStr);
      }
    })();

    logAuditAction(req, 'USUARIO_CRIAR', `Usuário ${cleanEmail} criado com perfil ${userPerfil} por ${req.user?.email || callerPerfil}`);

    return res.status(201).json({
      success: true,
      message: 'Usuário cadastrado com sucesso.',
      data: {
        id,
        nome: cleanNome,
        email: cleanEmail,
        perfil: userPerfil,
        status: 'ativo',
        mfaHabilitado: false,
        cnpjsAutorizados: isGlobal ? ['*'] : (cnpjsAutorizados || []),
        ultimoAcesso: 'Nunca'
      }
    });
  } catch (err: any) {
    console.error('❌ Erro ao cadastrar usuário:', err.message);
    return res.status(500).json({ success: false, message: 'Erro ao cadastrar usuário: ' + err.message });
  }
});

// ============================================================
// PUT /api/users/:id — Editar usuário (admin_master, suporte_ti e contador_gestor)
// ============================================================
router.put('/:id', requireAuth, requirePerfil('admin_master', 'suporte_ti', 'contador_gestor'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { nome, email, perfil, status, senha, cnpjsAutorizados, permissao, modulosPermitidos, permissoesEmpresas } = req.body;
    const cleanEmail = email ? email.toLowerCase().trim() : undefined;
    const cleanNome = nome ? nome.trim() : undefined;
    const callerPerfil = req.user?.perfil;

    const db = getDatabase();
    const targetUser = await getTargetUser(db, id);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: `Usuário com identificador "${id}" não foi localizado no sistema (SQLite/Supabase). Verifique se o colaborador foi excluído ou se pertence a outro ambiente.`
      });
    }

    // ── TRAVA: admin_master não pode ser editado por ninguém exceto ele mesmo ──
    if (targetUser.perfil === 'admin_master' && req.user?.userId !== id) {
      return res.status(403).json({ success: false, message: 'O perfil Administrador Master não pode ser editado por terceiros.' });
    }

    // ── TRAVA: suporte_ti e contador_gestor — validações de escopo ──
    if (callerPerfil === 'suporte_ti' || callerPerfil === 'contador_gestor') {
      // Não pode editar admin_master nem outro perfil privilegiado (exceto a si mesmo)
      if (PERFIS_PRIVILEGIADOS.includes(targetUser.perfil) && req.user?.userId !== id) {
        return res.status(403).json({ success: false, message: 'Você não pode editar usuários com perfil privilegiado.' });
      }

      // Contador gestor não pode editar suporte_ti
      if (callerPerfil === 'contador_gestor' && targetUser.perfil === 'suporte_ti') {
        return res.status(403).json({ success: false, message: 'Contador Gestor não pode editar contas de Suporte TI.' });
      }

      // Não pode alterar seu próprio perfil
      if (req.user?.userId === id && perfil && perfil !== callerPerfil) {
        return res.status(403).json({ success: false, message: 'Você não pode alterar seu próprio perfil.' });
      }

      // Deve ter acesso de escopo sobre o alvo
      if (req.user?.userId !== id && !(await hasUserScopeAccess(req, id, targetUser))) {
        return res.status(403).json({ success: false, message: 'Você não tem permissão para editar este usuário (fora do escopo da sua carteira).' });
      }

      // Não pode promover a perfil privilegiado
      if (perfil && PERFIS_PRIVILEGIADOS.includes(perfil)) {
        return res.status(403).json({ success: false, message: `Você não pode atribuir o perfil privilegiado "${perfil}".` });
      }

      // Não pode conceder CNPJs fora do seu escopo
      if (Array.isArray(cnpjsAutorizados) && cnpjsAutorizados.length > 0) {
        if (cnpjsAutorizados.includes('*')) {
          return res.status(403).json({ success: false, message: 'Acesso global (*) é restrito ao Administrador Master.' });
        }
        const callerCnpjs = getUserCnpjSet(req.user!.userId);
        const requestedCnpjs = cnpjsAutorizados.map((c: string) => c.replace(/\D/g, ''));
        const unauthorized = requestedCnpjs.filter((c: string) => !callerCnpjs.has(c));
        if (unauthorized.length > 0) {
          return res.status(403).json({
            success: false,
            message: `Você não tem acesso aos seguintes CNPJs da carteira: ${unauthorized.join(', ')}`
          });
        }
      }
    }

    // Determinar se o perfil pode ser alterado
    const effectivePerfil = (callerPerfil === 'admin_master' || ((callerPerfil === 'suporte_ti' || callerPerfil === 'contador_gestor') && perfil && !PERFIS_PRIVILEGIADOS.includes(perfil))) ? perfil : undefined;

    const isGlobal = callerPerfil === 'admin_master' && Array.isArray(cnpjsAutorizados) && cnpjsAutorizados.includes('*');

    // 1. Atualizar no Supabase (se configurado)
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        try {
          const updatePayload: any = { updated_at: new Date().toISOString() };
          if (cleanNome) updatePayload.nome = cleanNome;
          if (cleanEmail) updatePayload.email = cleanEmail;
          if (effectivePerfil) updatePayload.perfil = effectivePerfil;
          if (status) updatePayload.status = status;
          if (senha && senha.trim().length >= 6) {
            updatePayload.senha_hash = bcrypt.hashSync(senha, AUTH.BCRYPT_ROUNDS);
          }

          await supabase.from('usuarios').update(updatePayload).eq('id', id);

          if (Array.isArray(cnpjsAutorizados)) {
            const { data: supaEmpresas } = await supabase.from('empresas').select('id, cnpj_completo');
            const allEmpresas = supaEmpresas || [];

            if (callerPerfil === 'suporte_ti' || callerPerfil === 'contador_gestor') {
              const callerCnpjs = getUserCnpjSet(req.user!.userId);
              const callerEmpIds = allEmpresas
                .filter(e => callerCnpjs.has((e.cnpj_completo || '').replace(/\D/g, '')))
                .map(e => e.id);
              if (callerEmpIds.length > 0) {
                await supabase.from('usuario_empresa').delete().eq('usuario_id', id).in('empresa_id', callerEmpIds);
              }
            } else {
              await supabase.from('usuario_empresa').delete().eq('usuario_id', id);
            }

            let empIdsToLink: string[] = [];
            if (isGlobal) {
              empIdsToLink = allEmpresas.map(e => e.id);
            } else {
              for (const cnpj of cnpjsAutorizados) {
                const cleanCnpjDigits = String(cnpj).replace(/\D/g, '');
                const found = allEmpresas.find(e => 
                  e.id === cnpj || 
                  e.cnpj_completo === cnpj || 
                  (e.cnpj_completo && e.cnpj_completo.replace(/\D/g, '') === cleanCnpjDigits)
                );
                if (found) empIdsToLink.push(found.id);
              }
            }

            if (empIdsToLink.length > 0) {
              const vinculosRows = empIdsToLink.map(empId => ({
                id: uuid(),
                usuario_id: id,
                empresa_id: empId,
                permissao: permissao || 'total',
                modulos_permitidos: modulosPermitidos || '*'
              }));
              await supabase.from('usuario_empresa').insert(vinculosRows);
            }
          }
        } catch (supaErr: any) {
          console.warn('⚠️ Erro ao atualizar usuário no Supabase:', supaErr?.message);
        }
      }
    }

    // 2. Atualizar no SQLite local
    db.transaction(() => {
      let updateSql = `
        UPDATE usuarios
        SET nome = COALESCE(?, nome),
            email = COALESCE(?, email),
            perfil = COALESCE(?, perfil),
            status = COALESCE(?, status),
            updated_at = datetime('now')
      `;
      const params: any[] = [cleanNome, cleanEmail, effectivePerfil, status];

      if (senha && senha.trim().length >= 6) {
        const novaSenhaHash = bcrypt.hashSync(senha, AUTH.BCRYPT_ROUNDS);
        updateSql += `, senha_hash = ?`;
        params.push(novaSenhaHash);
      }

      updateSql += ` WHERE id = ?`;
      params.push(id);

      db.prepare(updateSql).run(...params);

      if (Array.isArray(cnpjsAutorizados)) {
        const todasEmpresas = db.prepare('SELECT id, cnpj_completo FROM empresas WHERE status = \'ativo\'').all() as any[];

        if (callerPerfil === 'suporte_ti' || callerPerfil === 'contador_gestor') {
          const callerCnpjs = getUserCnpjSet(req.user!.userId);
          const callerEmpIds = todasEmpresas
            .filter(e => callerCnpjs.has((e.cnpj_completo || '').replace(/\D/g, '')))
            .map(e => e.id);
          if (callerEmpIds.length > 0) {
            const placeholders = callerEmpIds.map(() => '?').join(',');
            db.prepare(`DELETE FROM usuario_empresa WHERE usuario_id = ? AND empresa_id IN (${placeholders})`).run(id, ...callerEmpIds);
          }
        } else {
          db.prepare('DELETE FROM usuario_empresa WHERE usuario_id = ?').run(id);
        }

        let empIdsToLink: { id: string; cnpj: string }[] = [];

        if (isGlobal) {
          empIdsToLink = todasEmpresas.map(e => ({ id: e.id, cnpj: e.cnpj_completo }));
        } else {
          for (const cnpj of cnpjsAutorizados) {
            const cleanCnpjDigits = String(cnpj).replace(/\D/g, '');
            const found = todasEmpresas.find(e => 
              e.id === cnpj || 
              e.cnpj_completo === cnpj || 
              (e.cnpj_completo && e.cnpj_completo.replace(/\D/g, '') === cleanCnpjDigits)
            );
            if (found) empIdsToLink.push({ id: found.id, cnpj: found.cnpj_completo });
          }
        }

        const insertVinculo = db.prepare(`
          INSERT OR IGNORE INTO usuario_empresa (id, usuario_id, empresa_id, permissao, modulos_permitidos)
          VALUES (?, ?, ?, ?, ?)
        `);
        for (const item of empIdsToLink) {
          const customPerm = permissoesEmpresas?.[item.cnpj] || permissoesEmpresas?.[item.id];
          const nivelPermissao = customPerm?.permissao || permissao || 'total';
          const modulos = customPerm?.modulosPermitidos || modulosPermitidos || '*';
          const modulosStr = Array.isArray(modulos) ? JSON.stringify(modulos) : String(modulos || '*');
          insertVinculo.run(uuid(), id, item.id, nivelPermissao, modulosStr);
        }
      }

      if (status === 'bloqueado') {
        db.prepare('UPDATE sessoes SET revogada = 1 WHERE usuario_id = ?').run(id);
      }
    })();

    logAuditAction(req, 'USUARIO_EDITAR', `Usuário ${id} atualizado`);

    return res.json({ success: true, message: 'Usuário atualizado com sucesso.' });
  } catch (err: any) {
    if (err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: `O colaborador solicitado (ID: "${req.params?.id}") não foi localizado nem no banco local nem na nuvem Supabase. Verifique se o registro foi removido recentemente ou atualize a página.`
      });
    }
    console.error('❌ Erro ao atualizar usuário:', err.message);
    return res.status(500).json({
      success: false,
      message: `Falha técnica ao atualizar colaborador (${err.message}). Por favor, verifique se você possui os privilégios necessários e tente novamente.`
    });
  }
});

// ============================================================
// DELETE /api/users/:id — Excluir usuário (admin_master, suporte_ti e contador_gestor)
// ============================================================
router.delete('/:id', requireAuth, requirePerfil('admin_master', 'suporte_ti', 'contador_gestor'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const callerPerfil = req.user?.perfil;

    // Não pode excluir a si mesmo
    if (req.user?.userId === id) {
      return res.status(400).json({ success: false, message: 'Você não pode excluir o seu próprio usuário logado.' });
    }

    const db = getDatabase();
    const targetUser = await getTargetUser(db, id);

    if (!targetUser) {
      return res.status(404).json({ success: false, message: `Usuário com identificador "${id}" não foi localizado no sistema.` });
    }

    // Conta admin_master NUNCA pode ser excluída
    if (targetUser.perfil === 'admin_master') {
      return res.status(403).json({ success: false, message: 'Contas Administrador Master não podem ser excluídas.' });
    }

    // ── TRAVA: suporte_ti e contador_gestor — validações de escopo ──
    if (callerPerfil === 'suporte_ti' || callerPerfil === 'contador_gestor') {
      if (PERFIS_PRIVILEGIADOS.includes(targetUser.perfil)) {
        return res.status(403).json({ success: false, message: 'Você não tem permissão para excluir usuários com perfil privilegiado.' });
      }

      if (callerPerfil === 'contador_gestor' && targetUser.perfil === 'suporte_ti') {
        return res.status(403).json({ success: false, message: 'Contador Gestor não pode excluir contas do Suporte TI.' });
      }

      // Deve compartilhar CNPJ ou ser criador do alvo
      if (!(await hasUserScopeAccess(req, id, targetUser))) {
        return res.status(403).json({ success: false, message: 'Você não tem permissão para excluir este usuário (fora do escopo da sua carteira).' });
      }
    }

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        try {
          await supabase.from('usuario_empresa').delete().eq('usuario_id', id);
          await supabase.from('usuarios').delete().eq('id', id);
        } catch (e: any) {
          console.warn('⚠️ Erro ao excluir usuário no Supabase:', e?.message);
        }
      }
    }

    db.transaction(() => {
      db.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(id);
      db.prepare('DELETE FROM usuario_empresa WHERE usuario_id = ?').run(id);
      db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);
    })();

    logAuditAction(req, 'USUARIO_EXCLUIR', `Usuário ${id} removido do sistema`, 'WARN');

    return res.json({ success: true, message: 'Usuário removido com sucesso.' });
  } catch (err: any) {
    if (err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    }
    console.error('❌ Erro ao excluir usuário:', err.message);
    return res.status(500).json({ success: false, message: 'Erro ao excluir usuário: ' + err.message });
  }
});

// ============================================================
// ROTAS DE GESTÃO DE MEMBROS POR EMPRESA (VISÃO CENTRADA NA EMPRESA)
// ============================================================

/**
 * GET /api/users/empresa/:empresaId/membros
 * Retorna todos os colaboradores com acesso à empresa especificada.
 */
router.get('/empresa/:empresaId/membros', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { empresaId } = req.params;
    const callerPerfil = req.user?.perfil;
    const callerUserId = req.user?.userId;

    const db = getDatabase();
    const empresa = db.prepare('SELECT id, cnpj_completo, razao_social, nome_fantasia FROM empresas WHERE id = ?').get(empresaId) as any;
    if (!empresa) {
      return res.status(404).json({ success: false, message: 'Empresa não encontrada.' });
    }

    // Validação de acesso à empresa
    if (callerPerfil !== 'admin_master') {
      const callerCnpjs = getUserCnpjSet(callerUserId!);
      const empCnpjDigits = (empresa.cnpj_completo || '').replace(/\D/g, '');
      if (!callerCnpjs.has(empCnpjDigits)) {
        return res.status(403).json({ success: false, message: 'Você não tem acesso aos membros desta empresa.' });
      }
    }

    const membros = db.prepare(`
      SELECT 
        u.id as usuario_id,
        u.nome,
        u.email,
        u.perfil,
        u.status,
        ue.id as vinculo_id,
        ue.permissao,
        ue.modulos_permitidos,
        ue.created_at as vinculado_em
      FROM usuario_empresa ue
      JOIN usuarios u ON u.id = ue.usuario_id
      WHERE ue.empresa_id = ?
      ORDER BY u.nome ASC
    `).all(empresaId) as any[];

    return res.json({
      success: true,
      data: {
        empresa,
        membros: membros.map(m => ({
          usuarioId: m.usuario_id,
          nome: m.nome,
          email: m.email,
          perfil: m.perfil,
          status: m.status,
          vinculoId: m.vinculo_id,
          permissao: m.permissao || 'total',
          modulosPermitidos: m.modulos_permitidos || '*',
          vinculadoEm: m.vinculado_em
        }))
      }
    });
  } catch (err: any) {
    console.error('❌ Erro ao buscar membros da empresa:', err.message);
    return res.status(500).json({ success: false, message: 'Erro ao buscar membros da empresa: ' + err.message });
  }
});

/**
 * POST /api/users/empresa/:empresaId/vincular
 * Vincula um colaborador existente (por id ou e-mail) à empresa.
 */
router.post('/empresa/:empresaId/vincular', requireAuth, requirePerfil('admin_master', 'suporte_ti', 'contador_gestor'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { empresaId } = req.params;
    const { usuarioId, email, permissao, modulosPermitidos } = req.body;
    const callerPerfil = req.user?.perfil;
    const callerUserId = req.user?.userId;

    const db = getDatabase();
    const empresa = db.prepare('SELECT id, cnpj_completo, razao_social FROM empresas WHERE id = ?').get(empresaId) as any;
    if (!empresa) {
      return res.status(404).json({ success: false, message: 'Empresa não encontrada.' });
    }

    if (callerPerfil !== 'admin_master') {
      const callerCnpjs = getUserCnpjSet(callerUserId!);
      const empCnpjDigits = (empresa.cnpj_completo || '').replace(/\D/g, '');
      if (!callerCnpjs.has(empCnpjDigits)) {
        return res.status(403).json({ success: false, message: 'Você não tem permissão para gerenciar acessos desta empresa.' });
      }
    }

    let targetUser: any = null;
    if (usuarioId) {
      targetUser = await getTargetUser(db, usuarioId);
    } else if (email) {
      const cleanTargetEmail = email.toLowerCase().trim();
      targetUser = db.prepare('SELECT id, nome, email, perfil FROM usuarios WHERE email = ?').get(cleanTargetEmail);
      if (!targetUser && isSupabaseConfigured()) {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          try {
            const { data: supaU } = await supabase.from('usuarios').select('id, nome, email, perfil, status, criado_por').eq('email', cleanTargetEmail).maybeSingle();
            if (supaU) {
              targetUser = supaU;
              try {
                db.prepare(`
                  INSERT OR IGNORE INTO usuarios (id, nome, email, senha_hash, perfil, status, criado_por)
                  VALUES (?, ?, ?, 'SYNC_SUPABASE', ?, ?, ?)
                `).run(supaU.id, supaU.nome || supaU.email.split('@')[0], supaU.email, supaU.perfil || 'analista_fiscal', supaU.status || 'ativo', supaU.criado_por || null);
              } catch {}
            }
          } catch {}
        }
      }
    }

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Colaborador não encontrado com os dados informados (ID/E-mail).' });
    }

    if (callerPerfil === 'contador_gestor' && PERFIS_PRIVILEGIADOS.includes(targetUser.perfil)) {
      return res.status(403).json({ success: false, message: 'Não é possível alterar vínculos de usuários com perfil privilegiado.' });
    }

    const nivelPermissao = permissao || 'total';
    const modulos = modulosPermitidos || '*';
    const modulosStr = typeof modulos === 'object' ? JSON.stringify(modulos) : String(modulos);

    // Inserir ou atualizar no Supabase se configurado
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        try {
          await supabase.from('usuario_empresa').upsert({
            usuario_id: targetUser.id,
            empresa_id: empresaId,
            permissao: nivelPermissao,
            modulos_permitidos: modulosStr
          });
        } catch (supaErr: any) {
          console.warn('⚠️ Erro ao vincular empresa no Supabase:', supaErr.message);
        }
      }
    }

    // Inserir ou atualizar na usuario_empresa local SQLite
    const existingVinculo = db.prepare('SELECT id FROM usuario_empresa WHERE usuario_id = ? AND empresa_id = ?').get(targetUser.id, empresaId) as any;
    if (existingVinculo) {
      db.prepare(`
        UPDATE usuario_empresa 
        SET permissao = ?, modulos_permitidos = ? 
        WHERE id = ?
      `).run(nivelPermissao, modulosStr, existingVinculo.id);
    } else {
      db.prepare(`
        INSERT INTO usuario_empresa (id, usuario_id, empresa_id, permissao, modulos_permitidos, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).run(uuid(), targetUser.id, empresaId, nivelPermissao, modulosStr);
    }

    logAuditAction(req, 'USUARIO_VINCULAR_EMPRESA', `Colaborador ${targetUser.email} vinculado à empresa ${empresa.razao_social} com permissão ${nivelPermissao}`);

    return res.json({
      success: true,
      message: `Colaborador ${targetUser.nome} vinculado com sucesso à empresa.`,
      data: {
        usuarioId: targetUser.id,
        nome: targetUser.nome,
        email: targetUser.email,
        permissao: nivelPermissao,
        modulosPermitidos: modulos
      }
    });
  } catch (err: any) {
    console.error('❌ Erro ao vincular colaborador à empresa:', err.message);
    return res.status(500).json({ success: false, message: 'Erro ao vincular colaborador: ' + err.message });
  }
});

/**
 * DELETE /api/users/empresa/:empresaId/desvincular/:usuarioId
 * Remove o vínculo de um colaborador com a empresa.
 */
router.delete('/empresa/:empresaId/desvincular/:usuarioId', requireAuth, requirePerfil('admin_master', 'suporte_ti', 'contador_gestor'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { empresaId, usuarioId } = req.params;
    const callerPerfil = req.user?.perfil;
    const callerUserId = req.user?.userId;

    const db = getDatabase();
    const empresa = db.prepare('SELECT id, cnpj_completo, razao_social FROM empresas WHERE id = ?').get(empresaId) as any;
    if (!empresa) {
      return res.status(404).json({ success: false, message: 'Empresa não encontrada.' });
    }

    if (callerPerfil !== 'admin_master') {
      const callerCnpjs = getUserCnpjSet(callerUserId!);
      const empCnpjDigits = (empresa.cnpj_completo || '').replace(/\D/g, '');
      if (!callerCnpjs.has(empCnpjDigits)) {
        return res.status(403).json({ success: false, message: 'Você não tem permissão para gerenciar acessos desta empresa.' });
      }
    }

    const targetUser = await getTargetUser(db, usuarioId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Colaborador não encontrado.' });
    }

    if (callerPerfil === 'contador_gestor' && PERFIS_PRIVILEGIADOS.includes(targetUser.perfil)) {
      return res.status(403).json({ success: false, message: 'Não é possível desvincular contas de perfil privilegiado.' });
    }

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        try {
          await supabase.from('usuario_empresa').delete().eq('usuario_id', usuarioId).eq('empresa_id', empresaId);
        } catch (supaErr: any) {
          console.warn('⚠️ Erro ao desvincular empresa no Supabase:', supaErr.message);
        }
      }
    }

    db.prepare('DELETE FROM usuario_empresa WHERE usuario_id = ? AND empresa_id = ?').run(usuarioId, empresaId);

    logAuditAction(req, 'USUARIO_DESVINCULAR_EMPRESA', `Colaborador ${targetUser.email} desvinculado da empresa ${empresa.razao_social}`);

    return res.json({ success: true, message: `Colaborador ${targetUser.nome} desvinculado com sucesso.` });
  } catch (err: any) {
    console.error('❌ Erro ao desvincular colaborador:', err.message);
    return res.status(500).json({ success: false, message: 'Erro ao desvincular colaborador: ' + err.message });
  }
});

/**
 * PUT /api/users/empresa/:empresaId/permissao/:usuarioId
 * Altera o nível de permissão ou módulos permitidos do colaborador para a empresa.
 */
router.put('/empresa/:empresaId/permissao/:usuarioId', requireAuth, requirePerfil('admin_master', 'suporte_ti', 'contador_gestor'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { empresaId, usuarioId } = req.params;
    const { permissao, modulosPermitidos } = req.body;
    const callerPerfil = req.user?.perfil;
    const callerUserId = req.user?.userId;

    const db = getDatabase();
    const empresa = db.prepare('SELECT id, cnpj_completo FROM empresas WHERE id = ?').get(empresaId) as any;
    if (!empresa) {
      return res.status(404).json({ success: false, message: 'Empresa não encontrada.' });
    }

    if (callerPerfil !== 'admin_master') {
      const callerCnpjs = getUserCnpjSet(callerUserId!);
      const empCnpjDigits = (empresa.cnpj_completo || '').replace(/\D/g, '');
      if (!callerCnpjs.has(empCnpjDigits)) {
        return res.status(403).json({ success: false, message: 'Você não tem permissão para gerenciar permissões desta empresa.' });
      }
    }

    const modulosStr = modulosPermitidos ? (typeof modulosPermitidos === 'object' ? JSON.stringify(modulosPermitidos) : String(modulosPermitidos)) : null;

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        try {
          const supaUpdate: any = {};
          if (permissao) supaUpdate.permissao = permissao;
          if (modulosStr) supaUpdate.modulos_permitidos = modulosStr;
          await supabase.from('usuario_empresa').update(supaUpdate).eq('usuario_id', usuarioId).eq('empresa_id', empresaId);
        } catch (supaErr: any) {
          console.warn('⚠️ Erro ao atualizar permissão no Supabase:', supaErr.message);
        }
      }
    }

    const vinculo = db.prepare('SELECT id FROM usuario_empresa WHERE usuario_id = ? AND empresa_id = ?').get(usuarioId, empresaId) as any;
    if (!vinculo) {
      return res.status(404).json({ success: false, message: 'Vínculo do colaborador com esta empresa não encontrado.' });
    }

    db.prepare(`
      UPDATE usuario_empresa 
      SET permissao = COALESCE(?, permissao),
          modulos_permitidos = COALESCE(?, modulos_permitidos)
      WHERE id = ?
    `).run(permissao || null, modulosStr, vinculo.id);

    return res.json({ success: true, message: 'Permissões atualizadas com sucesso.' });
  } catch (err: any) {
    console.error('❌ Erro ao atualizar permissão na empresa:', err.message);
    return res.status(500).json({ success: false, message: 'Erro ao atualizar permissão: ' + err.message });
  }
});

export default router;
