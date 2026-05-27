import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export default function MarkdownMessage({ content }) {
  return (
    <div className="markdown-body text-sm leading-6 text-white/76">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            if (!inline && match) {
              return (
                <SyntaxHighlighter
                  PreTag="div"
                  customStyle={{
                    margin: '0.75rem 0',
                    borderRadius: 8,
                    background: '#080b10',
                    border: '1px solid rgba(255,255,255,0.08)'
                  }}
                  language={match[1]}
                  style={vscDarkPlus}
                  {...props}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              );
            }

            return (
              <code className="border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-cyanLens" {...props}>
                {children}
              </code>
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
