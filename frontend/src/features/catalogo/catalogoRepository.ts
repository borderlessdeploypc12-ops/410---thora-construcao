import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import type { CatalogoProduto, CatalogoProdutoInput } from "./catalogoTypes";
import { normalizeCatalogCode } from "./catalogoUtils";

const COLLECTION = "catalogo_produtos";

const toDate = (value: unknown): Date => {
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const maybe = value as { toDate?: () => Date };
    if (typeof maybe.toDate === "function") return maybe.toDate();
  }
  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date(0);
};

const mapDoc = (snap: QueryDocumentSnapshot<DocumentData>): CatalogoProduto => {
  const data = snap.data() ?? {};
  return {
    id: snap.id,
    userId: String(data.userId ?? ""),
    catalogCode: String(data.catalogCode ?? ""),
    referenceCode:
      typeof data.referenceCode === "string" ? data.referenceCode : undefined,
    banco: typeof data.banco === "string" ? data.banco : undefined,
    tipo: (data.tipo as CatalogoProduto["tipo"]) ?? "item",
    description: String(data.description ?? ""),
    bdi: Number(data.bdi ?? 0),
    unit: String(data.unit ?? "un"),
    unitPrice: Number(data.unitPrice ?? 0),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
};

export async function listCatalogoByUserId(
  userId: string,
): Promise<CatalogoProduto[]> {
  const q = query(
    collection(db, COLLECTION),
    where("userId", "==", userId),
  );
  try {
    const snap = await getDocs(q);
    return snap.docs
      .map(mapDoc)
      .sort((a, b) => a.catalogCode.localeCompare(b.catalogCode, "pt-BR"));
  } catch (error) {
    console.error("[Catalogo] Falha ao listar produtos:", error);
    throw error;
  }
}

export async function upsertCatalogoProduto(
  userId: string,
  input: CatalogoProdutoInput,
  documentId?: string,
): Promise<string> {
  const catalogCode = normalizeCatalogCode(input.catalogCode);
  if (!catalogCode) {
    throw new Error("Código do produto é obrigatório.");
  }

  const docId =
    documentId ??
    `${userId}_${catalogCode.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

  const now = new Date();
  const payload = {
    userId,
    catalogCode,
    referenceCode: input.referenceCode?.trim() || null,
    banco: input.banco?.trim() || null,
    tipo: input.tipo ?? "item",
    description: input.description.trim(),
    bdi: Number(input.bdi) || 0,
    unit: input.unit.trim() || "un",
    unitPrice: Number(input.unitPrice) || 0,
    updatedAt: now,
    ...(documentId ? {} : { createdAt: now }),
  };

  await setDoc(doc(db, COLLECTION, docId), payload, { merge: true });
  return docId;
}

export async function deleteCatalogoProduto(documentId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, documentId));
}
