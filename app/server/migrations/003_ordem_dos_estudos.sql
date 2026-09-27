-- Ordem dos estudos dentro da trilha (o checklist da trilha segue esta ordem)
ALTER TABLE estudos ADD COLUMN ordem int NOT NULL DEFAULT 0;

-- Estudos existentes: ordem de criação dentro de cada trilha
UPDATE estudos e SET ordem = o.pos
FROM (
  SELECT id, row_number() OVER (PARTITION BY trilha_id ORDER BY criado_em, id) AS pos
  FROM estudos
) o
WHERE e.id = o.id;

CREATE INDEX estudos_trilha_ordem_idx ON estudos (trilha_id, ordem);
