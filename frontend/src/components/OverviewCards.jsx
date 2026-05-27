import { Blocks, Braces, FolderGit2, Network } from 'lucide-react';
import StatCard from './StatCard.jsx';
import { formatBytes, formatNumber } from '../utils/format.js';

export default function OverviewCards({ analysis }) {
  const topTech = analysis.techStack[0]?.name || 'Unknown';

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        accent="cyan"
        icon={Blocks}
        label="Top Technology"
        value={topTech}
        detail={`${analysis.techStack.length} technologies detected`}
      />
      <StatCard
        accent="mint"
        icon={FolderGit2}
        label="Analyzed Files"
        value={formatNumber(analysis.stats.totalFiles)}
        detail={`${formatBytes(analysis.stats.totalSizeBytes)} source footprint`}
      />
      <StatCard
        accent="amber"
        icon={Network}
        label="Dependency Graph"
        value={formatNumber(analysis.dependencyGraph.nodes.length)}
        detail={`${formatNumber(analysis.dependencyGraph.edges.length)} relationships`}
      />
      <StatCard
        accent="rose"
        icon={Braces}
        label="Architecture"
        value={analysis.architecture.architectureStyle}
        detail={analysis.architecture.graphHealth.parser}
      />
    </div>
  );
}

