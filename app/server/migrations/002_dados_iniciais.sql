-- Ponto de partida: as trilhas e o roadmap que estavam na página estática
INSERT INTO trilhas (nome, descricao, cor, ordem) VALUES
  ('Kubernetes',      'Cluster kind, workloads, rede, HPA e operação.',           '#38bdf8', 1),
  ('GitOps & CI/CD',  'Argo CD, GitHub Actions e promoção entre ambientes.',       '#a78bfa', 2),
  ('DevSecOps',       'Segurança do commit ao cluster e à aplicação rodando.',     '#f472b6', 3),
  ('Observabilidade', 'Métricas, dashboards e logs centralizados.',               '#fbbf24', 4),
  ('Terraform',       'Infraestrutura como código: módulos e estado remoto.',      '#34d399', 5),
  ('AWS',             'Fundamentos de cloud: IAM, redes e containers.',            '#fb923c', 6);

INSERT INTO estudos (trilha_id, titulo, resumo, status, progresso, tags, concluido_em, notas) VALUES
  ((SELECT id FROM trilhas WHERE nome = 'Kubernetes'),
   'Cluster local com kind', 'Criar e operar um cluster Kubernetes leve no Docker.',
   'concluido', 100, '{kind,docker}', now(),
E'## Criar o cluster\n\n```powershell\nkind create cluster --config kind-cluster.yaml\nkubectl get nodes\n```\n\n## Aprendizados\n\n- O Kubernetes 1.35+ exige **cgroup v2**; no WSL com cgroup v1, fixar a imagem `kindest/node:v1.34`.\n- `extraPortMappings` expõe as portas 80/443 do Windows para o Ingress.\n'),
  ((SELECT id FROM trilhas WHERE nome = 'GitOps & CI/CD'),
   'Argo CD com app of apps', 'Uma Application raiz que instala todas as outras a partir do Git.',
   'concluido', 100, '{argocd,gitops}', now(),
E'## Ideia central\n\nO que está no Git é o que roda no cluster. O `root.yaml` é o único manifesto aplicado à mão.\n\n## Comandos úteis\n\n```powershell\nkubectl -n argocd get applications\n```\n'),
  ((SELECT id FROM trilhas WHERE nome = 'DevSecOps'),
   'Políticas com Kyverno', 'ValidatingPolicy em CEL para barrar pods inseguros.',
   'estudando', 60, '{kyverno,cel}', NULL,
E'## O que as políticas exigem\n\n- `runAsNonRoot`, sem escalonamento de privilégio\n- rootfs somente leitura e `drop: [ALL]`\n- limites de CPU e memória\n- imagens só de registries permitidos, sem `:latest`\n\n> Testar offline com o Kyverno CLI antes de aplicar no cluster.\n'),
  ((SELECT id FROM trilhas WHERE nome = 'Observabilidade'),
   'Prometheus e Grafana', 'Métricas dos ambientes e dashboards.',
   'planejado', 0, '{prometheus,grafana}', NULL, '');

INSERT INTO roadmap_itens (trilha_id, titulo, descricao, status, periodo, ordem) VALUES
  ((SELECT id FROM trilhas WHERE nome = 'Kubernetes'),      'Cluster kind com Traefik e metrics-server', '', 'feito', '2026 T3', 1),
  ((SELECT id FROM trilhas WHERE nome = 'GitOps & CI/CD'),  'Argo CD com app of apps', '', 'feito', '2026 T3', 2),
  ((SELECT id FROM trilhas WHERE nome = 'GitOps & CI/CD'),  'Esteira dev → hml → prod com aprovação', '', 'feito', '2026 T3', 3),
  ((SELECT id FROM trilhas WHERE nome = 'DevSecOps'),       'Trivy, gitleaks, Kyverno e ZAP', '', 'feito', '2026 T3', 4),
  (NULL,                                                    'App de estudos com login e banco', 'Node, React e Postgres na esteira.', 'andamento', '2026 T3', 1),
  ((SELECT id FROM trilhas WHERE nome = 'Observabilidade'), 'Prometheus e Grafana', '', 'proximo', '2026 T4', 1),
  ((SELECT id FROM trilhas WHERE nome = 'DevSecOps'),       'Secrets com Sealed Secrets', '', 'proximo', '2026 T4', 2),
  ((SELECT id FROM trilhas WHERE nome = 'Terraform'),       'Módulos e estado remoto', '', 'proximo', '2027 T1', 3);
