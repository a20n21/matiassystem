import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Anotações em Markdown (com tabelas, checklists e blocos de código).
 * HTML cru dentro do texto NÃO é interpretado: o react-markdown o escapa (sem risco de XSS).
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer noopener" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
