import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { listOrcamentosByUserId } from "../features/orcamentos/orcamentoRepository";
import type { Orcamento } from "../features/orcamentos/orcamentoTypes";

interface ResumoCardProps {
  titulo: string;
  valor: string;
  descricao: string;
  extra?: string;
  variant: "blue" | "gray" | "yellow" | "green";
}

const variantStyles = {
  blue: "bg-blue-50 text-blue-600 border-blue-100",
  gray: "bg-slate-50 text-slate-800 border-slate-200",
  yellow: "bg-amber-50 text-amber-700 border-amber-100",
  green: "bg-emerald-50 text-emerald-700 border-emerald-100",
};

const ResumoCard: React.FC<ResumoCardProps> = ({
  titulo,
  valor,
  descricao,
  extra,
  variant,
}) => {
  return (
    <div
      className={`rounded-2xl p-6 border ${variantStyles[variant]} flex flex-col gap-2`}
    >
      <p className="text-sm text-slate-600">{titulo}</p>
      <p className="text-4xl font-bold">{valor}</p>
      <p className="text-sm text-slate-600">{descricao}</p>
      {extra && (
        <p className="text-sm font-medium text-emerald-600">{extra}</p>
      )}
    </div>
  );
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      if (!user?.uid) return;
      setLoading(true);
      try {
        const data = await listOrcamentosByUserId(user.uid);
        setOrcamentos(data);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [user?.uid]);

  const stats = useMemo(() => {
    const total = orcamentos.length;
    const processing = orcamentos.filter((o) => o.status === "processing").length;
    const completed = orcamentos.filter((o) => o.status === "completed").length;
    const error = orcamentos.filter((o) => o.status === "error").length;
    return { total, processing, completed, error };
  }, [orcamentos]);

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-4xl font-bold text-slate-900">
              Torre de Controle
            </h1>
            <p className="text-slate-600 mt-1">
              Gerencie todos os seus orçamentos de obra em um só lugar
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/orcamento")}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-white font-medium hover:bg-slate-800 transition cursor-pointer"
          >
            + Novo Orçamento
          </button>
        </div>

        {/* Cards resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <ResumoCard
            titulo="Total de Orçamentos"
            valor={loading ? "—" : String(stats.total)}
            descricao="Todos os projetos"
            variant="blue"
          />
          <ResumoCard
            titulo="Em Processamento"
            valor={loading ? "—" : String(stats.processing)}
            descricao="Aguardando OCR"
            variant="gray"
          />
          <ResumoCard
            titulo="Aguardando Validação"
            valor="—"
            descricao="(em breve)"
            variant="yellow"
          />
          <ResumoCard
            titulo="Finalizados"
            valor={loading ? "—" : String(stats.completed)}
            descricao="Prontos para uso"
            variant="green"
          />
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">
              Orçamentos Recentes
            </h2>
            <button
              type="button"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 cursor-pointer"
            >
              Ver todos
            </button>
          </div>

          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left px-6 py-4">Obra / Projeto</th>
                <th className="text-left px-6 py-4">Status</th>
                <th className="text-right px-6 py-4">Valor Total</th>
                <th className="text-right px-6 py-4">Itens</th>
                <th className="text-right px-6 py-4">Atualizado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td className="px-6 py-6 text-slate-500" colSpan={5}>
                    Carregando orçamentos…
                  </td>
                </tr>
              ) : orcamentos.length === 0 ? (
                <tr>
                  <td className="px-6 py-6 text-slate-500" colSpan={5}>
                    Nenhum orçamento encontrado. Clique em “Novo Orçamento” para começar.
                  </td>
                </tr>
              ) : (
                orcamentos.slice(0, 20).map((o) => {
                  const statusLabel =
                    o.status === "completed"
                      ? "Finalizado"
                      : o.status === "processing"
                        ? "Em Processamento"
                        : "Erro";

                  const statusPill =
                    o.status === "completed"
                      ? "bg-emerald-100 text-emerald-700"
                      : o.status === "processing"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-red-100 text-red-700";

                  const updatedAt = (o.updatedAt ?? o.extractedAt ?? o.uploadedAt).toLocaleString("pt-BR");

                  return (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-900">
                          {o.filename || o.uploadId}
                        </p>
                        <p className="text-xs text-slate-500">
                          Upload: {o.uploadedAt.toLocaleDateString("pt-BR")}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusPill}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">—</td>
                      <td className="px-6 py-4 text-right">{o.itemsFound ?? "—"}</td>
                      <td className="px-6 py-4 text-right text-slate-500">
                        {updatedAt}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
