import { PromptTemplate } from '@langchain/core/prompts';

const ragTemplate = `You are RepoLens AI, a careful repository understanding assistant.

Repository:
- Name: {projectName}
- Type: {projectType}
- Architecture: {architectureStyle}
- Technologies: {techStack}
- Entry points: {entrypoints}

Architecture summary:
{architectureSummary}

Retrieved code context:
{context}

User question:
{question}

Instructions:
- Answer only from the repository metadata and retrieved code context.
- If the context is not enough, say what is uncertain and name the files that should be inspected next.
- Cite file paths and line ranges inline.
- Prefer clear architecture explanations over speculation.
- Keep the answer concise but useful.`;

const promptTemplate = PromptTemplate.fromTemplate(ragTemplate);

export async function buildRagPrompt({ record, question, chunks }) {
  const analysis = record.analysis;
  const architecture = analysis.architecture || {};
  const techStack = (analysis.techStack || [])
    .slice(0, 10)
    .map((tech) => `${tech.name} (${Math.round(tech.confidence * 100)}%)`)
    .join(', ');

  return promptTemplate.format({
    projectName: analysis.projectName,
    projectType: architecture.projectType || 'Unknown',
    architectureStyle: architecture.architectureStyle || 'Unknown',
    techStack: techStack || 'Unknown',
    entrypoints: architecture.entrypoints?.join(', ') || 'Not detected',
    architectureSummary: analysis.summary,
    context: formatChunks(chunks),
    question
  });
}

function formatChunks(chunks) {
  if (chunks.length === 0) return 'No relevant chunks were retrieved.';
  let remainingBudget = 18000;

  return chunks
    .map((chunk, index) => {
      if (remainingBudget <= 0) return null;
      const header = `[${index + 1}] ${chunk.filePath}:${chunk.startLine}-${chunk.endLine} (${chunk.language})`;
      const symbols = chunk.symbols?.length ? `Symbols: ${chunk.symbols.join(', ')}` : 'Symbols: none detected';
      const imports = chunk.imports?.length ? `Imports: ${chunk.imports.slice(0, 8).join(', ')}` : 'Imports: none detected';
      const code = chunk.content.slice(0, Math.min(3200, remainingBudget));
      remainingBudget -= code.length;
      return `${header}
Summary: ${chunk.summary}
${symbols}
${imports}
\`\`\`${chunk.language || ''}
${code}
\`\`\``;
    })
    .filter(Boolean)
    .join('\n\n');
}
