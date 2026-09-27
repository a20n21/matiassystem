import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, HardDriveDownload, Layers, Upload } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router';
import { api } from '../api';
import { useToast } from '../components/Toasts';
import { ConfirmDialog } from '../components/ui';

type Backup = { versao: number; exportado_em?: string; trilhas: unknown[]; estudos: unknown[]; roadmap: unknown[] };

export function Configuracoes() {
  const qc = useQueryClient();
  const toast = useToast();
  const [importando, setImportando] = useState<Backup | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportar = useMutation({
    mutationFn: () => api.get<Backup>('/api/dados/exportar'),
    onSuccess: (dados) => {
      const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `matiassystem-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Backup baixado');
    },
    onError: (e) => toast(e.message, 'erro'),
  });

  const importar = useMutation({
    mutationFn: (dados: Backup) => api.post<{ trilhas: number; estudos: number; roadmap: number }>('/api/dados/importar', dados),
    onSuccess: (r) => {
      qc.invalidateQueries();
      toast(`Importado: ${r.estudos} estudos, ${r.trilhas} trilhas, ${r.roadmap} itens do roadmap`);
      setImportando(null);
    },
  });

  async function escolherArquivo(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = ''; // permite escolher o mesmo arquivo de novo
    if (!arquivo) return;
    try {
      const dados = JSON.parse(await arquivo.text()) as Backup;
      if (dados.versao !== 1 || !Array.isArray(dados.estudos)) throw new Error('formato de backup desconhecido');
      setImportando(dados);
    } catch {
      toast('Arquivo inválido: use um backup exportado por este app', 'erro');
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Configurações</h1>
          <p className="page-sub">Cópia de segurança dos seus dados.</p>
        </div>
      </header>

      <section className="card">
        <div className="card-title"><h2><HardDriveDownload size={17} />Cópia de segurança</h2></div>
        <p className="page-sub">
          O banco fica dentro do cluster local: se o cluster for apagado, os dados vão junto.
          Exporte um backup de vez em quando e guarde o arquivo.
        </p>
        <div className="backup-actions">
          <button className="btn btn-primary" onClick={() => exportar.mutate()} disabled={exportar.isPending}>
            <Download size={16} />{exportar.isPending ? 'Exportando…' : 'Exportar backup'}
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}><Upload size={16} />Importar backup</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={escolherArquivo} />
        </div>
      </section>

      <section className="card">
        <div className="card-title"><h2><Layers size={17} />Trilhas</h2></div>
        <p className="page-sub">Criar, editar e excluir trilhas agora fica na página <Link to="/trilhas">Trilhas</Link>.</p>
      </section>

      {importando && (
        <ConfirmDialog title="Importar backup" confirmLabel="Substituir tudo"
          message={<>
            O backup{importando.exportado_em && ` de ${new Date(importando.exportado_em).toLocaleString('pt-BR')}`} tem{' '}
            <strong>{importando.estudos.length} estudos</strong>, {importando.trilhas.length} trilhas e{' '}
            {importando.roadmap.length} itens do roadmap. <strong>Todos os dados atuais serão substituídos.</strong>
            {importar.error && <div className="error-box import-error">{importar.error.message}</div>}
          </>}
          onConfirm={() => importar.mutate(importando)} onClose={() => setImportando(null)} busy={importar.isPending} />
      )}
    </div>
  );
}
