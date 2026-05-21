import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ClipboardCheck,
  FileText,
  Loader2,
  ArrowRight,
  Upload,
} from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { listOrcamentosByUserId } from "../features/orcamentos/orcamentoRepository";
import type { Orcamento } from "../features/orcamentos/orcamentoTypes";
import { formatCurrency, getOrcamentoTotal } from "../features/orcamentos/orcamentoAnalytics";
import { btnPrimary, btnSecondary } from "../components/ui/buttonClasses";

const ValidacaoInicio: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const data = await listOrcamentosByUserId(user.uid);
      setOrcamentos(
        data.filter(
          (o) =>
            o.status === "completed" &&
            Array.isArray(o.items) &&
            o.items.length > 0,
        ),
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar orçamentos";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-6 shadow-sm sm:px-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 sm:text-3xl">
              <ClipboardCheck className="h-8 w-8 text-blue-600" />
              Validação
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Escolha um orçamento já processado para conferir tabelas, ajustar
              valores e exportar a planilha analítica.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/orcamento")}
            className={btnPrimary}
          >
            <Upload className="h-4 w-4" />
            Novo Orçamento
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-8">
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-24 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin" />
            Carregando orçamentos…
          </div>
        ) : orcamentos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <FileText className="mx-auto mb-4 h-14 w-14 text-slate-300" />
            <p className="text-lg font-medium text-slate-800">
              Nenhum orçamento pronto para validar
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Envie um PDF em Novo Orçamento, processe as tabelas e volte aqui
              para revisar os dados.
            </p>
            <button
              type="button"
              className={`${btnPrimary} mt-6`}
              onClick={() => navigate("/orcamento")}
            >
              Criar orçamento
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {orcamentos.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/validacao/${o.uploadId}`)}
                  className="flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-blue-200 hover:shadow-md"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">
                      {o.filename || o.uploadId}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {o.itemsFound ?? o.items.length} itens ·{" "}
                      {o.uploadedAt.toLocaleDateString("pt-BR")}
                    </p>
                    <p className="mt-1 text-sm font-medium text-blue-700">
                      {formatCurrency(getOrcamentoTotal(o))}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700">
                    Validar
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-8 text-center text-xs text-slate-500">
          Também é possível abrir a validação logo após processar um PDF em Novo
          Orçamento.
        </p>
      </main>
    </div>
  );
};

export default ValidacaoInicio;
