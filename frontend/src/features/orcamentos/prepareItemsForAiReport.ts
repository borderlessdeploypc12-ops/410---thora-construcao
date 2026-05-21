import type { OrcamentoItem } from "./orcamentoTypes";
import {
  recalcularCurvaABC,
  isExecutiveItem,
  unitPriceSemBdiFromComBdi,
  type OrcamentoItem as ValidationItem,
} from "./recalcularCurvaABC";

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const compact = value.replace(/R\$/gi, "").replace(/\s/g, "").trim();
  const normalized =
    compact.includes(",") && compact.includes(".")
      ? compact.replace(/\./g, "").replace(",", ".")
      : compact.includes(",")
        ? compact.replace(",", ".")
        : compact;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapToValidationItems(items: OrcamentoItem[]): ValidationItem[] {
  let id = 0;
  const mapped: ValidationItem[] = [];

  for (const raw of items) {
    const tipo = String(raw.tipo ?? "item").toLowerCase();
    const description = String(raw.descricao ?? raw.description ?? "").trim();
    if (tipo === "grupo" || description.toLowerCase().includes("total do grupo")) {
      continue;
    }

    const qty = toNumber(raw.quantidade ?? raw.quantity);
    const bdi = toNumber((raw as { bdi?: number }).bdi);
    const unitComBdi = toNumber(raw.valor_unitario ?? raw.unitValue);
    const unitPrice =
      (raw as { unitPrice?: number }).unitPrice !== undefined
        ? toNumber((raw as { unitPrice?: number }).unitPrice)
        : unitPriceSemBdiFromComBdi(unitComBdi, bdi);

    mapped.push({
      id: ++id,
      code: String(raw.codigo ?? (raw as { code?: string }).code ?? id).trim(),
      description,
      bdi,
      unit: String(raw.unidade ?? raw.unit ?? "un").trim() || "un",
      qty,
      unitPrice,
      lineTotal: 0,
      tipo: String(raw.tipo ?? "item"),
      classification: (raw as { classification?: "A" | "B" | "C" }).classification,
    });
  }

  return mapped;
}

/** Enriquece itens com Curva ABC calculada antes de enviar à IA. */
export function prepareItemsForAiReport(items: OrcamentoItem[]): Record<string, unknown>[] {
  const withAbc = recalcularCurvaABC(mapToValidationItems(items));

  return withAbc.map((item) => ({
    codigo: item.code,
    descricao: item.description,
    quantidade: item.qty,
    unidade: item.unit,
    valor_unitario: item.unitPrice,
    bdi: item.bdi,
    valor_total: item.lineTotal,
    lineTotal: item.lineTotal,
    classification: item.classification,
    individual_percentage: item.individual_percentage,
    accumulated_percentage: item.accumulated_percentage,
    tipo: item.tipo ?? "item",
  }));
}

export function countByAbcClass(
  items: Record<string, unknown>[],
): { A: number; B: number; C: number } {
  const counts = { A: 0, B: 0, C: 0 };
  for (const item of items) {
    const cls = String(item.classification ?? "").toUpperCase();
    if (cls === "A" || cls === "B" || cls === "C") {
      counts[cls] += 1;
    }
  }
  return counts;
}

export { isExecutiveItem };
