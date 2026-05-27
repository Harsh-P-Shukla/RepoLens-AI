import { useState } from 'react';
import { ChevronRight, FileCode2, Folder, FolderOpen } from 'lucide-react';

export default function FolderTree({ tree }) {
  return (
    <div className="max-h-[520px] overflow-auto pr-2 text-sm">
      <TreeNode node={tree} depth={0} defaultOpen />
    </div>
  );
}

function TreeNode({ node, depth, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen || depth < 2);
  const isDirectory = node.type === 'directory';
  const hasChildren = isDirectory && node.children?.length > 0;

  return (
    <div>
      <button
        className="group flex min-h-8 w-full min-w-0 items-center gap-2 text-left text-white/66 transition hover:text-white"
        onClick={() => hasChildren && setOpen((value) => !value)}
        style={{ paddingLeft: `${depth * 14}px` }}
        type="button"
      >
        {hasChildren ? (
          <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-white/35 transition ${open ? 'rotate-90' : ''}`} />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        {isDirectory ? (
          open ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-cyanLens/80" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-cyanLens/65" />
          )
        ) : (
          <FileCode2 className="h-4 w-4 shrink-0 text-mintLens/70" />
        )}
        <span className="truncate">{node.name}</span>
      </button>

      {open && hasChildren ? (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

