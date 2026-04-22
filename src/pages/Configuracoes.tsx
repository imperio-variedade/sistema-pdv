import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Printer, Users, Save, Plus, Trash2, Shield, Loader2 } from 'lucide-react';
import { doc, getDoc, setDoc, collection, getDocs, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface Taxas { debito: number; credito_avista: number; credito_parcelado: number; pix: number; }
interface Impressao { largura_termica: '58mm' | '80mm'; imprimir_automatico: boolean; via_cliente: boolean; }
interface Usuario { id: string; nome: string; email: string; papel: 'Administrador' | 'Caixa' | 'Estoque'; }

export default function Configuracoes() {
  const navigate = useNavigate();
  const [abaAtiva, setAbaAtiva] = useState<'taxas' | 'impressao' | 'usuarios'>('taxas');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [taxas, setTaxas] = useState<Taxas>({ debito: 1.99, credito_avista: 4.99, credito_parcelado: 5.99, pix: 0 });
  const [impressao, setImpressao] = useState<Impressao>({ largura_termica: '80mm', imprimir_automatico: true, via_cliente: false });
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [novoUsuario, setNovoUsuario] = useState<Partial<Usuario>>({ nome: '', email: '', papel: 'Caixa' });

  useEffect(() => {
    const carregarConfiguracoes = async () => {
      try {
        const docRef = doc(db, "configuracoes", "geral");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.taxas) setTaxas(data.taxas);
          if (data.impressao) setImpressao(data.impressao);
        }
        const snapUsers = await getDocs(collection(db, "usuarios"));
        setUsuarios(snapUsers.docs.map(d => ({ id: d.id, ...d.data() })) as Usuario[]);
      } catch (error) { alert("Erro ao carregar configurações."); } 
      finally { setCarregando(false); }
    };
    carregarConfiguracoes();
  }, []);

  const salvarConfiguracoesGerais = async () => {
    setSalvando(true);
    try { await setDoc(doc(db, "configuracoes", "geral"), { taxas, impressao }, { merge: true }); alert("Configurações salvas!"); } 
    catch (e) { alert("Erro ao salvar configurações."); } 
    finally { setSalvando(false); }
  };

  const adicionarUsuario = async () => {
    if (!novoUsuario.nome || !novoUsuario.email) return alert("Preencha nome e email.");
    setSalvando(true);
    try {
      const docRef = await addDoc(collection(db, "usuarios"), novoUsuario);
      setUsuarios([...usuarios, { id: docRef.id, ...novoUsuario } as Usuario]);
      setNovoUsuario({ nome: '', email: '', papel: 'Caixa' });
    } catch (e) { alert("Erro ao adicionar usuário."); } 
    finally { setSalvando(false); }
  };

  const removerUsuario = async (id: string, papel: string) => {
    if (papel === 'Administrador' && usuarios.filter(u => u.papel === 'Administrador').length <= 1) return alert("Não pode remover o último administrador.");
    if (window.confirm("Remover o acesso deste usuário?")) {
      await deleteDoc(doc(db, "usuarios", id));
      setUsuarios(usuarios.filter(u => u.id !== id));
    }
  };

  if (carregando) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0b' }}><Loader2 size={40} className="spin" color="#facc15" /></div>;

  return (
    <>
      <style>{`
        html, body, #root { margin: 0; padding: 0; width: 100vw; height: 100vh; overflow: hidden; background-color: #0a0a0b; color: #e4e4e7; font-family: system-ui, sans-serif; }
        .layout { display: flex; flex-direction: column; height: 100%; width: 100%; }
        .header { flex: 0 0 64px; background-color: #18181b; padding: 0 2vw; display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #facc15; }
        .btn-voltar { background: #27272a; color: #a1a1aa; border: 1px solid #3f3f46; padding: 8px 16px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: bold; transition: 0.3s;}
        .btn-voltar:hover { background: #3f3f46; color: white; }
        .titulo-loja { font-size: clamp(1rem, 1.2vw, 1.8rem); font-weight: 900; text-transform: uppercase; margin: 0; color: #facc15; letter-spacing: 1px; }
        
        .content { flex: 1; display: flex; overflow: hidden; padding: 2vw; gap: 2vw; }
        
        .side-menu { width: 250px; background: #121214; border-radius: 12px; border: 1px solid #27272a; display: flex; flex-direction: column; padding: 10px; gap: 5px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
        .menu-item { display: flex; align-items: center; gap: 10px; padding: 15px; border-radius: 8px; cursor: pointer; font-weight: bold; color: #a1a1aa; transition: 0.2s; border: none; background: transparent; text-align: left; }
        .menu-item:hover { background: #1c1f24; color: #e4e4e7; }
        .menu-item.ativo { background: rgba(250, 204, 21, 0.1); color: #facc15; border: 1px solid rgba(250, 204, 21, 0.2); }
        
        .painel-config { flex: 1; background: #121214; border-radius: 12px; border: 1px solid #27272a; padding: 2vw; overflow-y: auto; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
        .painel-titulo { font-size: 1.5rem; font-weight: 900; border-bottom: 1px solid #27272a; padding-bottom: 15px; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; color: #f8fafc; }
        
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
        .form-group { display: flex; flex-direction: column; gap: 8px; }
        .form-group label { font-size: 0.85rem; font-weight: bold; color: #a1a1aa; text-transform: uppercase; }
        .input-config { padding: 12px; border: 1px solid #3f3f46; border-radius: 8px; font-size: 1rem; outline: none; background: #0a0a0b; color: #facc15; transition: 0.2s; color-scheme: dark;}
        .input-config:focus { border-color: #facc15; box-shadow: 0 0 0 3px rgba(250, 204, 21, 0.1); }
        
        .btn-salvar { background: #facc15; color: #0a0a0b; border: none; padding: 15px 30px; border-radius: 8px; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 1rem; transition: 0.2s; text-transform: uppercase;}
        .btn-salvar:hover { background: #eab308; }
        .btn-salvar:disabled { opacity: 0.5; cursor: not-allowed; background: #3f3f46; color: #a1a1aa;}

        .tabela-users { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .tabela-users th { text-align: left; padding: 12px; border-bottom: 2px solid #27272a; color: #facc15; font-size: 0.8rem; text-transform: uppercase; background: #18181b;}
        .tabela-users td { padding: 15px 12px; border-bottom: 1px dashed #27272a; font-weight: 500; }
        .badge-papel { padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: bold; border: 1px solid #3f3f46;}
        
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <div className="layout">
        <header className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1vw' }}><button onClick={() => navigate('/')} className="btn-voltar"><ArrowLeft size={18} /> VOLTAR</button><h1 className="titulo-loja">AJUSTES</h1></div>
        </header>

        <main className="content">
          <aside className="side-menu">
            <button className={`menu-item ${abaAtiva === 'taxas' ? 'ativo' : ''}`} onClick={() => setAbaAtiva('taxas')}><CreditCard size={20} /> Taxas Maquininha</button>
            <button className={`menu-item ${abaAtiva === 'impressao' ? 'ativo' : ''}`} onClick={() => setAbaAtiva('impressao')}><Printer size={20} /> Impressão e Cupons</button>
            <button className={`menu-item ${abaAtiva === 'usuarios' ? 'ativo' : ''}`} onClick={() => setAbaAtiva('usuarios')}><Users size={20} /> Equipe e Acessos</button>
          </aside>

          <section className="painel-config">
            {abaAtiva === 'taxas' && (
              <>
                <h2 className="painel-titulo"><CreditCard size={24} color="#facc15" /> Taxas da Maquininha</h2>
                <div className="form-grid">
                  <div className="form-group"><label>Débito (%)</label><input type="number" step="0.01" className="input-config" value={taxas.debito} onChange={e => setTaxas({...taxas, debito: Number(e.target.value)})} /></div>
                  <div className="form-group"><label>Crédito à Vista (%)</label><input type="number" step="0.01" className="input-config" value={taxas.credito_avista} onChange={e => setTaxas({...taxas, credito_avista: Number(e.target.value)})} /></div>
                  <div className="form-group"><label>Crédito Parcelado (%)</label><input type="number" step="0.01" className="input-config" value={taxas.credito_parcelado} onChange={e => setTaxas({...taxas, credito_parcelado: Number(e.target.value)})} /></div>
                  <div className="form-group"><label>PIX / Boleto (%)</label><input type="number" step="0.01" className="input-config" value={taxas.pix} onChange={e => setTaxas({...taxas, pix: Number(e.target.value)})} /></div>
                </div>
                <button className="btn-salvar" onClick={salvarConfiguracoesGerais} disabled={salvando}>{salvando ? <Loader2 size={20} className="spin" /> : <Save size={20} />} SALVAR TAXAS</button>
              </>
            )}

            {abaAtiva === 'impressao' && (
              <>
                <h2 className="painel-titulo"><Printer size={24} color="#facc15" /> Configurações de Impressão</h2>
                <div className="form-grid">
                  <div className="form-group"><label>Bobina (Térmica)</label><select className="input-config" value={impressao.largura_termica} onChange={e => setImpressao({...impressao, largura_termica: e.target.value as '58mm'|'80mm'})}><option value="58mm">58mm</option><option value="80mm">80mm</option></select></div>
                  <div className="form-group"><label>Abertura Automática</label><select className="input-config" value={impressao.imprimir_automatico ? 'sim' : 'nao'} onChange={e => setImpressao({...impressao, imprimir_automatico: e.target.value === 'sim'})}><option value="sim">Sim, ao finalizar venda</option><option value="nao">Não, perguntar antes</option></select></div>
                </div>
                <button className="btn-salvar" onClick={salvarConfiguracoesGerais} disabled={salvando}>{salvando ? <Loader2 size={20} className="spin" /> : <Save size={20} />} SALVAR PREFERÊNCIAS</button>
              </>
            )}

            {abaAtiva === 'usuarios' && (
              <>
                <h2 className="painel-titulo"><Shield size={24} color="#facc15" /> Equipe e Acessos</h2>
                <div style={{ background: '#18181b', padding: '20px', borderRadius: '8px', border: '1px solid #27272a', marginBottom: '30px' }}>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input type="text" placeholder="Nome" className="input-config" style={{flex: 1.5}} value={novoUsuario.nome} onChange={e => setNovoUsuario({...novoUsuario, nome: e.target.value})} />
                    <input type="email" placeholder="Email" className="input-config" style={{flex: 1.5}} value={novoUsuario.email} onChange={e => setNovoUsuario({...novoUsuario, email: e.target.value})} />
                    <select className="input-config" style={{flex: 1}} value={novoUsuario.papel} onChange={e => setNovoUsuario({...novoUsuario, papel: e.target.value as any})}><option value="Caixa">Caixa</option><option value="Estoque">Estoque</option><option value="Administrador">Admin</option></select>
                    <button className="btn-salvar" onClick={adicionarUsuario} disabled={salvando}><Plus size={20} /> Add</button>
                  </div>
                </div>
                <table className="tabela-users">
                  <thead><tr><th>Nome</th><th>Email</th><th>Acesso</th><th style={{textAlign: 'center'}}>Ação</th></tr></thead>
                  <tbody>
                    {usuarios.map(u => (
                      <tr key={u.id}><td style={{ fontWeight: 'bold' }}>{u.nome}</td><td style={{ color: '#a1a1aa' }}>{u.email}</td><td><span className="badge-papel">{u.papel}</span></td><td style={{ textAlign: 'center' }}><button style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }} onClick={() => removerUsuario(u.id, u.papel)}><Trash2 size={18} /></button></td></tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>
        </main>
      </div>
    </>
  );
}