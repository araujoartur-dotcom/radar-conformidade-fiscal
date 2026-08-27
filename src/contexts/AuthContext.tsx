import React, { createContext, useContext, useState, useEffect } from 'react';

export interface User {
  id: string;
  nome: string;
  email: string;
  perfil: string;
}

export interface Empresa {
  id: string;
  cnpjRaiz: string;
  cnpjCompleto: string;
  razaoSocial: string;
  nomeFantasia: string;
  uf: string;
  regimeTributario: string;
  permissao?: string;
  modulosPermitidos?: string;
}

interface AuthContextType {
  user: User | null;
  empresaAtiva: Empresa | null;
  empresasDisponiveis: Empresa[];
  token: string | null;
  login: (token: string, user: User, empresaAtiva: Empresa, empresas: Empresa[]) => void;
  logout: () => void;
  switchEmpresa: (novaEmpresa: Empresa, novoToken: string) => void;
  setEmpresaAtiva: (empresa: Empresa | null) => void;
  setEmpresasDisponiveis: (empresas: Empresa[]) => void;
  removerEmpresa: (empresaId: string) => void;
  adicionarEmpresa: (novaEmpresa: Empresa) => void;
  atualizarEmpresa: (empresaAtualizada: Empresa) => void;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [empresaAtiva, setEmpresaAtivaState] = useState<Empresa | null>(null);
  const [empresasDisponiveis, setEmpresasDisponiveisState] = useState<Empresa[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUserData = async () => {
    const currentToken = localStorage.getItem('@RadarFiscal:token');
    if (!currentToken) return;

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.usuario) {
          setUser(data.usuario);
          localStorage.setItem('@RadarFiscal:user', JSON.stringify(data.usuario));
        }
        if (data.empresaAtiva) {
          setEmpresaAtivaState(data.empresaAtiva);
          localStorage.setItem('@RadarFiscal:empresaAtiva', JSON.stringify(data.empresaAtiva));
        }
        if (data.empresasDisponiveis) {
          setEmpresasDisponiveisState(data.empresasDisponiveis);
          localStorage.setItem('@RadarFiscal:empresasDisponiveis', JSON.stringify(data.empresasDisponiveis));
        }
      } else if (res.status === 401) {
        logout();
      }
    } catch {
      // Falha de rede não limpa sessão offline
    }
  };

  useEffect(() => {
    // Restaurar sessão inicial do localStorage
    const storedToken = localStorage.getItem('@RadarFiscal:token');
    const storedUser = localStorage.getItem('@RadarFiscal:user');
    const storedEmpresa = localStorage.getItem('@RadarFiscal:empresaAtiva');
    const storedEmpresas = localStorage.getItem('@RadarFiscal:empresasDisponiveis');

    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
        if (storedEmpresa) setEmpresaAtivaState(JSON.parse(storedEmpresa));
        if (storedEmpresas) setEmpresasDisponiveisState(JSON.parse(storedEmpresas));
      } catch {}

      // Validar e sincronizar com o backend
      refreshUserData().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const setEmpresaAtiva = (novaEmpresa: Empresa | null) => {
    setEmpresaAtivaState(novaEmpresa);
    if (novaEmpresa) {
      localStorage.setItem('@RadarFiscal:empresaAtiva', JSON.stringify(novaEmpresa));
    } else {
      localStorage.removeItem('@RadarFiscal:empresaAtiva');
    }
  };

  const setEmpresasDisponiveis = (novasEmpresas: Empresa[]) => {
    setEmpresasDisponiveisState(novasEmpresas);
    localStorage.setItem('@RadarFiscal:empresasDisponiveis', JSON.stringify(novasEmpresas));
  };

  const login = (newToken: string, newUser: User, novaEmpresa: Empresa, empresas: Empresa[]) => {
    setToken(newToken);
    setUser(newUser);
    setEmpresaAtivaState(novaEmpresa);
    setEmpresasDisponiveisState(empresas);

    localStorage.setItem('@RadarFiscal:token', newToken);
    localStorage.setItem('@RadarFiscal:user', JSON.stringify(newUser));
    localStorage.setItem('@RadarFiscal:empresaAtiva', JSON.stringify(novaEmpresa));
    localStorage.setItem('@RadarFiscal:empresasDisponiveis', JSON.stringify(empresas));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setEmpresaAtivaState(null);
    setEmpresasDisponiveisState([]);

    localStorage.removeItem('@RadarFiscal:token');
    localStorage.removeItem('@RadarFiscal:user');
    localStorage.removeItem('@RadarFiscal:empresaAtiva');
    localStorage.removeItem('@RadarFiscal:empresasDisponiveis');
  };

  const switchEmpresa = (novaEmpresa: Empresa, novoToken: string) => {
    setToken(novoToken);
    setEmpresaAtivaState(novaEmpresa);
    localStorage.setItem('@RadarFiscal:token', novoToken);
    localStorage.setItem('@RadarFiscal:empresaAtiva', JSON.stringify(novaEmpresa));
  };

  const removerEmpresa = (empresaId: string) => {
    setEmpresasDisponiveisState(prev => {
      const updated = prev.filter(e => e.id !== empresaId);
      localStorage.setItem('@RadarFiscal:empresasDisponiveis', JSON.stringify(updated));
      return updated;
    });

    setEmpresaAtivaState(current => {
      if (current?.id === empresaId) {
        localStorage.removeItem('@RadarFiscal:empresaAtiva');
        return null;
      }
      return current;
    });
  };

  const adicionarEmpresa = (novaEmpresa: Empresa) => {
    setEmpresasDisponiveisState(prev => {
      const updated = [novaEmpresa, ...prev.filter(e => e.id !== novaEmpresa.id)];
      localStorage.setItem('@RadarFiscal:empresasDisponiveis', JSON.stringify(updated));
      return updated;
    });

    setEmpresaAtivaState(current => {
      if (!current) {
        localStorage.setItem('@RadarFiscal:empresaAtiva', JSON.stringify(novaEmpresa));
        return novaEmpresa;
      }
      return current;
    });
  };

  const atualizarEmpresa = (empresaAtualizada: Empresa) => {
    setEmpresasDisponiveisState(prev => {
      const updated = prev.map(e => e.id === empresaAtualizada.id ? empresaAtualizada : e);
      localStorage.setItem('@RadarFiscal:empresasDisponiveis', JSON.stringify(updated));
      return updated;
    });

    setEmpresaAtivaState(current => {
      if (current?.id === empresaAtualizada.id) {
        localStorage.setItem('@RadarFiscal:empresaAtiva', JSON.stringify(empresaAtualizada));
        return empresaAtualizada;
      }
      return current;
    });
  };

  if (loading) {
    return <div className="min-h-screen bg-[#0a0f18] text-white flex items-center justify-center font-medium">Carregando sessão...</div>;
  }

  return (
    <AuthContext.Provider value={{
      user,
      empresaAtiva,
      empresasDisponiveis,
      token,
      login,
      logout,
      switchEmpresa,
      setEmpresaAtiva,
      setEmpresasDisponiveis,
      removerEmpresa,
      adicionarEmpresa,
      atualizarEmpresa,
      refreshUserData,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
