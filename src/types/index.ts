// types/index.ts

export type CategoriaProduto = 'Papelaria' | 'Personalizados' | 'Escritório' | 'Outros';
export type FormaPagamento = 'PIX' | 'Cartão de Crédito' | 'Cartão de Débito' | 'Dinheiro';

export interface Produto {
  id?: string;
  nome: string; // Ex: Caderno Universitário, Topo de Bolo
  descricao?: string;
  preco_venda: number;
  custo: number;
  estoque_atual: number;
  estoque_minimo: number;
  categoria: CategoriaProduto;
  codigo_barras?: string; 
  sob_encomenda: boolean; // Útil para diferenciar itens que exigem produção (como cartões de visita)
}

export interface Venda {
  id?: string;
  data_venda: Date;
  itens: Array<{
    produto_id: string;
    nome: string;
    quantidade: number;
    preco_unitario: number;
    subtotal: number;
  }>;
  total: number;
  forma_pagamento: FormaPagamento;
  status: 'Concluída' | 'Cancelada';
}

export interface Despesa {
  id?: string;
  descricao: string;
  valor: number;
  data_vencimento: Date;
  data_pagamento?: Date;
  status: 'Paga' | 'Pendente';
  comprovante_url?: string; // Link para o Storage do Firebase
}

export interface NotaFiscal {
  id?: string;
  numero_nota: string;
  fornecedor: string;
  data_emissao: Date;
  valor_total: number;
  itens_adicionados_estoque: boolean;
}