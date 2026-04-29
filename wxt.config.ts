import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react';

export default defineConfig({
  vite: () => ({
    plugins: [react()],
  }),
  manifest: {
    name: 'New Tab Home',
    description: '智能新标签页 - 书签管理与AI提示词模板',
    version: '1.0.0',
    permissions: ['storage', 'tabs', 'tabGroups', 'bookmarks'],
    chrome_url_overrides: {
      newtab: 'newtab/index.html',
    },
  },
});