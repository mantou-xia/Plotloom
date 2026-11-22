import { CitationSourcesFrame, type CitationSelection } from '@plotloom/ui/citation-sources-frame';

export type OpenCitations = (sources: CitationSelection['sources'], selectedId: string) => void;

export function CitationSourcesPage({ selection }: { selection: CitationSelection }) {
  return <CitationSourcesFrame selection={selection} />;
}
