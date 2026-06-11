import { useNavigate } from "react-router-dom";
import {
  OrcamentoPdfWizard,
  type OrcamentoWizardResult,
} from "../components/orcamento/OrcamentoPdfWizard";
import { ANALISE_ABC_WIZARD_STEPS } from "../features/orcamentos/novoOrcamentoWizard";

export default function NovoOrcamento() {
  const navigate = useNavigate();

  const handleComplete = (result: OrcamentoWizardResult) => {
    navigate(`/validacao/${result.uploadId}`, {
      state: {
        file: result.file,
        uploadId: result.uploadId,
        selectedTableIds: result.selectedTableIds,
        selectedTablePreviews: result.selectedTablePreviews,
        extractedData: result.extractedData,
        structuredData: {
          items: result.structuredItems,
          hierarchicalItems: result.hierarchicalItems,
          resumo: result.resumo,
        },
        hierarchicalItems: result.hierarchicalItems,
        iaMetadata: result.iaMetadata,
      },
    });
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 pb-12 sm:px-6">
      <OrcamentoPdfWizard
        steps={ANALISE_ABC_WIZARD_STEPS}
        title="Análise Curva ABC"
        subtitle={`Passo 1 de ${ANALISE_ABC_WIZARD_STEPS.length} — envie um PDF ou vários editais; lotes seguem para a Lista de análises.`}
        processingLabel="Passo 3 — IA analisando tabelas e montando a Curva ABC…"
        logTag="Curva ABC"
        enableMultiUpload
        onBatchUpload={(files) => {
          navigate("/lista-analises", { state: { pendingFiles: files } });
        }}
        onComplete={handleComplete}
      />
    </div>
  );
}
