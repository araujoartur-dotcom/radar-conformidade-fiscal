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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [empresaAtiva, setEmpresaAtivaState] = useState<Empresa | null>(null);
  const [empresasDisponiveis, setEmpresasDisponiveisState] = useState<Empresa[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restaurar sessão do localStorage
    const storedToken = localStorage.getItem('@RadarFiscal:token');
    const storedUser = localStorage.getItem('@RadarFiscal:user');
    const storedEmpresa = localStorage.getItem('@RadarFiscal:empresaAtiva');
    const storedEmpresas = localStorage.getItem('@RadarFiscal:empresasDisponiveis');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      if (storedEmpresa) {
        setEmpresaAtivaState(JSON.parse(storedEmpresa));
      }
      if (storedEmpresas) {
        setEmpresasDisponiveisState(JSON.parse(storedEmpresas));
      }
    }
    setLoading(false);
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
    return <div className="min-h-screen bg-[#0a0f18] text-white flex items-center justify-center">Carregando...</div>;
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
      atualizarEmpresa
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
