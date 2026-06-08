import {
  calcularLineTotalComBdi,
  type OrcamentoItem,
} from "../orcamentos/recalcularCurvaABC";
import type { CatalogoProduto } from "./catalogoTypes";

/** Normaliza código para busca (trim + uppercase). */
export function normalizeCatalogCode(code: string): string {
  return code.trim().toUpperCase();
}

/** Guarda preço de referência do edital/PDF na primeira vez. */
export function snapshotReferenciaOrcamento(item: OrcamentoItem): OrcamentoItem {
  if (item.referenceLineTotal != null && item.referenceLineTotal > 0) {
    return item;
  }
  const refTotal = calcularLineTotalComBdi(item.qty, item.unitPrice, item.bdi);
  return {
    ...item,
    referenceUnitPrice: item.unitPrice,
    referenceLineTotal: refTotal,
  };
}

/** Economia quando o preço do cliente é menor que a referência. */
export function calcularEconomia(item: OrcamentoItem): number {
  const referencia = item.referenceLineTotal ?? 0;
  const atual = item.lineTotal ?? 0;
  if (referencia <= 0 || atual <= 0) return 0;
  return Math.max(0, referencia - atual);
}

/** Aplica produto do catálogo mantendo qty e referência do edital. */
export function aplicarProdutoCatalogo(
  item: OrcamentoItem,
  produto: CatalogoProduto,
): OrcamentoItem {
  const comReferencia = snapshotReferenciaOrcamento(item);
  const unitPrice = produto.unitPrice;
  const bdi = produto.bdi ?? comReferencia.bdi;
  const lineTotal = calcularLineTotalComBdi(comReferencia.qty, unitPrice, bdi);

  return {
    ...comReferencia,
    catalogCode: produto.catalogCode,
    description: produto.description || comReferencia.description,
    banco: produto.banco ?? comReferencia.banco,
    tipo: produto.tipo ?? comReferencia.tipo,
    bdi,
    unit: produto.unit || comReferencia.unit,
    unitPrice,
    lineTotal,
  };
}

export function formatCurrencyBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
