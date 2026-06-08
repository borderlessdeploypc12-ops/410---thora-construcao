export type CatalogoTipoLinha = "item" | "grupo";

/** Produto/serviço cadastrado pelo usuário (preço próprio). */
export type CatalogoProduto = {
  id: string;
  userId: string;
  /** Código interno do cliente — chave de busca na validação. */
  catalogCode: string;
  /** Código de referência (SINAPI, DER, etc.) — opcional. */
  referenceCode?: string;
  banco?: string;
  tipo: CatalogoTipoLinha;
  description: string;
  bdi: number;
  unit: string;
  /** Valor unitário s/ BDI (preço do cliente). */
  unitPrice: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CatalogoProdutoInput = Omit<
  CatalogoProduto,
  "id" | "userId" | "createdAt" | "updatedAt"
>;
