import React from "react";
import { CheckCircle2, Clock, FileText, Loader2, XCircle } from "lucide-react";

export type QueueItemStatus =
  | "uploading"
  | "queued"
  | "processing"
  | "completed"
  | "failed";

export type ProcessingQueueItem = {
  uploadId: string;
  filename: string;
  status: QueueItemStatus;
  pagesTotal?: number;
  pagesDone?: number;
  currentPage?: number | null;
  queuePosition?: number;
  message?: string;
  error?: string;
};

type ProcessingQueuePanelProps = {
  items: ProcessingQueueItem[];
  onSelectCompleted?: (item: ProcessingQueueItem) => void;
  selectedUploadId?: string | null;
};

function statusLabel(item: ProcessingQueueItem): string {
  switch (item.status) {
    case "uploading":
      return "Enviando…";
    case "queued":
      return item.queuePosition
        ? `Na fila (#${item.queuePosition})`
        : "Na fila";
    case "processing":
      if (item.pagesTotal && item.pagesTotal > 0) {
        const page = item.currentPage ?? item.pagesDone ?? 0;
        return `Processando página ${page}/${item.pagesTotal}`;
      }
      return item.message ?? "Processando…";
    case "completed":
      return "Concluído";
    case "failed":
      return item.error ?? "Falhou";
    default:
      return "";
  }
}

function StatusIcon({ status }: { status: QueueItemStatus }) {
  if (status === "completed") {
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />;
  }
  if (status === "failed") {
    return <XCircle className="h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />;
  }
  if (status === "queued") {
    return <Clock className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />;
  }
  if (status === "uploading" || status === "processing") {
    return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600" aria-hidden="true" />;
  }
  return <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />;
}

export function ProcessingQueuePanel({
  items,
  onSelectCompleted,
  selectedUploadId,
}: ProcessingQueuePanelProps) {
  if (items.length === 0) return null;

  const completedCount = items.filter((i) => i.status === "completed").length;
  const activeCount = items.filter(
    (i) => i.status === "uploading" || i.status === "queued" || i.status === "processing",
  ).length;

  return (
    <aside
      className="w-full shrink-0 rounded-xl border border-slate-200 bg-white shadow-sm lg:w-80"
      aria-label="Fila de processamento"
    >
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Fila de Processamento</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {completedCount}/{items.length} concluído(s)
          {activeCount > 0 ? ` · ${activeCount} em andamento` : ""}
        </p>
      </div>

      <ul className="max-h-[min(70vh,32rem)] divide-y divide-slate-100 overflow-y-auto">
        {items.map((item) => {
          const isSelectable = item.status === "completed" && Boolean(onSelectCompleted);
          const isSelected = selectedUploadId === item.uploadId;

          return (
            <li key={item.uploadId}>
              <button
                type="button"
                disabled={!isSelectable}
                onClick={() => isSelectable && onSelectCompleted?.(item)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition ${
                  isSelectable ? "cursor-pointer hover:bg-slate-50" : "cursor-default"
                } ${isSelected ? "bg-blue-50" : ""}`}
              >
                <StatusIcon status={item.status} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{item.filename}</p>
                  <p
                    className={`mt-0.5 text-xs ${
                      item.status === "failed" ? "text-red-600" : "text-slate-500"
                    }`}
                  >
                    {statusLabel(item)}
                  </p>
                  {item.status === "processing" && item.pagesTotal ? (
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all duration-300"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              ((item.pagesDone ?? 0) / item.pagesTotal) * 100,
                            ),
                          )}%`,
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
