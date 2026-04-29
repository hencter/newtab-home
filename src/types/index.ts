export interface Bookmark {
  id: string;
  title: string;
  url: string;
  favicon?: string;
  domain: string;
  createdAt: number;
}

export interface PromptTemplate {
  id: string;
  title: string;
  content: string;
  createdAt: number;
}

export interface StorageData {
  bookmarks: Bookmark[];
  prompts: PromptTemplate[];
}