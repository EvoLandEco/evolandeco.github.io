import type { AtlasSiteBundle as Version14, AtlasSelectionView as View14 } from '../1.4/site-types';
export type AtlasSiteBundle = Omit<Version14, 'contract_version' | 'one_health_reviews' | 'one_health_nodes' | 'one_health_relations'> & { contract_version: '1.3.0' };
export type AtlasSelectionView = Omit<View14, 'one_health'>;
export declare function selectView(data: AtlasSiteBundle, from: string, until: string, basis?: 'publication' | 'capture', knowledgeCutoff?: string | null, recordSelection?: string[] | null): AtlasSelectionView;
