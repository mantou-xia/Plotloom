import type { DocumentView } from './workspaces.ts';

export const CHARACTER_CARD_SECTIONS = ['性格特点', '愿景', '社会背景', '外表特点', '特殊性'] as const;
export type CharacterCardSection = typeof CHARACTER_CARD_SECTIONS[number];
export const CHARACTER_CARD_SUBSECTIONS = {
  性格特点: ['表征', '内在', '描写'],
  愿景: ['明示', '潜意识', '描写'],
  社会背景: [],
  外表特点: [],
  特殊性: ['心理特质', '口癖', '禁忌', '其他'],
} as const;

export interface CharacterCardStage extends DocumentView {
  createdAt: string;
  character: string;
  chapter: number;
  note: string;
  evidence?: CharacterCardEvidence;
}

export interface CharacterCardEvidence { path: string; quote: string }

export interface CharacterCardCreateRequest {
  character: string;
  chapter: number;
  note?: string;
  content: string;
  evidence?: CharacterCardEvidence;
}

export interface CharacterCardChangeRequest extends CharacterCardCreateRequest {
  evidence: CharacterCardEvidence;
}

export interface CharacterCardListResponse {
  cards: CharacterCardStage[];
  applicable: CharacterCardStage[];
}
