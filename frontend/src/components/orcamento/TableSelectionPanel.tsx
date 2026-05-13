import React from "react";
import { Table2, AlertCircle } from "lucide-react";
import { btnPrimary, btnSecondary } from "../ui/buttonClasses";

export interface TableOptionPreview {
  id: string;
  preview_texto: string;
  num_pagina: number;
}

interface TableSelectionPanelProps {
  options: TableOptionPreview[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  mockFallback?: boolean;
  processing: boolean;
  onProcess: () => void;
  onCancel: () => void;
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 h-4 w-24 rounded bg-slate-200" />
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-slate-100" />
        <div className="h-3 w-5/6 rounded bg-slate-100" />
        <div className="h-3 w-4/6 rounded bg-slate-100" />
      </div>
    </div>
  );
}

export const TableSelectionPanel: React.FC<TableSelectionPanelProps> = ({
  options,
  loading,
  selectedId,
  onSelect,
  mockFallback,
  processing,
  onProcess,
  onCancel,
}) => {
  return (
    <div className="mt-8 w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Seleção de tabela
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Escolha a tabela que representa o orçamento principal (por exemplo, Orçamento
            estimado).
          </p>
        </div>
        <button type="button" onClick={onCancel} className={`${btnSecondary} shrink-0`}>
          Voltar
        </button>
      </div>

      {mockFallback && !loading && (
        <div className="mb-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Nenhuma tabela tabular foi detectada automaticamente neste PDF. As opções
            abaixo são simuladas para teste de interface — use um PDF com tabela real
            para extração confiável.
          </span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : options.map((opt) => {
              const selected = selectedId === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onSelect(opt.id)}
                  disabled={processing}
                  className={`rounded-2xl border p-4 text-left shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    selected
                      ? "border-blue-500 bg-blue-50/80 ring-1 ring-blue-500"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80"
                  } ${processing ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <Table2 className="h-4 w-4 text-slate-400" />
                    Pág. {opt.num_pagina}
                  </div>
                  <p className="text-sm leading-relaxed text-slate-800 line-clamp-5">
                    {opt.preview_texto || "—"}
                  </p>
                  <p className="mt-3 font-mono text-xs text-slate-400">{opt.id}</p>
                </button>
              );
            })}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
        <button type="button" onClick={onCancel} disabled={processing} className={btnSecondary}>
          Cancelar
        </button>
        <button
          type="button"
          onClick={onProcess}
          disabled={!selectedId || processing || loading}
          className={btnPrimary}
        >
          {processing ? "Processando com IA…" : "Processar com IA"}
        </button>
      </div>
    </div>
  );
};
