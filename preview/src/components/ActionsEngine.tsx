import React from 'react';

// ---------------------------------------------------------------------------
// ACTIONS ENGINE — retired from the Active screen.
//
// "How Brief works" and the channel-ingest cards explained the pipeline to
// the product, not to a host. They added no action. The component stays
// mounted so App.tsx does not change shape; it renders nothing.
// ---------------------------------------------------------------------------

interface Capabilities {
  telegram?: { configured?: boolean };
  whatsapp?: { configured?: boolean };
}

interface PipelineStats {
  rawItems?: number;
  objects?: number;
  relationships?: number;
  sources?: number;
  lastSyncRuns?: { connector?: string; at?: string }[];
}

export interface ActionsEngineProps {
  online: boolean;
  checked: boolean;
  capabilities: Capabilities | null;
  liveSourceCount: number;
  stats: PipelineStats | null;
}

export function ActionsEngine(_props: ActionsEngineProps) {
  return null;
}

export default ActionsEngine;
