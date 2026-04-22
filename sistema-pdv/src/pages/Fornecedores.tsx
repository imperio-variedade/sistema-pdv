import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Plus, Edit, Trash2, Truck, X, Save, Loader2 } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

interface Fornecedor {
  id?: string;
  nome: string;
  cnpj: string;
  telefone: string;
  email: string;
  contato_vendedor: string;
  observacoes: string;
}

export default function Fornecedores() {
  const navigate = useNavigate();
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [painelAberto, setPainelAberto] = useState(false);
  const [fornecedorEditando, setFornecedorEditando] = useState<Partial<Fornecedor> | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const snap = await getDocs(collection(db, "fornecedores"));
      setFornecedores(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Fornecedor[]);
    } catch (error) {
      alert("Erro ao carregar fornecedores.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregarDados(); }, []);

  const fornecedoresFiltrados = useMemo(() => fornecedores.filter(f => 
    f.nome.toLowerCase().includes(busca.toLowerCase()) || 
    (f.cnpj && f.cnpj.includes(busca))
  ), [fornecedores, busca]);

  const abrirNovoFornecedor = () => {
    setFornecedorEditando({ nome: '', cnpj: '', telefone: '', email: '', contato_vendedor: '', observacoes: '' });
    setPainelAberto(true);
  };

  const salvarFornecedor = async () => {
    if (!fornecedorEditando?.nome) return alert('O Nome da Empresa é obrigatório.');
    
    setSalvando(true);
    try {
      const dadosParaSalvar = { ...fornecedorEditando };
      delete dadosParaSalvar.id;

      if (fornecedorEditando.id) await updateDoc(doc(db, "fornecedores", fornecedorEditando.id), dadosParaSalvar);
      else await addDoc(collection(db, "fornecedores"), dadosParaSalvar);
      
      await carregarDados();
      setPainelAberto(false);
      setFornecedorEditando(null);
    } catch (error) { 
      alert("Erro ao salvar fornecedor."); 
    } finally {
      setSalvando(false);
    }
  };

  const excluirFornecedor = async (id: string | undefined) => {
    if (!id) return;
    if (window.confirm('Tem certeza que deseja excluir este fornecedor?')) {
      await deleteDoc(doc(db, "fornecedores", id));
      setFornecedores(prev => prev.filter(f => f.id !== id));
    }
  };

  return (
    <>
      <style>{`
        html, body, #root { margin: 0; padding: 0; width: 100vw; height: 100vh; overflow: hidden; background-color: #0a0a0b; color: #e4e4e7; font-family: system-ui, sans-serif; }
        .layout { display: flex; flex-direction: column; height: 100%; width: 100%; }
        .header { flex: 0 0 64px; background-color: #18181b; padding: 0 2vw; display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #facc15; }
        .btn-voltar { background: #27272a; color: #a1a1aa; border: 1px solid #3f3f46; padding: 8px 16px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: bold; transition: 0.3s;}
        .btn-voltar:hover { background: #3f3f46; color: white; }
        .titulo-loja { font-size: clamp(1rem, 1.2vw, 1.8rem); font-weight: 900; text-transform: uppercase; margin: 0; color: #facc15; letter-spacing: 1px; }
        
        .btn-novo { background: #facc15; color: #0a0a0b; border: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s; box-shadow: 0 4px 10px rgba(250, 204, 21, 0.2); }
        .btn-novo:hover { background: #eab308; transform: translateY(-2px); }

        .main-content { flex: 1; display: flex; overflow: hidden; position: relative; }
        .container-lista { flex: 1; display: flex; flex-direction: column; padding: 1.5vw; overflow: hidden; }
        
        .search-field { display: flex; align-items: center; background: #121214; border: 2px solid #27272a; border-radius: 8px; padding: 0 15px; flex: 0 0 50px; width: 100%; max-width: 500px; transition: 0.2s; }
        .search-field:focus-within { border-color: #facc15; box-shadow: 0 0 0 3px rgba(250, 204, 21, 0.1); }
        .search-field input { border: none; outline: none; width: 100%; margin-left: 10px; font-size: 1rem; background-color: transparent; color: #e4e4e7; }
        .search-field input::placeholder { color: #52525b; }
        
        .table-wrapper { flex: 1; background: #121214; border: 1px solid #27272a; border-radius: 8px; overflow-y: auto; margin-top: 20px;}
        table { width: 100%; border-collapse: collapse; }
        th { background: #18181b; padding: 1.5vh 1vw; font-size: 0.75rem; text-transform: uppercase; color: #facc15; position: sticky; top: 0; z-index: 10; border-bottom: 2px solid #27272a; text-align: left; letter-spacing: 1px;}
        td { padding: 1.5vh 1vw; border-bottom: 1px dashed #27272a; font-size: 0.9rem; }
        tr:hover { background: #1c1f24; }
        
        .drawer { width: clamp(320px, 30vw, 450px); background: #18181b; border-left: 2px solid #facc15; display: flex; flex-direction: column; transition: 0.3s; position: absolute; right: 0; top: 0; bottom: 0; transform: translateX(100%); z-index: 50; box-shadow: -10px 0 30px rgba(0,0,0,0.5);}
        .drawer.active { transform: translateX(0); position: relative; }
        .drawer-header { padding: 20px; border-bottom: 1px solid #27272a; display: flex; justify-content: space-between; align-items: center; background: #121214; }
        .drawer-body { padding: 2vh 1.5vw; flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 20px; }
        
        .form-control { display: flex; flex-direction: column; gap: 6px; }
        .form-control label { font-size: 0.75rem; font-weight: bold; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1px;}
        .input-text { padding: 12px; border: 1px solid #3f3f46; border-radius: 6px; outline: none; background: #0a0a0b; color: #e4e4e7; font-size: 0.95rem; transition: 0.2s;}
        .input-text:focus { border-color: #facc15; box-shadow: 0 0 0 3px rgba(250, 204, 21, 0.1); }
        
        .btn-save { background: #facc15; color: #0a0a0b; border: none; padding: 15px; border-radius: 8px; font-weight: 900; font-size: 1.1rem; cursor: pointer; width: 100%; transition: 0.2s; display: flex; align-items: center; justify-content: center; gap: 10px; text-transform: uppercase; }
        .btn-save:hover:not(:disabled) { background: #eab308; transform: translateY(-2px); box-shadow: 0 4px 15px rgba(250, 204, 21, 0.2); }
        .btn-save:disabled { opacity: 0.5; cursor: not-allowed; background: #3f3f46; color: #a1a1aa; }
        
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #121214; }
        ::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 4px; }
      `}</style>

      <div className="layout">
        <header className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1vw' }}>
            <button onClick={() => navigate('/')} className="btn-voltar"><ArrowLeft size={16} /> VOLTAR</button>
            <h1 className="titulo-loja">FORNECEDORES</h1>
          </div>
          <button className="btn-novo" onClick={abrirNovoFornecedor}><Plus size={20} /> NOVO PARCEIRO</button>
        </header>

        <main className="main-content">
          <section className="container-lista">
            <div className="search-field">
              <Search size={20} color="#facc15" />
              <input type="text" placeholder="Filtrar por nome ou CNPJ..." value={busca} onChange={e => setBusca(e.target.value)} />
            </div>

            <div className="table-wrapper">
              {carregando ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#facc15' }}>
                  <Loader2 size={40} className="spin" style={{ marginBottom: '16px' }} />
                  <h2 style={{color: '#a1a1aa'}}>Carregando fornecedores...</h2>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr><th>Empresa / Razão Social</th><th>CNPJ</th><th>Contato (Telefone / Email)</th><th>Vendedor</th><th style={{ textAlign: 'center' }}>AÇÕES</th></tr>
                  </thead>
                  <tbody>
                    {fornecedoresFiltrados.map(f => (
                      <tr key={f.id}>
                        <td><div style={{ fontWeight: 'bold', color: '#f8fafc', fontSize: '1rem' }}>{f.nome}</div></td>
                        <td style={{ color: '#a1a1aa' }}>{f.cnpj || '-'}</td>
                        <td>
                          <div style={{ color: '#e4e4e7' }}>{f.telefone || '-'}</div>
                          <div style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>{f.email}</div>
                        </td>
                        <td style={{ color: '#e4e4e7' }}>{f.contato_vendedor || '-'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#facc15', marginRight: '15px', transition: '0.2s' }} onClick={() => { setFornecedorEditando(f); setPainelAberto(true); }}><Edit size={20} /></button>
                          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', transition: '0.2s' }} onClick={() => excluirFornecedor(f.id)}><Trash2 size={20} /></button>
                        </td>
                      </tr>
                    ))}
                    {fornecedoresFiltrados.length === 0 && !carregando && (
                      <tr><td colSpan={5} style={{textAlign: 'center', padding: '40px', color: '#52525b'}}>Nenhum fornecedor encontrado.</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <aside className={`drawer ${painelAberto ? 'active' : ''}`}>
            <div className="drawer-header">
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px', color: '#facc15' }}><Truck size={22}/> {fornecedorEditando?.id ? 'EDITAR FORNECEDOR' : 'NOVO FORNECEDOR'}</h2>
              <X size={26} style={{ cursor: 'pointer', color: '#a1a1aa' }} onClick={() => setPainelAberto(false)} />
            </div>
            
            {fornecedorEditando && (
              <div className="drawer-body">
                <div className="form-control"><label>Nome da Empresa / Razão Social</label><input className="input-text" value={fornecedorEditando.nome} onChange={e => setFornecedorEditando({...fornecedorEditando, nome: e.target.value})} /></div>
                <div className="form-control"><label>CNPJ</label><input className="input-text" value={fornecedorEditando.cnpj} onChange={e => setFornecedorEditando({...fornecedorEditando, cnpj: e.target.value})} /></div>
                <div className="form-control"><label>Telefone / WhatsApp</label><input className="input-text" value={fornecedorEditando.telefone} onChange={e => setFornecedorEditando({...fornecedorEditando, telefone: e.target.value})} /></div>
                <div className="form-control"><label>E-mail Comercial</label><input type="email" className="input-text" value={fornecedorEditando.email} onChange={e => setFornecedorEditando({...fornecedorEditando, email: e.target.value})} /></div>
                <div className="form-control"><label>Nome do Vendedor / Contato</label><input className="input-text" value={fornecedorEditando.contato_vendedor} onChange={e => setFornecedorEditando({...fornecedorEditando, contato_vendedor: e.target.value})} /></div>
                <div className="form-control"><label>Observações</label><textarea rows={3} className="input-text" value={fornecedorEditando.observacoes} onChange={e => setFornecedorEditando({...fornecedorEditando, observacoes: e.target.value})} style={{resize: 'none'}} /></div>
              </div>
            )}
            
            <div style={{ padding: '20px', borderTop: '1px solid #27272a', background: '#121214' }}>
              <button className="btn-save" onClick={salvarFornecedor} disabled={salvando}>
                {salvando ? <Loader2 size={24} className="spin" /> : <Save size={24} />} 
                {salvando ? 'SALVANDO...' : 'SALVAR NO BANCO'}
              </button>
            </div>
          </aside>
        </main>
      </div>
    </>
  );
}