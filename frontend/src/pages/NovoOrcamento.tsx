import React, { useState, useCallback, useRef, useEffect } from "react";
import { useDropzone, DropzoneOptions } from "react-dropzone";
import {
  UploadCloud,
  FileText,
  X,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { btnPrimary } from "../components/ui/buttonClasses";
import {
  TableSelector,
  type MockTableOption,
} from "../components/TableSelector";

const mockTables: MockTableOption[] = [
  {
    id: "1",
    name: "Planilha de Quantitativos",
    page: 2,
    preview: "1.1 | Escavação Mecânica | m3 | 450,00...",
  },
  {
    id: "2",
    name: "Orçamento Analítico Estimado",
    page: 5,
    preview: "Item | Descrição | Unid | Qtd | Valor...",
  },
  {
    id: "3",
    name: "Cronograma de Desembolso",
    page: 15,
    preview: "Etapa | Mês 1 | Mês 2 | Mês 3...",
  },
];

type FlowPhase =
  | "pick_file"
  | "uploading"
  | "analyzing_tables"
  | "selecting_table"
  | "processing_ai";

/** Linhas compatíveis com o parser da tela de validação (modo demonstração). */
function buildMockExtractedData(table: MockTableOption) {
  const rows = [
    [
      "Item",
      "Código",
      "Banco",
      "Descrição",
      "Unidade",
      "Quantidade",
      "Valor unitário",
      "Valor total",
    ],
    [
      "1",
      "001",
      "",
      `Prévia — ${table.name}`,
      "un",
      "2",
      "150,00",
      "300,00",
    ],
    ["2", "002", "", "Outro serviço (mock)", "m", "10", "25,50", "255,00"],
  ];
  return [
    {
      page: table.page,
      table_id: `mock-table-${table.id}`,
      rows,
    },
  ];
}

export default function NovoOrcamento() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<FlowPhase>("pick_file");
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const processingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (processingTimerRef.current) {
        clearTimeout(processingTimerRef.current);
      }
    };
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setPhase("pick_file");
      setUploadId(null);
      setErrorMessage("");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
    multiple: false,
  } as unknown as DropzoneOptions);

  const removeFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
    setPhase("pick_file");
    setUploadId(null);
    setErrorMessage("");
  };

  const handleAfterUpload = async () => {
    if (!file) return;
    setErrorMessage("");

    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `mock-${Date.now()}`;
    setUploadId(id);

    setPhase("analyzing_tables");
    await new Promise((r) => setTimeout(r, 1500));

    setPhase("selecting_table");
  };

  const handleStartFlow = async () => {
    if (!file) return;
    setErrorMessage("");
    try {
      setPhase("uploading");
      await new Promise((r) => setTimeout(r, 1200));
      await handleAfterUpload();
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Erro ao preparar o fluxo";
      setErrorMessage(msg);
      setPhase("pick_file");
      toast.error("Falha", { description: msg });
    }
  };

  const handleSelectTable = (table: MockTableOption) => {
    if (!file || !uploadId) return;

    toast.success("Tabela selecionada. Iniciando processamento de IA...");

    setPhase("processing_ai");
    if (processingTimerRef.current) {
      clearTimeout(processingTimerRef.current);
    }
    processingTimerRef.current = setTimeout(() => {
      processingTimerRef.current = null;
      navigate(`/validacao/${uploadId}`, {
        state: {
          file,
          uploadId,
          selectedTableId: table.id,
          extractedData: buildMockExtractedData(table),
        },
      });
    }, 2000);
  };

  const showUploadProgress = phase === "uploading";
  const showTablePhase =
    phase === "analyzing_tables" ||
    phase === "selecting_table" ||
    phase === "processing_ai";

  return (
    <div className="flex flex-1 flex-col items-center overflow-auto bg-slate-50 px-6 py-12">
      <h1 className="text-2xl font-semibold text-slate-900">Novo Orçamento</h1>

      <p className="mt-2 max-w-xl text-center text-slate-600">
        Modo demonstração: após o envio simulado, escolha uma tabela para seguir para a
        validação (sem chamadas ao backend).
      </p>

      {!file ? (
        <div
          {...getRootProps()}
          className={`mt-8 w-full max-w-2xl cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition duration-200
            ${
              isDragActive
                ? "border-blue-500 bg-blue-50"
                : "border-blue-200 bg-white hover:border-blue-400 hover:bg-blue-50/30"
            }`}
        >
          <input {...(getInputProps() as any)} aria-label="Selecionar arquivo PDF" />

          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
            <UploadCloud
              className={`h-7 w-7 ${isDragActive ? "text-blue-600" : "text-blue-500"}`}
              aria-hidden="true"
            />
          </div>

          <p className="text-lg font-medium text-slate-800">
            {isDragActive ? "Pode soltar o arquivo agora" : "Arraste e solte seu PDF"}
          </p>

          <p className="text-sm text-slate-500">ou clique para selecionar</p>

          <p className="mt-2 text-xs text-slate-400">
            Suporta arquivos PDF de até 50MB
          </p>
        </div>
      ) : (
        <div className="mt-8 flex w-full max-w-5xl flex-col items-stretch">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-red-50 p-3" aria-hidden="true">
                <FileText className="h-8 w-8 text-red-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-900">{file.name}</p>
                <p className="text-sm text-slate-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>

              {(phase === "pick_file" || phase === "selecting_table") && (
                <button
                  type="button"
                  onClick={removeFile}
                  className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-red-600"
                  aria-label="Remover arquivo selecionado"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {showUploadProgress && (
              <div className="mt-4 border-t border-slate-100 pt-4" role="status" aria-live="polite">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-600">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Enviando arquivo…
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full w-2/3 animate-pulse rounded-full bg-blue-600" />
                </div>
              </div>
            )}

            {phase === "processing_ai" && (
              <div className="mt-4 border-t border-slate-100 pt-4" role="status" aria-live="polite">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-600">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Processando com IA…
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full w-full animate-pulse rounded-full bg-blue-600" />
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="mt-3 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          {phase === "pick_file" && (
            <button
              type="button"
              onClick={() => void handleStartFlow()}
              className={`${btnPrimary} mt-6 w-full max-w-2xl self-center py-3`}
              aria-label="Continuar: simular envio e escolher tabela"
            >
              Continuar
            </button>
          )}

          {showTablePhase && (
            <TableSelector
              tables={mockTables}
              loading={phase === "analyzing_tables" || phase === "uploading"}
              disabled={phase === "processing_ai"}
              onSelect={handleSelectTable}
            />
          )}
        </div>
      )}
    </div>
  );
}
