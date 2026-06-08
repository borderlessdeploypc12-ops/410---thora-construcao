import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import {
  deleteCatalogoProduto,
  listCatalogoByUserId,
  upsertCatalogoProduto,
} from "../features/catalogo/catalogoRepository";
import type {
  CatalogoProduto,
  CatalogoProdutoInput,
} from "../features/catalogo/catalogoTypes";
import { formatCurrencyBRL } from "../features/catalogo/catalogoUtils";
import { parseEditableNumber } from "../features/orcamentos/recalcularCurvaABC";
import { btnPrimary, btnSecondary } from "../components/ui/buttonClasses";
import ConfirmDialog from "../components/ConfirmDialog";

const EMPTY_FORM: CatalogoProdutoInput = {
  catalogCode: "",
  referenceCode: "",
  banco: "",
  tipo: "item",
  description: "",
  bdi: 0,
  unit: "un",
  unitPrice: 0,
};

const CatalogoProdutos: React.FC = () => {
  const { user } = useAuth();
  const [produtos, setProdutos] = useState<CatalogoProduto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CatalogoProdutoInput>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const data = await listCatalogoByUserId(user.uid);
      setProdutos(data);
    } catch (e: unknown) {
      toast.error("Falha ao carregar catálogo", {
        description: e instanceof Error ? e.message : "Erro desconhecido",
      });
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return produtos;
    return produtos.filter(
      (p) =>
        p.catalogCode.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.referenceCode ?? "").toLowerCase().includes(q) ||
        (p.banco ?? "").toLowerCase().includes(q),
    );
  }, [produtos, search]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const handleEdit = (p: CatalogoProduto) => {
    setEditingId(p.id);
    setForm({
      catalogCode: p.catalogCode,
      referenceCode: p.referenceCode ?? "",
      banco: p.banco ?? "",
      tipo: p.tipo,
      description: p.description,
      bdi: p.bdi,
      unit: p.unit,
      unitPrice: p.unitPrice,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;
    if (!form.catalogCode.trim() || !form.description.trim()) {
      toast.warning("Preencha código e descrição.");
      return;
    }
    setSaving(true);
    try {
      await upsertCatalogoProduto(user.uid, form, editingId ?? undefined);
      toast.success(editingId ? "Produto atualizado" : "Produto cadastrado");
      resetForm();
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteCatalogoProduto(deleteId);
      toast.success("Produto removido");
      if (editingId === deleteId) resetForm();
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir");
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <ConfirmDialog
        open={deleteId !== null}
        title="Remover produto?"
        description="Este item será excluído do catálogo permanentemente."
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteId(null)}
      />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 sm:text-3xl">
              <Package className="h-7 w-7 text-blue-600" />
              Meu Catálogo
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Cadastre seus produtos e serviços com preço próprio. Na validação do
              orçamento, informe o código do catálogo para preencher automaticamente e
              ver a economia em relação ao edital.
            </p>
          </div>
        </div>

        <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            {editingId ? "Editar produto" : "Novo produto"}
          </h2>
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
          >
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Código (seu) *</span>
              <input
                required
                value={form.catalogCode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, catalogCode: e.target.value }))
                }
                className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                placeholder="Ex: MURO-001"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Cód. referência</span>
              <input
                value={form.referenceCode ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, referenceCode: e.target.value }))
                }
                className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                placeholder="SINAPI / DER"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Banco</span>
              <input
                value={form.banco ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, banco: e.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="SINAPI, DER/DF…"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Tipo</span>
              <select
                value={form.tipo}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    tipo: e.target.value as CatalogoProdutoInput["tipo"],
                  }))
                }
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="item">Item</option>
                <option value="grupo">Grupo</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm md:col-span-2 lg:col-span-4">
              <span className="font-medium text-slate-700">Descrição *</span>
              <input
                required
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Descrição do serviço ou material"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">BDI (%)</span>
              <input
                type="number"
                step="0.01"
                min={0}
                value={form.bdi}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bdi: parseEditableNumber(e.target.value) }))
                }
                className="rounded-lg border border-slate-200 px-3 py-2 text-right text-sm tabular-nums"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Unidade</span>
              <input
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="m², m³, un…"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">V. unit. s/ BDI (seu preço)</span>
              <input
                type="number"
                step="0.01"
                min={0}
                value={form.unitPrice}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    unitPrice: parseEditableNumber(e.target.value),
                  }))
                }
                className="rounded-lg border border-slate-200 px-3 py-2 text-right text-sm tabular-nums"
              />
            </label>
            <div className="flex items-end gap-2 md:col-span-2 lg:col-span-1">
              <button type="submit" disabled={saving} className={`${btnPrimary} w-full`}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editingId ? (
                  "Salvar"
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Cadastrar
                  </>
                )}
              </button>
              {editingId && (
                <button type="button" onClick={resetForm} className={btnSecondary}>
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Produtos cadastrados ({filtered.length})
            </h2>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar código ou descrição…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm sm:max-w-xs"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Ref.</th>
                  <th className="px-4 py-3">Banco</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3 text-right">BDI</th>
                  <th className="px-4 py-3 text-center">Un.</th>
                  <th className="px-4 py-3 text-right">V. unit. s/ BDI</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                      <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
                      Carregando catálogo…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                      Nenhum produto cadastrado. Use o formulário acima.
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700">
                        {p.catalogCode}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        {p.referenceCode || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{p.banco || "—"}</td>
                      <td className="max-w-xs truncate px-4 py-3 text-slate-800" title={p.description}>
                        {p.description}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{p.bdi}%</td>
                      <td className="px-4 py-3 text-center">{p.unit}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {formatCurrencyBRL(p.unitPrice)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleEdit(p)}
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                            aria-label="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteId(p.id)}
                            className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                            aria-label="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CatalogoProdutos;
