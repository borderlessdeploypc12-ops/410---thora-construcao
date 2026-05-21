import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  MessageSquare,
  Send,
  Paperclip,
} from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import ChatReportChart from "../components/ChatReportChart";
import { listOrcamentosByUserId } from "../features/orcamentos/orcamentoRepository";
import type { Orcamento } from "../features/orcamentos/orcamentoTypes";
import {
  aiReportChat,
  downloadAiAttachment,
  type AiReportAttachment,
  type AiReportChart,
  type AiReportTable,
} from "../services/api";
import { prepareItemsForAiReport } from "../features/orcamentos/prepareItemsForAiReport";
import { btnAccent } from "../components/ui/buttonClasses";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  chart?: AiReportChart | null;
  table?: AiReportTable | null;
  attachments?: AiReportAttachment[];
};

const SUGGESTIONS = [
  "Resumo executivo deste orçamento com totais e destaques",
  "Quais são os 10 itens de maior valor total?",
  "Gráfico dos itens com maior quantidade",
  "Relatório detalhado comparando itens por unidade de medida",
];

function formatInlineMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function MarkdownLite({ text }: { text?: string | null }) {
  const safe = typeof text === "string" ? text : "";
  if (!safe.trim()) {
    return (
      <p className="text-sm text-slate-500 italic">
        Resposta recebida sem texto. Veja tabela, gráfico ou anexos abaixo.
      </p>
    );
  }
  const lines = safe.split("\n").filter((l, idx, arr) => l.trim() || idx < arr.length - 1);
  return (
    <div className="space-y-2 text-sm leading-relaxed text-slate-800">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1" />;
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={i} className="text-base font-semibold text-slate-900">
              {formatInlineMarkdown(trimmed.slice(3))}
            </h3>
          );
        }
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={i} className="font-semibold text-slate-900">
              {formatInlineMarkdown(trimmed.slice(4))}
            </h4>
          );
        }
        if (trimmed.startsWith("- ") || /^\d+\.\s/.test(trimmed)) {
          return (
            <p key={i} className="pl-1">
              {formatInlineMarkdown(trimmed)}
            </p>
          );
        }
        return <p key={i}>{formatInlineMarkdown(trimmed)}</p>;
      })}
    </div>
  );
}

function InlineTable({ table }: { table: AiReportTable }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
      <p className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
        {table.title}
      </p>
      <table className="w-full min-w-[280px] text-left text-xs">
        {table.headers?.length > 0 && (
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {table.headers.map((h, i) => (
                <th key={i} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody className="divide-y divide-slate-100">
          {(table.rows ?? []).slice(0, 30).map((row, ri) => (
            <tr key={ri}>
              {(Array.isArray(row) ? row : []).map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-slate-800">
                  {String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AttachmentChips({ attachments }: { attachments: AiReportAttachment[] }) {
  if (!attachments.length) return null;

  const iconFor = (mime: string, name: string) => {
    if (mime.includes("csv") || name.endsWith(".csv")) {
      return <FileSpreadsheet className="h-4 w-4 text-emerald-600" />;
    }
    return <FileText className="h-4 w-4 text-blue-600" />;
  };

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {attachments.map((att) => (
        <button
          key={att.filename}
          type="button"
          onClick={() => {
            downloadAiAttachment(att);
            toast.success("Download iniciado", { description: att.filename });
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-medium text-slate-800 transition hover:border-blue-300 hover:bg-blue-50"
        >
          {iconFor(att.mime_type, att.filename)}
          <span className="max-w-[180px] truncate">{att.filename}</span>
          <Download className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        </button>
      ))}
    </div>
  );
}

const Reports: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const loadOrcamentos = useCallback(async () => {
    if (!user?.uid) return;
    setLoadingList(true);
    try {
      const data = await listOrcamentosByUserId(user.uid);
      const completed = data.filter(
        (o) => o.status === "completed" && Array.isArray(o.items) && o.items.length > 0,
      );
      setOrcamentos(completed);
      const preselect = (location.state as { uploadId?: string } | null)?.uploadId;
      setSelectedId((current) => {
        if (preselect && completed.some((o) => o.uploadId === preselect)) return preselect;
        if (current && completed.some((o) => o.uploadId === current)) return current;
        return completed[0]?.uploadId ?? "";
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar orçamentos");
    } finally {
      setLoadingList(false);
    }
  }, [user?.uid, location.state]);

  useEffect(() => {
    void loadOrcamentos();
  }, [loadOrcamentos]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const selected = useMemo(
    () => orcamentos.find((o) => o.uploadId === selectedId),
    [orcamentos, selectedId],
  );

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !selected?.items?.length) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setSending(true);

    try {
      const preparedItems = prepareItemsForAiReport(selected.items);

      const result = await aiReportChat(trimmed, preparedItems, {
        filename: selected.filename,
        uploadId: selected.uploadId,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.reply || "Análise concluída.",
          chart: result.chart ?? undefined,
          table: result.table ?? undefined,
          attachments: result.attachments ?? [],
        },
      ]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro na IA";
      toast.error(msg);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Não foi possível analisar o orçamento: **${msg}**`,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-0px)] min-h-0 flex-col bg-slate-50 lg:h-screen">
      <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Relatórios</h1>
        <p className="mt-0.5 text-sm text-slate-600">
          Pergunte qualquer coisa sobre o orçamento — análises, tabelas, gráficos ou
          relatórios. A resposta e os arquivos para download vêm no chat.
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="shrink-0 border-b border-slate-200 bg-white p-4 lg:w-64 lg:border-b-0 lg:border-r">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Orçamento
          </p>
          {loadingList ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando…
            </div>
          ) : orcamentos.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nenhum orçamento finalizado.{" "}
              <button
                type="button"
                className="font-medium text-blue-600 hover:underline"
                onClick={() => navigate("/orcamento")}
              >
                Criar um
              </button>
            </p>
          ) : (
            <ul className="max-h-40 space-y-1 overflow-y-auto lg:max-h-[calc(100vh-8rem)]">
              {orcamentos.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(o.uploadId);
                      setMessages([]);
                    }}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                      selectedId === o.uploadId
                        ? "bg-blue-600 text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span className="block truncate font-medium">
                      {o.filename || o.uploadId}
                    </span>
                    <span
                      className={`text-xs ${
                        selectedId === o.uploadId ? "text-blue-100" : "text-slate-500"
                      }`}
                    >
                      {o.itemsFound ?? o.items.length} itens
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="flex min-h-0 flex-1 flex-col bg-white">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
            <MessageSquare className="h-5 w-5 text-violet-600" />
            <span className="text-sm font-medium text-slate-800">
              {selected
                ? `Análise: ${selected.filename || selected.uploadId}`
                : "Selecione um orçamento"}
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div className="mx-auto max-w-3xl space-y-4">
              {messages.length === 0 && selected && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-5">
                  <p className="mb-3 text-sm text-slate-600">
                    Exemplos sobre <strong>{selected.filename}</strong>:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void sendMessage(s)}
                        disabled={sending}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-700 transition hover:border-violet-300 hover:bg-violet-50"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
                    <Paperclip className="h-3.5 w-3.5" />
                    Arquivos .md e .csv para download aparecem nas respostas da IA.
                  </p>
                </div>
              )}

              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[92%] rounded-2xl px-4 py-3 sm:max-w-[85%] ${
                      m.role === "user"
                        ? "bg-blue-600 text-white"
                        : "border border-slate-200 bg-slate-50/50 text-slate-800 shadow-sm"
                    }`}
                  >
                    {m.role === "user" ? (
                      <p className="text-sm whitespace-pre-wrap">
                        {m.content ?? ""}
                      </p>
                    ) : (
                      <>
                        <MarkdownLite text={m.content} />
                        {m.table && <InlineTable table={m.table} />}
                        {m.chart && m.chart.data?.length > 0 && (
                          <ChatReportChart chart={m.chart} />
                        )}
                        {m.attachments && m.attachments.length > 0 && (
                          <AttachmentChips attachments={m.attachments} />
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}

              {sending && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analisando orçamento…
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </div>

          <form
            className="shrink-0 border-t border-slate-200 bg-white p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage(input);
            }}
          >
            <div className="mx-auto flex max-w-3xl gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={!selected || sending}
                placeholder={
                  selected
                    ? "Ex.: faça um relatório dos itens classe A com valores e observações"
                    : "Selecione um orçamento à esquerda"
                }
                className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
              />
              <button
                type="submit"
                disabled={!selected || sending || !input.trim()}
                className={`${btnAccent} shrink-0 px-5`}
                aria-label="Enviar"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

export default Reports;
