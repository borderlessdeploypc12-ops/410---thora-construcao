export type OrcamentoStatus = "processing" | "completed" | "error";

export type OrcamentoItem = {
  id: string;
  descricao?: string;
  description?: string;
  quantidade?: number;
  quantity?: number;
  unidade?: string;
  unit?: string;
  valor_unitario?: number;
  unitValue?: number;
  valor_total?: number;
  totalValue?: number;
};

export type Orcamento = {
  id: string;
  userId: string;
  uploadId: string;
  filename: string;
  uploadedAt: Date;
  extractedAt?: Date;
  items: OrcamentoItem[];
  itemsFound: number;
  tablesFound: number;
  status: OrcamentoStatus;
  errorMessage?: string | null;
  updatedAt?: Date;
};

