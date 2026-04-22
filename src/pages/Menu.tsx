import { useNavigate } from 'react-router-dom';
import { Calculator, Package, Truck, FilePlus, TrendingUp, Wallet, FileText, Settings, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import logoImg from '../assets/logo.png'; 

export default function Menu() {
  const navigate = useNavigate();

  const modulos = [
    { id: 'pdv', nome: 'Caixa (PDV)', icon: Calculator, desc: 'Vendas e Frente de Caixa', rota: '/pdv' },
    { id: 'estoque', nome: 'Estoque', icon: Package, desc: 'Produtos Cadastrados', rota: '/estoque' },
    { id: 'fornecedores', nome: 'Fornecedores', icon: Truck, desc: 'Cadastro de Parceiros', rota: '/fornecedores' },
    { id: 'notas', nome: 'Notas Fiscais', icon: FilePlus, desc: 'Entrada de Mercadorias', rota: '/notas' },
    { id: 'financeiro', nome: 'Financeiro', icon: TrendingUp, desc: 'Extrato e Relatórios BI', rota: '/financeiro' },
    { id: 'despesas', nome: 'Despesas', icon: Wallet, desc: 'Lançar Contas e Gastos', rota: '/despesas' },
    { id: 'dre', nome: 'DRE', icon: FileText, desc: 'Faturamento e Lucros', rota: '/dre' },
    { id: 'configuracoes', nome: 'Ajustes', icon: Settings, desc: 'Configurações do Sistema', rota: '/configuracoes' },
  ];

  const handleSair = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      alert("Erro ao sair do sistema.");
    }
  };

  return (
    <>
      <style>{`
        /* TEMA PRETO E OURO - IMPÉRIO VARIEDADES */
        html, body, #root { 
          margin: 0; 
          padding: 0; 
          width: 100vw; 
          min-height: 100vh; 
          background-color: #0a0a0b; 
          color: #e4e4e7; 
          font-family: system-ui, sans-serif; 
        }
        
        .menu-layout { 
          display: flex; 
          flex-direction: column; 
          min-height: 100vh; 
          padding: 1.5vw 5vw;
        }
        
        /* CABEÇALHO AJUSTADO */
        .menu-header { 
          display: flex; 
          flex-direction: column; 
          align-items: center; 
          justify-content: center; 
          padding: 10px 0;
          margin-bottom: 25px;
          border-bottom: 1px solid #27272a;
          position: relative;
        }

        .logo-imperio {
          /* AUMENTADO PARA 140px CONFORME SOLICITADO */
          max-height: 140px;
          object-fit: contain;
          margin-bottom: 10px;
          filter: drop-shadow(0px 4px 15px rgba(250, 204, 21, 0.25)); /* Aumentei um pouco o brilho dourado também! */
        }

        .saudacao {
          font-size: 0.9rem;
          color: #a1a1aa;
          letter-spacing: 2px;
          text-transform: uppercase;
          font-weight: 600;
        }

        .btn-sair {
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: 1px solid #27272a;
          color: #a1a1aa;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: bold;
          font-size: 0.85rem;
          transition: 0.3s;
        }
        .btn-sair:hover {
          background: #18181b;
          color: #ef4444;
          border-color: #ef4444;
        }

        /* GRID DE MÓDULOS */
        .grid-modulos { 
          display: grid; 
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); 
          gap: 20px; 
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
        }
        
        .card-modulo { 
          background: #18181b; 
          border: 1px solid #27272a; 
          border-radius: 12px; 
          padding: 22px 20px; 
          display: flex; 
          flex-direction: column; 
          align-items: flex-start; 
          cursor: pointer; 
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }
        
        .card-modulo::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 4px;
          height: 100%;
          background: #facc15; 
          transform: scaleY(0);
          transition: transform 0.3s ease;
          transform-origin: bottom;
        }

        .card-modulo:hover { 
          transform: translateY(-5px); 
          border-color: #facc15; 
          box-shadow: 0 10px 30px -10px rgba(250, 204, 21, 0.15); 
          background: #1f1f22;
        }

        .card-modulo:hover::before {
          transform: scaleY(1);
        }

        .icon-container {
          background: rgba(250, 204, 21, 0.1); 
          padding: 10px;
          border-radius: 10px;
          margin-bottom: 12px;
          border: 1px solid rgba(250, 204, 21, 0.2);
        }
        
        .card-titulo { 
          font-size: 1.1rem; 
          font-weight: 900; 
          color: #f8fafc; 
          margin: 0 0 5px 0; 
        }
        
        .card-desc { 
          font-size: 0.8rem; 
          color: #a1a1aa; 
          margin: 0; 
          line-height: 1.4;
        }

      `}</style>

      <div className="menu-layout">
        <header className="menu-header">
          <img src={logoImg} alt="Império Variedades" className="logo-imperio" />
          <div className="saudacao">Painel de Gestão</div>
          
          <button className="btn-sair" onClick={handleSair}>
            <LogOut size={16} /> SAIR
          </button>
        </header>

        <main className="grid-modulos">
          {modulos.map((mod) => {
            const Icone = mod.icon;
            return (
              <div key={mod.id} className="card-modulo" onClick={() => navigate(mod.rota)}>
                <div className="icon-container">
                  <Icone size={26} color="#facc15" /> 
                </div>
                <h2 className="card-titulo">{mod.nome}</h2>
                <p className="card-desc">{mod.desc}</p>
              </div>
            );
          })}
        </main>
      </div>
    </>
  );
}