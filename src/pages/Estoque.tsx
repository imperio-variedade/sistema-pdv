import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Plus, Edit, Trash2, AlertTriangle, Package, X, Save, Image as ImageIcon, Loader2 } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase'; 

type CategoriaProduto = 'Utilidades' | 'Perfumaria' | 'Limpeza' | 'Eletrônicos' | 'Brinquedos' | 'Papelaria' | 'Guloseimas' | 'Uma a Uma' | 'Acessórios' | 'Festa' | 'Gráfica' | 'Ferramentas' ;

interface Produto {
  id?: string;
  codigo_barras: string;
  nome: string;
  categoria: CategoriaProduto | string;
  fornecedor: string;
  custo: number;
  preco_venda: number;
  estoque_atual: number;
  estoque_minimo: number;
  imagem_url?: string;
}

interface Fornecedor { id: string; nome: string; }

// === COLOQUE A SUA CHAVE DO IMGBB AQUI DENTRO DAS ASPAS NOVAMENTE ===
const IMGBB_API_KEY = '55429f7214843d587c303189035ae4c0'; 

export default function Estoque() {
  const navigate = useNavigate();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [painelAberto, setPainelAberto] = useState(false);
  const [produtoEditando, setProdutoEditando] = useState<Partial<Produto> | null>(null);
  
  const [imagemArquivo, setImagemArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const [snapProdutos, snapFornec] = await Promise.all([
        getDocs(collection(db, "produtos")),
        getDocs(collection(db, "fornecedores"))
      ]);
      setProdutos(snapProdutos.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Produto[]);
      setFornecedores(snapFornec.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Fornecedor[]);
    } catch (error) {
      alert("Erro ao conectar com o banco de dados.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregarDados(); }, []);

  const produtosFiltrados = useMemo(() => produtos.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()) || p.codigo_barras?.includes(busca)), [produtos, busca]);

  const lucroBruto = (produtoEditando?.preco_venda || 0) - (produtoEditando?.custo || 0);
  const margemLucro = (produtoEditando?.preco_venda || 0) > 0 ? (lucroBruto / (produtoEditando?.preco_venda || 1)) * 100 : 0;

  const abrirNovoProduto = () => {
    setProdutoEditando({ codigo_barras: '', nome: '', categoria: 'Papelaria', fornecedor: '', custo: 0, preco_venda: 0, estoque_atual: 0, estoque_minimo: 0, imagem_url: '' });
    setImagemArquivo(null); 
    setPainelAberto(true);
  };

  const salvarProduto = async () => {
    if (!produtoEditando?.nome || !produtoEditando?.preco_venda) return alert('ALERTA: Nome e Preço de Venda são obrigatórios.');
    if (!produtoEditando?.fornecedor) return alert('ALERTA: Por favor, selecione um Fornecedor.');
    
    setSalvando(true);
    try {
      let urlImagemFinal = produtoEditando.imagem_url || '';

      if (imagemArquivo) {
        if (IMGBB_API_KEY.includes('COLE_AQUI')) {
          alert('ERRO: Você ainda não colocou a sua Chave da API do ImgBB no código.');
          setSalvando(false);
          return;
        }

        const formData = new FormData();
        formData.append('image', imagemArquivo);

        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();
        
        if (data.success) {
          urlImagemFinal = data.data.url; 
        } else {
          alert(`ERRO DO IMGBB: ${data.error?.message || 'Chave API inválida ou erro na foto.'}`);
          setSalvando(false);
          return;
        }
      }

      const dadosParaSalvar = { ...produtoEditando, imagem_url: urlImagemFinal };
      delete dadosParaSalvar.id;

      if (produtoEditando.id) await updateDoc(doc(db, "produtos", produtoEditando.id), dadosParaSalvar);
      else await addDoc(collection(db, "produtos"), dadosParaSalvar);
      
      await carregarDados();
      setPainelAberto(false);
      setProdutoEditando(null);
      setImagemArquivo(null);
      
      alert("Produto salvo com sucesso!");
    } catch (error: any) { 
      console.error(error);
      alert(`Erro no sistema do Google: ${error.message}`); 
    } finally {
      setSalvando(false);
    }
  };

  const excluirProduto = async (id: string | undefined) => {
    if (!id) return;
    if (window.confirm('Tem certeza que deseja excluir?')) {
      await deleteDoc(doc(db, "produtos", id));
      setProdutos(prev => prev.filter(p => p.id !== id));
    }
  };

  return (
    <>
      <style>{`
        /* TEMA PRETO E OURO */
        html, body, #root { margin: 0; padding: 0; width: 100vw; height: 100vh; overflow: hidden; background-color: #0a0a0b; color: #e4e4e7; font-family: system-ui, sans-serif; }
        .estoque-layout { display: flex; flex-direction: column; height: 100%; width: 100%; }
        
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
        td { padding: 1.2vh 1vw; border-bottom: 1px dashed #27272a; font-size: 0.9rem; }
        tr:hover { background: #1c1f24; }
        .mini-foto { width: 45px; height: 45px; border-radius: 6px; object-fit: cover; background: #27272a; border: 1px solid #3f3f46;}
        
        .drawer { width: clamp(320px, 30vw, 450px); background: #18181b; border-left: 2px solid #facc15; display: flex; flex-direction: column; transition: 0.3s; position: absolute; right: 0; top: 0; bottom: 0; transform: translateX(100%); z-index: 50; box-shadow: -10px 0 30px rgba(0,0,0,0.5);}
        .drawer.active { transform: translateX(0); position: relative; }
        .drawer-header { padding: 20px; border-bottom: 1px solid #27272a; display: flex; justify-content: space-between; align-items: center; background: #121214; }
        .drawer-body { padding: 2vh 1.5vw; flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 20px; }
        
        .form-control { display: flex; flex-direction: column; gap: 6px; }
        .form-control label { font-size: 0.75rem; font-weight: bold; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1px;}
        .input-text { padding: 12px; border: 1px solid #3f3f46; border-radius: 6px; outline: none; background: #0a0a0b; color: #e4e4e7; font-size: 0.95rem; transition: 0.2s;}
        .input-text:focus { border-color: #facc15; box-shadow: 0 0 0 3px rgba(250, 204, 21, 0.1); }
        .input-file { padding: 10px; border: 1px dashed #52525b; border-radius: 6px; cursor: pointer; background: #121214; font-size: 0.8rem; color: #a1a1aa;}
        .input-file:hover { border-color: #facc15; color: #facc15; }
        
        .lucro-box { background: #0a0a0b; padding: 15px; border: 1px dashed #3f3f46; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
        
        .btn-save { background: #facc15; color: #0a0a0b; border: none; padding: 15px; border-radius: 8px; font-weight: 900; font-size: 1.1rem; cursor: pointer; width: 100%; transition: 0.2s; display: flex; align-items: center; justify-content: center; gap: 10px; text-transform: uppercase; }
        .btn-save:hover:not(:disabled) { background: #eab308; transform: translateY(-2px); box-shadow: 0 4px 15px rgba(250, 204, 21, 0.2); }
        .btn-save:disabled { opacity: 0.5; cursor: not-allowed; background: #3f3f46; color: #a1a1aa; }
        
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        /* SCROLLBAR DARK */
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #121214; }
        ::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #52525b; }
      `}</style>

      <div className="estoque-layout">
        <header className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1vw' }}>
            <button onClick={() => navigate('/')} className="btn-voltar"><ArrowLeft size={16} /> VOLTAR</button>
            <h1 className="titulo-loja">ESTOQUE</h1>
          </div>
          <button className="btn-novo" onClick={abrirNovoProduto}><Plus size={20} /> NOVO ITEM</button>
        </header>

        <main className="main-content">
          <section className="container-lista">
            <div className="search-field">
              <Search size={20} color="#facc15" />
              <input type="text" placeholder="Filtrar por nome ou código de barras..." value={busca} onChange={e => setBusca(e.target.value)} />
            </div>

            <div className="table-wrapper">
              {carregando ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#facc15' }}>
                  <Loader2 size={40} className="spin" style={{ marginBottom: '16px' }} />
                  <h2 style={{color: '#a1a1aa'}}>Carregando produtos...</h2>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr><th style={{ width: '60px' }}>FOTO</th><th>PRODUTO / DETALHES</th><th style={{ textAlign: 'right' }}>VENDA</th><th style={{ textAlign: 'center' }}>ESTOQUE</th><th style={{ textAlign: 'center' }}>AÇÕES</th></tr>
                  </thead>
                  <tbody>
                    {produtosFiltrados.map(p => (
                      <tr key={p.id}>
                        <td>{p.imagem_url ? <img src={p.imagem_url} alt={p.nome} className="mini-foto" /> : <div className="mini-foto" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ImageIcon size={20} color="#52525b" /></div>}</td>
                        <td>
                          <div style={{ fontWeight: 'bold', color: '#f8fafc', fontSize: '1rem' }}>{p.nome}</div>
                          <div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginTop: '6px' }}>Grupo: <strong style={{color: '#d4af37'}}>{p.categoria}</strong> | EAN: {p.codigo_barras || 'N/A'} | Fornec: {p.fornecedor || 'Não inf.'}</div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#facc15' }}>R$ {p.preco_venda.toFixed(2)}</td>
                        <td style={{ textAlign: 'center' }}>
                          {p.estoque_atual <= p.estoque_minimo && p.estoque_minimo > 0 ? (
                            <span style={{ color: '#ef4444', fontWeight: '900', background: 'rgba(239, 68, 68, 0.1)', padding: '6px 10px', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px' }}><AlertTriangle size={14} style={{verticalAlign: 'text-top', marginRight: '4px'}}/> {p.estoque_atual}</span>
                          ) : (<span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{p.estoque_atual}</span>)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#facc15', marginRight: '15px', transition: '0.2s' }} onClick={() => { setProdutoEditando(p); setImagemArquivo(null); setPainelAberto(true); }}><Edit size={20} /></button>
                          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', transition: '0.2s' }} onClick={() => excluirProduto(p.id)}><Trash2 size={20} /></button>
                        </td>
                      </tr>
                    ))}
                    {produtosFiltrados.length === 0 && !carregando && (
                      <tr><td colSpan={5} style={{textAlign: 'center', padding: '40px', color: '#52525b'}}>Nenhum produto encontrado.</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <aside className={`drawer ${painelAberto ? 'active' : ''}`}>
            <div className="drawer-header">
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px', color: '#facc15' }}><Package size={22}/> {produtoEditando?.id ? 'EDITAR PRODUTO' : 'NOVO PRODUTO'}</h2>
              <X size={26} style={{ cursor: 'pointer', color: '#a1a1aa' }} onClick={() => setPainelAberto(false)} />
            </div>
            
            {produtoEditando && (
              <div className="drawer-body">
                <div className="form-control">
                  <label>Foto do Produto (Tire do celular ou JPG/PNG)</label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="input-file" 
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        setImagemArquivo(e.target.files[0]);
                      }
                    }} 
                  />
                  {(imagemArquivo || produtoEditando.imagem_url) && (
                    <div style={{ marginTop: '10px', textAlign: 'center' }}>
                      <img 
                        src={imagemArquivo ? URL.createObjectURL(imagemArquivo) : produtoEditando.imagem_url} 
                        alt="Preview" 
                        style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '8px', border: '2px solid #facc15', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }} 
                      />
                    </div>
                  )}
                </div>

                <div className="form-control"><label>Código de Barras (EAN)</label><input className="input-text" value={produtoEditando.codigo_barras} onChange={e => setProdutoEditando({...produtoEditando, codigo_barras: e.target.value})} /></div>
                <div className="form-control"><label>Descrição do Produto</label><input className="input-text" value={produtoEditando.nome} onChange={e => setProdutoEditando({...produtoEditando, nome: e.target.value.toUpperCase()})} /></div>
                <div className="form-control">
                  <label>Grupo / Categoria</label>
                  <select className="input-text" value={produtoEditando.categoria} onChange={e => setProdutoEditando({...produtoEditando, categoria: e.target.value})}>
                    <option value="Utilidades">Utilidades</option>
                    <option value="Perfumaria">Perfumaria</option>
                    <option value="Limpeza">Limpeza</option>
                    <option value="Eletrônicos">Eletrônicos</option>
                    <option value="Brinquedos">Brinquedos</option>
                    <option value="Papelaria">Papelaria</option>
                    <option value="Guloseimas">Guloseimas</option>
                    <option value="Uma a Uma">Uma a Uma</option>
                    <option value="Acessórios">Acessórios</option>
                    <option value="Festa">Festa</option>
                    <option value="Ferramentas">Ferramentas</option>
                    <option value="Gráfica">Gráfica</option>
                  </select>
                </div>
                
                <div className="form-control">
                  <label>Fornecedor (Origem)</label>
                  <select className="input-text" value={produtoEditando.fornecedor} onChange={e => setProdutoEditando({...produtoEditando, fornecedor: e.target.value})}>
                    <option value="">Selecione um fornecedor...</option>
                    {fornecedores.length === 0 && <option disabled>Nenhum fornecedor cadastrado</option>}
                    {fornecedores.map(f => (
                      <option key={f.id} value={f.nome}>{f.nome}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-control"><label>Custo (R$)</label><input type="number" step="0.01" className="input-text" value={produtoEditando.custo} onChange={e => setProdutoEditando({...produtoEditando, custo: Number(e.target.value)})} /></div>
                  <div className="form-control"><label>Venda (R$)</label><input type="number" step="0.01" className="input-text" value={produtoEditando.preco_venda} onChange={e => setProdutoEditando({...produtoEditando, preco_venda: Number(e.target.value)})} /></div>
                </div>
                
                <div className="lucro-box">
                  <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#a1a1aa', letterSpacing: '1px' }}>LUCRO:</span>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 900, fontSize: '1.2rem', color: lucroBruto > 0 ? '#10b981' : '#ef4444', marginRight: '10px' }}>R$ {lucroBruto.toFixed(2)}</span>
                    <span style={{ background: lucroBruto > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: lucroBruto > 0 ? '#10b981' : '#ef4444', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', border: `1px solid ${lucroBruto > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}` }}>{margemLucro.toFixed(1)}%</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-control"><label>Estoque Atual</label><input type="number" className="input-text" value={produtoEditando.estoque_atual} onChange={e => setProdutoEditando({...produtoEditando, estoque_atual: Number(e.target.value)})} /></div>
                  <div className="form-control"><label>Estoque Mínimo</label><input type="number" className="input-text" value={produtoEditando.estoque_minimo} onChange={e => setProdutoEditando({...produtoEditando, estoque_minimo: Number(e.target.value)})} /></div>
                </div>
              </div>
            )}
            
            <div style={{ padding: '20px', borderTop: '1px solid #27272a', background: '#121214' }}>
              <button className="btn-save" onClick={salvarProduto} disabled={salvando}>
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