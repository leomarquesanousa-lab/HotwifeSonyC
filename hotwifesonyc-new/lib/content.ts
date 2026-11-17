import { readContent } from './store.mjs';
export type VideoEntry = { id: string; number: number; title: string; participantsRaw: string; participants: string[]; duration: string; sourcePage: number; platformUrl: string | null; status: 'active' | 'inactive' | 'review'; reviewNotes: string; checkedAgainstSource: boolean };
export type Photo = { image: string; alt: string };
export type Pick = Photo & { id: string; order: number; title: string; description: string; url: string | null; active: boolean };
export type Platform = { id: string; name: string; url: string | null; label: string; active: boolean };
export type Site = { name: string; slogan: string; introduction: string; biography: string | null; hero: Photo; portrait: Photo; platforms: Platform[]; picks: Pick[] };
export type Content = { site: Site; catalog: VideoEntry[]; revision: string };
export async function getContent(): Promise<Content> { return readContent(); }
