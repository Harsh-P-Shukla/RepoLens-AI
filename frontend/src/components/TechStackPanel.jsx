import { motion } from 'framer-motion';
import { Cpu } from 'lucide-react';
import { confidenceLabel } from '../utils/format.js';

export default function TechStackPanel({ techStack }) {
  return (
    <section className="glass-panel p-5">
      <div className="mb-4 flex items-center gap-2">
        <Cpu className="h-4 w-4 text-amberLens" />
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">Tech Stack</h2>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {techStack.length === 0 ? (
          <p className="text-sm text-white/50">No strong technology signals were found.</p>
        ) : (
          techStack.map((tech, index) => (
            <motion.div
              key={tech.name}
              className="border border-white/10 bg-white/[0.035] p-3"
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: index * 0.04 }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">{tech.name}</div>
                  <div className="mt-1 text-xs text-white/42">{tech.category}</div>
                </div>
                <span className="text-xs font-semibold text-cyanLens">{confidenceLabel(tech.confidence)}</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden bg-white/10">
                <div
                  className="h-full bg-gradient-to-r from-cyanLens via-mintLens to-amberLens"
                  style={{ width: `${Math.round(tech.confidence * 100)}%` }}
                />
              </div>
            </motion.div>
          ))
        )}
      </div>
    </section>
  );
}

