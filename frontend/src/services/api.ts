import axios from "axios";

const API_BASE = "http://localhost:8000";

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

// Upload PDF
export const uploadPDF = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await apiClient.post("/api/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || "Erro ao enviar arquivo");
  }
};

// Extrair tabelas
export const extractPDF = async (uploadId: string) => {
  try {
    const response = await apiClient.post("/api/extract", null, {
      params: { upload_id: uploadId },
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || "Erro ao extrair dados");
  }
};
