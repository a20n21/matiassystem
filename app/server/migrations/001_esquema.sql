CREATE TABLE trilhas (
  id          serial PRIMARY KEY,
  nome        text NOT NULL UNIQUE,
  descricao   text NOT NULL DEFAULT '',
  cor         text NOT NULL DEFAULT '#38bdf8',
  ordem       int  NOT NULL DEFAULT 0,
  criado_em   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE estudos (
  id             serial PRIMARY KEY,
  trilha_id      int REFERENCES trilhas(id) ON DELETE SET NULL,
  titulo         text NOT NULL,
  resumo         text NOT NULL DEFAULT '',
  status         text NOT NULL DEFAULT 'planejado'
                 CHECK (status IN ('planejado', 'estudando', 'concluido')),
  progresso      int  NOT NULL DEFAULT 0 CHECK (progresso BETWEEN 0 AND 100),
  notas          text NOT NULL DEFAULT '',
  tags           text[] NOT NULL DEFAULT '{}',
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  concluido_em   timestamptz
);
CREATE INDEX estudos_trilha_idx ON estudos (trilha_id);

CREATE TABLE roadmap_itens (
  id             serial PRIMARY KEY,
  trilha_id      int REFERENCES trilhas(id) ON DELETE SET NULL,
  titulo         text NOT NULL,
  descricao      text NOT NULL DEFAULT '',
  status         text NOT NULL DEFAULT 'proximo'
                 CHECK (status IN ('proximo', 'andamento', 'feito')),
  periodo        text NOT NULL DEFAULT '',
  ordem          int  NOT NULL DEFAULT 0,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now()
);

-- id = sha256 do token do cookie (o token em si nunca é gravado)
CREATE TABLE sessoes (
  id         text PRIMARY KEY,
  expira_em  timestamptz NOT NULL,
  criado_em  timestamptz NOT NULL DEFAULT now()
);
