import { FileCode2, Loader2 } from 'lucide-react';
import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export default function SourcePreview({ preview, loading }) {
  return (
    <div className="min-h-0 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
        <div className="flex min-w-0 items-center gap-2">
          <FileCode2 className="h-4 w-4 shrink-0 text-cyanLens" />
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/42">Source Preview</div>
            <div className="mt-1 truncate text-sm text-white/70">{preview?.filePath || 'No citation selected'}</div>
          </div>
        </div>
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-cyanLens" /> : null}
      </div>

      <div className="h-[470px] overflow-auto p-4">
        {!preview && !loading ? (
          <div className="grid h-full place-items-center text-center text-sm leading-6 text-white/42">
            Click a citation or search result to inspect the indexed code chunk.
          </div>
        ) : null}

        {preview?.snippets?.map((snippet) => (
          <div className="mb-4" key={snippet.chunkId}>
            <div className="mb-2 flex items-center justify-between gap-3 text-xs text-white/42">
              <span>
                Lines {snippet.startLine}-{snippet.endLine}
              </span>
              <span className="truncate">{snippet.summary}</span>
            </div>
            <SyntaxHighlighter
              PreTag="div"
              customStyle={{
                margin: 0,
                borderRadius: 8,
                background: '#080b10',
                border: '1px solid rgba(255,255,255,0.08)',
                fontSize: 12
              }}
              language={preview.language || 'text'}
              showLineNumbers
              startingLineNumber={snippet.startLine}
              style={vscDarkPlus}
              wrapLongLines
            >
              {snippet.content}
            </SyntaxHighlighter>
          </div>
        ))}
      </div>
    </div>
  );
}
