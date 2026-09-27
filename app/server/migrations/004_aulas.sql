-- Aulas de um estudo (curso, livro, certificação): o checklist do que já foi assistido.
-- Quando um estudo tem aulas, progresso e status dele são calculados a partir delas.
CREATE TABLE aulas (
  id            serial PRIMARY KEY,
  estudo_id     int  NOT NULL REFERENCES estudos(id) ON DELETE CASCADE,
  titulo        text NOT NULL,
  concluida     boolean NOT NULL DEFAULT false,
  concluida_em  timestamptz,
  ordem         int  NOT NULL DEFAULT 0,
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX aulas_estudo_ordem_idx ON aulas (estudo_id, ordem);
