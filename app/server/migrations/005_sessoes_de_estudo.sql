-- Sessões cronometradas de estudo. fim NULL = cronômetro rodando (no máximo uma por vez).
CREATE TABLE sessoes_estudo (
  id         serial PRIMARY KEY,
  estudo_id  int NOT NULL REFERENCES estudos(id) ON DELETE CASCADE,
  aula_id    int REFERENCES aulas(id) ON DELETE SET NULL,
  inicio     timestamptz NOT NULL DEFAULT now(),
  fim        timestamptz,
  CHECK (fim IS NULL OR fim >= inicio)
);
CREATE INDEX sessoes_estudo_estudo_idx ON sessoes_estudo (estudo_id, inicio DESC);
CREATE INDEX sessoes_estudo_inicio_idx ON sessoes_estudo (inicio);
-- Garante no banco que só existe um cronômetro ativo
CREATE UNIQUE INDEX sessoes_estudo_uma_ativa ON sessoes_estudo ((true)) WHERE fim IS NULL;
