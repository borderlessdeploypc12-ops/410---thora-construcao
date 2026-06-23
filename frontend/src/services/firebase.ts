import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDgjwin-zXFzl-J-E7dlxvjmEGe6C_xhMU",
  authDomain: "borderless-5a4c8.firebaseapp.com",
  projectId: "borderless-5a4c8",
  storageBucket: "borderless-5a4c8.firebasestorage.app",
  messagingSenderId: "333573409559",
  appId: "1:333573409559:web:34295766534d7e6b8d4552",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const analytics =
  "measurementId" in firebaseConfig ? getAnalytics(app) : undefined;

// Firebase Auth (protects backend endpoints)
const auth = getAuth(app);

let cachedIdToken: string | null = null;
let cachedIdTokenExpiresAt = 0;
let idTokenFetchPromise: Promise<string> | null = null;

const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

const decodeJwtExpiryMs = (token: string): number => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? ""));
    const exp = Number(payload.exp);
    return Number.isFinite(exp) ? exp * 1000 : 0;
  } catch {
    return 0;
  }
};

const clearCachedIdToken = () => {
  cachedIdToken = null;
  cachedIdTokenExpiresAt = 0;
  idTokenFetchPromise = null;
};

auth.onAuthStateChanged(() => {
  clearCachedIdToken();
});

/** Aguarda Firebase Auth resolver a sessão (evita upload com usuário anônimo). */
export const waitForAuthReady = (timeoutMs = 8000): Promise<void> =>
  new Promise((resolve) => {
    if (auth.currentUser) {
      resolve();
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      resolve();
    };

    const unsubscribe = auth.onAuthStateChanged(() => finish());
    const timer = window.setTimeout(finish, timeoutMs);
  });

export const ensureAuthToken = async (forceRefresh = false): Promise<string> => {
  await waitForAuthReady();
  const user = auth.currentUser;
  if (!user) return "";

  const now = Date.now();
  if (
    !forceRefresh &&
    cachedIdToken &&
    cachedIdTokenExpiresAt - TOKEN_REFRESH_MARGIN_MS > now
  ) {
    return cachedIdToken;
  }

  if (idTokenFetchPromise) {
    return idTokenFetchPromise;
  }

  idTokenFetchPromise = (async () => {
    try {
      const token = await user.getIdToken(forceRefresh);
      cachedIdToken = token;
      cachedIdTokenExpiresAt = decodeJwtExpiryMs(token) || now + 55 * 60 * 1000;
      return token;
    } finally {
      idTokenFetchPromise = null;
    }
  })();

  return idTokenFetchPromise;
};

// ==================== INTERFACES ====================

export interface ExtractedItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitValue: number;
  totalValue: number;
}

export interface OrcamentoRecord {
  id?: string;
  uploadId: string;
  filename: string;
  uploadedAt: Date;
  extractedAt?: Date;
  items: ExtractedItem[];
  tablesFound: number;
  status: "processing" | "completed" | "error";
  errorMessage?: string;
}

// ==================== FIRESTORE OPERATIONS ====================

/**
 * Salvar orçamento extraído do PDF
 */
export const saveOrcamento = async (data: OrcamentoRecord) => {
  try {
    const docRef = await addDoc(collection(db, "orcamentos"), {
      uploadId: data.uploadId,
      filename: data.filename,
      uploadedAt: data.uploadedAt,
      extractedAt: new Date(),
      items: data.items,
      tablesFound: data.tablesFound,
      status: data.status || "completed",
      errorMessage: data.errorMessage || null,
    });
    console.log("✅ Orçamento salvo:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("❌ Erro ao salvar orçamento:", error);
    throw error;
  }
};

/**
 * Buscar orçamentos por uploadId
 */
export const getOrcamentoByUploadId = async (uploadId: string) => {
  try {
    const q = query(
      collection(db, "orcamentos"),
      where("uploadId", "==", uploadId),
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
    } as OrcamentoRecord & { id: string };
  } catch (error) {
    console.error("❌ Erro ao buscar orçamento:", error);
    throw error;
  }
};

/**
 * Listar todos os orçamentos
 */
export const getAllOrcamentos = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "orcamentos"));
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as (OrcamentoRecord & { id: string })[];
  } catch (error) {
    console.error("❌ Erro ao listar orçamentos:", error);
    throw error;
  }
};

/**
 * Atualizar orçamento
 */
export const updateOrcamento = async (
  documentId: string,
  data: Partial<OrcamentoRecord>,
) => {
  try {
    await updateDoc(doc(db, "orcamentos", documentId), {
      ...data,
      updatedAt: new Date(),
    });
    console.log("✅ Orçamento atualizado:", documentId);
  } catch (error) {
    console.error("❌ Erro ao atualizar orçamento:", error);
    throw error;
  }
};

/**
 * Deletar orçamento
 */
export const deleteOrcamento = async (documentId: string) => {
  try {
    await deleteDoc(doc(db, "orcamentos", documentId));
    console.log("✅ Orçamento deletado:", documentId);
  } catch (error) {
    console.error("❌ Erro ao deletar orçamento:", error);
    throw error;
  }
};

export { db, app, auth };
