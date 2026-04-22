import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Plus, Trash2, Search, Save, Loader2, PackagePlus, Truck, X } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, doc, increment } from 'firebase/firestore';
import { db } from '../firebase';

interface Produto { id: string; nome: string; categoria: string; custo: number; estoque_atual: number; codigo_barras: string; }
interface Fornecedor { id: string; nome: string; cnpj: string; }
interface ItemNota { produto_id: string; nome: string; categoria: string; quantidade: number; custo_unitario: number; subtotal: number; }
interface NotaFiscal { id: string; data_emissao: string; fornecedor: string; total_nota: number; itens: ItemNota[]; }

export default function NotaFiscal() {
  const navigate = useNavigate();
  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [painelAberto, setPainelAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [buscaProduto, setBuscaProduto] = useState('');
  
  const [fornecedorSelecionado, setFornecedorSelecionado] = useState('');
  const [dataEmissao, setDataEmissao] = useState(new Date().toISOString().substring(0, 10));
  const [itensNota, setItensNota] = useState<ItemNota[]>([]);

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const [snapNotas, snapProdutos, snapFornec] = await Promise.all([
        getDocs(collection(db, "notas_fiscais")),
        getDocs(collection(db, "produtos")),
        getDocs(collection(db, "fornecedores"))
      ]);
      setNotas(snapNotas.docs.map(d => ({ id: d.id, ...d.data() })) as NotaFiscal[]);
      setProdutos(snapProdutos.docs.map(d => ({ id: d.id, ...d.data() })) as Produto[]);
      setFornecedores(snapFornec.docs.map(d => ({ id: d.id, ...d.data() })) as Fornecedor[]);
    } catch (e) {
      alert("Erro ao carregar dados.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregarDados(); }, []);

  const totalNota = useMemo(() => itensNota.reduce((acc, item) => acc + item.subtotal, 0), [itensNota]);

  const produtosFiltrados = useMemo(() => {
    if (!buscaProduto.trim()) return [];
    return produtos.filter(p => p.nome.toLowerCase().includes(buscaProduto.toLowerCase()) || p.codigo_barras?.includes(buscaProduto));
  }, [produtos, buscaProduto]);

  const adicionarItem = (prod: Produto) => {
    const jaExiste = itensNota.find(i => i.produto_id === prod.id);
    if (jaExiste) return alert("Produto já adicionado na nota. Altere a quantidade na lista.");
    
    setItensNota([{
      produto_id: prod.id,
      nome: prod.nome,
      categoria: prod.categoria,
      quantidade: 1,
      custo_unitario: prod.custo,
      subtotal: prod.custo
    }, ...itensNota]);
    setBuscaProduto('');
  };

  const atualizarItem = (id: string, campo: 'quantidade' | 'custo_unitario', valor: number) => {
    setItensNota(prev => prev.map(item => {
      if (item.produto_id === id) {
        const novoItem = { ...item, [campo]: valor };
        novoItem.subtotal = novoItem.quantidade * novoItem.custo_unitario;
        return novoItem;
      }
      return item;
    }));
  };

  const salvarNotaFiscal = async () => {
    if (!fornecedorSelecionado) return alert("Selecione o fornecedor.");
    if (itensNota.length === 0) return alert("Adicione ao menos um produto na nota.");
    
    setSalvando(true);
    try {
      const novaNota = {
        data_emissao: dataEmissao,
        fornecedor: fornecedorSelecionado,
        total_nota: totalNota,
        itens: itensNota
      };

      await addDoc(collection(db, "notas_fiscais"), novaNota);

      for (const item of itensNota) {
        await updateDoc(doc(db, "produtos", item.produto_id), {
          estoque_atual: increment(item.quantidade),
          custo: item.custo_unitario 
        });
      }

      alert("Nota Fiscal lançada e estoque atualizado com sucesso!");
      setPainelAberto(false);
      setItensNota([]);
      setFornecedorSelecionado('');
      await carregarDados();
    } catch (error) {
      alert("Erro ao salvar a nota fiscal.");
    } finally {
      setSalvando(false);
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

        .content { flex: 1; padding: 2vw; overflow: hidden; display: flex; flex-direction: column; gap: 15px;}
        .tabela-fin { width: 100%; border-collapse: collapse; text-align: left; background: #121214; border-radius: 12px; overflow: hidden; border: 1px solid #27272a; }
        .tabela-fin th { padding: 12px 16px; border-bottom: 2px solid #27272a; background: #18181b; color: #facc15; font-size: 0.8rem; text-transform: uppercase; position: sticky; top: 0; }
        .tabela-fin td { padding: 12px 16px; border-bottom: 1px dashed #27272a; font-size: 0.95rem; }
        .tabela-fin tr:hover { background: #1c1f24; }
        
        .modal-fullscreen { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #0a0a0b; z-index: 100; display: flex; flex-direction: column; }
        .modal-header { padding: 15px 2vw; background: #18181b; border-bottom: 1px solid #27272a; display: flex; justify-content: space-between; align-items: center; }
        .modal-body { flex: 1; display: grid; grid-template-columns: 350px 1fr; gap: 20px; padding: 2vw; overflow: hidden; }
        
        .col-esq { display: flex; flex-direction: column; gap: 15px; background: #121214; padding: 20px; border-radius: 12px; border: 1px solid #27272a; overflow-y: auto; }
        .col-dir { display: flex; flex-direction: column; background: #121214; border-radius: 12px; border: 1px solid #27272a; overflow: hidden; }
        
        .form-group { display: flex; flex-direction: column; gap: 5px; }
        .form-group label { font-size: 0.8rem; font-weight: bold; color: #a1a1aa; text-transform: uppercase; }
        .input-form { padding: 10px; border: 1px solid #3f3f46; border-radius: 6px; outline: none; background: #0a0a0b; font-weight: bold; color: #facc15; color-scheme: dark;}
        .input-form:focus { border-color: #facc15; box-shadow: 0 0 0 3px rgba(250, 204, 21, 0.1); }
        
        .busca-container { position: relative; }
        .lista-busca { position: absolute; top: 100%; left: 0; width: 100%; background: #18181b; border: 1px solid #3f3f46; border-radius: 6px; max-height: 200px; overflow-y: auto; z-index: 10; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        .item-busca { padding: 10px; border-bottom: 1px solid #27272a; cursor: pointer; display: flex; justify-content: space-between; align-items: center; color: #e4e4e7; }
        .item-busca:hover { background: #1c1f24; color: #facc15; }

        .input-tabela { width: 80px; padding: 6px; border: 1px solid #3f3f46; border-radius: 4px; text-align: center; font-weight: bold; background: #0a0a0b; color: #facc15; }
        .btn-salvar { background: #facc15; color: #0a0a0b; border: none; padding: 15px; border-radius: 8px; font-weight: 900; font-size: 1.1rem; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 10px; transition: 0.2s;}
        .btn-salvar:hover { background: #eab308; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <div className="layout">
        <header className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1vw' }}>
            <button onClick={() => navigate('/')} className="btn-voltar"><ArrowLeft size={18} /> VOLTAR</button>
            <h1 className="titulo-loja">NOTAS FISCAIS</h1>
          </div>
          <button className="btn-voltar" style={{ background: '#facc15', color: '#0a0a0b', borderColor: '#facc15' }} onClick={() => setPainelAberto(true)}>
            <Plus size={18} /> LANÇAR NOVA NOTA
          </button>
        </header>

        <main className="content">
          <div style={{ flex: 1, borderRadius: '12px', border: '1px solid #27272a', overflowY: 'auto' }}>
            <table className="tabela-fin">
              <thead><tr><th>Data Emissão</th><th>Fornecedor</th><th style={{textAlign: 'center'}}>Qtd. Itens</th><th style={{textAlign: 'right'}}>Total da Nota</th></tr></thead>
              <tbody>
                {notas.length === 0 && <tr><td colSpan={4} style={{textAlign: 'center', padding: '30px', color: '#52525b'}}>Nenhuma nota fiscal lançada ainda.</td></tr>}
                {notas.sort((a,b) => new Date(b.data_emissao).getTime() - new Date(a.data_emissao).getTime()).map(n => (
                  <tr key={n.id}>
                    <td style={{fontWeight: 'bold', color: '#a1a1aa'}}>{new Date(n.data_emissao + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                    <td style={{fontWeight: 'bold'}}>{n.fornecedor}</td>
                    <td style={{textAlign: 'center'}}><span style={{background: '#18181b', padding: '4px 8px', borderRadius: '6px', border: '1px solid #3f3f46', fontWeight: 'bold'}}>{n.itens.length}</span></td>
                    <td style={{textAlign: 'right', fontWeight: 900, color: '#facc15'}}>R$ {n.total_nota.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {painelAberto && (
        <div className="modal-fullscreen">
          <header className="modal-header">
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px', color: '#facc15' }}>
              <FileText size={24} /> LANÇAMENTO DE COMPRA
            </h2>
            <button onClick={() => { setPainelAberto(false); setItensNota([]); }} style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer' }}>CANCELAR</button>
          </header>

          <div className="modal-body">
            <div className="col-esq">
              <div className="form-group">
                <label><Truck size={14} style={{verticalAlign: 'middle', marginRight: '4px'}}/> Fornecedor</label>
                <select className="input-form" value={fornecedorSelecionado} onChange={e => setFornecedorSelecionado(e.target.value)}>
                  <option value="">Selecione o emissor...</option>
                  {fornecedores.map(f => <option key={f.id} value={f.nome}>{f.nome}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Data de Emissão</label>
                <input type="date" className="input-form" value={dataEmissao} onChange={e => setDataEmissao(e.target.value)} />
              </div>
              <div style={{ borderTop: '2px dashed #27272a', margin: '10px 0' }}></div>
              <div className="form-group busca-container">
                <label><Search size={14} style={{verticalAlign: 'middle', marginRight: '4px'}}/> Inserir Produto na Nota</label>
                <input type="text" className="input-form" placeholder="Busque por Nome ou EAN..." value={buscaProduto} onChange={e => setBuscaProduto(e.target.value)} />
                {buscaProduto && produtosFiltrados.length > 0 && (
                  <div className="lista-busca">
                    {produtosFiltrados.map(p => (
                      <div key={p.id} className="item-busca" onClick={() => adicionarItem(p)}>
                        <div><div style={{fontWeight: 'bold', fontSize: '0.85rem'}}>{p.nome}</div><div style={{fontSize: '0.7rem', color: '#a1a1aa'}}>Custo atual: R$ {p.custo.toFixed(2)}</div></div>
                        <Plus size={18} color="#facc15" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ marginTop: 'auto', background: '#0a0a0b', padding: '20px', borderRadius: '8px', border: '1px dashed #facc15', color: '#e4e4e7', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#a1a1aa', textTransform: 'uppercase' }}>Valor Total da Nota</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#facc15' }}>R$ {totalNota.toFixed(2)}</div>
              </div>
              <button className="btn-salvar" onClick={salvarNotaFiscal} disabled={salvando}>
                {salvando ? <Loader2 size={24} className="spin" /> : <Save size={24} />} CONCLUIR LANÇAMENTO
              </button>
            </div>

            <div className="col-dir">
              <div style={{ padding: '15px 20px', background: '#18181b', borderBottom: '1px solid #27272a', fontWeight: 'bold', color: '#facc15', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PackagePlus size={20} /> Itens Lançados ({itensNota.length})
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <table className="tabela-fin">
                  <thead><tr><th>Produto</th><th style={{textAlign: 'center'}}>Qtd. Comprada</th><th style={{textAlign: 'center'}}>Novo Custo Un.</th><th style={{textAlign: 'right'}}>Subtotal</th><th style={{textAlign: 'center'}}><Trash2 size={16}/></th></tr></thead>
                  <tbody>
                    {itensNota.length === 0 && <tr><td colSpan={5} style={{textAlign: 'center', padding: '40px', color: '#52525b'}}>Busque e adicione produtos no painel ao lado.</td></tr>}
                    {itensNota.map(item => (
                      <tr key={item.produto_id}>
                        <td style={{fontWeight: 'bold'}}>{item.nome}</td>
                        <td style={{textAlign: 'center'}}><input type="number" min="1" className="input-tabela" value={item.quantidade || ''} onChange={e => atualizarItem(item.produto_id, 'quantidade', Number(e.target.value))} /></td>
                        <td style={{textAlign: 'center'}}><input type="number" step="0.01" min="0" className="input-tabela" value={item.custo_unitario || ''} onChange={e => atualizarItem(item.produto_id, 'custo_unitario', Number(e.target.value))} /></td>
                        <td style={{textAlign: 'right', fontWeight: 900, color: '#facc15'}}>R$ {item.subtotal.toFixed(2)}</td>
                        <td style={{textAlign: 'center'}}><button onClick={() => setItensNota(itensNota.filter(i => i.produto_id !== item.produto_id))} style={{background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer'}}><X size={20}/></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}