import { prepare, layout, type PreparedText } from '@chenglou/pretext';

const font = '14px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif';
const config = {
  gap: 16,
  maxColWidth: 320,
  minColWidth: 260
};

type Card = {
  type: 'tab-group' | 'bookmark';
  domain?: string;
  title: string;
  tabs?: chrome.tabs.Tab[];
  bookmarks?: { title: string; url: string }[];
  prepared?: PreparedText;
};

const state = { cards: [] as Card[] };
const domCache = {
  container: document.getElementById('content-container')!,
  cards: [] as (HTMLElement | undefined)[],
};

const FRIENDLY_NAMES: Record<string, string> = {
  'github.com': 'GitHub', 'youtube.com': 'YouTube', 'x.com': 'X', 'twitter.com': 'X',
  'reddit.com': 'Reddit', 'linkedin.com': 'LinkedIn', 'stackoverflow.com': 'Stack Overflow',
  'google.com': 'Google', 'mail.google.com': 'Gmail', 'chatgpt.com': 'ChatGPT',
  'claude.ai': 'Claude', 'notion.so': 'Notion', 'figma.com': 'Figma', 'slack.com': 'Slack',
  'discord.com': 'Discord', 'bilibili.com': 'B站', 'zhihu.com': '知乎', 'juejin.cn': '掘金',
};

function friendlyName(hostname: string): string {
  return FRIENDLY_NAMES[hostname] || hostname.replace(/^www\./, '');
}

function cleanTitle(title: string, url: string): string {
  if (!title || !url) return title || '';
  try {
    const hostname = new URL(url).hostname;
    const seps = [' - ', ' | ', ' — ', ' · '];
    for (const sep of seps) {
      const idx = title.lastIndexOf(sep);
      if (idx !== -1) {
        const suffix = title.slice(idx + sep.length).trim().toLowerCase();
        if (suffix === hostname.replace(/^www\./, '') || suffix === friendlyName(hostname).toLowerCase()) {
          return title.slice(0, idx).trim();
        }
      }
    }
  } catch {}
  return title;
}

function stripNoise(title: string): string {
  return title.replace(/^\(\d+\+?\)\s*/, '').trim();
}

function getFavicon(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

function isRealTab(url: string): boolean {
  return !url.startsWith('chrome://') && !url.startsWith('chrome-extension://') && !url.startsWith('about:');
}

function createCardNode(card: Card, index: number): HTMLElement {
  const node = document.createElement('div');
  node.className = 'card';
  node.dataset.index = String(index);
  
  if (card.type === 'tab-group' && card.tabs) {
    const tabsHtml = card.tabs.map(t => {
      const title = cleanTitle(stripNoise(t.title || ''), t.url || '');
      const isActive = t.active;
      return `<div class="tab-chip ${isActive ? 'active' : ''}" data-id="${t.id}"><img src="${t.favIconUrl || getFavicon(card.domain!)}"><span>${title}</span><span class="close" data-id="${t.id}">✕</span></div>`;
    }).join('');
    
    node.innerHTML = `
      <div class="card-content">
        <div class="card-title" data-domain="${card.domain}">
          <img src="${getFavicon(card.domain!)}"> ${card.title} 
          <span class="tab-count">${card.tabs.length}</span>
        </div>
        <div class="tab-list">${tabsHtml}</div>
        <div class="card-actions">
          <button class="close-all-btn">关闭全部</button>
        </div>
      </div>`;
  } else if (card.type === 'bookmark' && card.bookmarks) {
    const bmsHtml = card.bookmarks.map(b => {
      try {
        const domain = new URL(b.url).hostname;
        return `<a class="bookmark-item" href="${b.url}" target="_blank"><img src="${getFavicon(domain)}"><span>${b.title}</span></a>`;
      } catch { return ''; }
    }).join('');
    
    node.innerHTML = `
      <div class="card-content">
        <div class="folder-header">
          <span class="folder-icon">📂</span>
          <span class="folder-title">${card.title}</span>
          <span class="folder-count">${card.bookmarks.length}</span>
        </div>
        <div class="bookmark-list">${bmsHtml}</div>
      </div>`;
  }
  
  return node;
}

function renderMasonry() {
  const windowWidth = document.documentElement.clientWidth;
  const paddingX = windowWidth < 600 ? 16 : 40;
  const availableWidth = windowWidth - paddingX * 2;
  
  let colCount = Math.max(1, Math.floor((availableWidth + config.gap) / (config.minColWidth + config.gap)));
  colCount = Math.min(colCount, 8);
  
  let colWidth = Math.floor((availableWidth - (colCount - 1) * config.gap) / colCount);
  colWidth = Math.min(colWidth, config.maxColWidth);

  const contentWidth = colCount * colWidth + (colCount - 1) * config.gap;
  const offsetLeft = Math.floor((windowWidth - contentWidth) / 2);

  const colHeights = new Array(colCount).fill(0);

  // 1. 插入 DOM 获取高度
  state.cards.forEach((card, i) => {
    let node = domCache.cards[i];
    if (!node) {
      node = createCardNode(card, i);
      domCache.container.appendChild(node);
      domCache.cards[i] = node;
    }
    node.style.width = `${colWidth}px`;
  });

  // 2. 计算坐标
  state.cards.forEach((card, i) => {
    const node = domCache.cards[i]!;
    const cardHeight = node.offsetHeight;

    let shortestCol = 0;
    for (let c = 1; c < colCount; c++) {
      if (colHeights[c] < colHeights[shortestCol]) shortestCol = c;
    }

    const x = offsetLeft + shortestCol * (colWidth + config.gap);
    const y = colHeights[shortestCol];

    node.style.transform = `translate(${x}px, ${y}px)`;
    colHeights[shortestCol] += cardHeight + config.gap;
  });

  const maxContentHeight = Math.max(...colHeights);
  domCache.container.style.height = `${maxContentHeight}px`;
}

let resizeTimer: number;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => requestAnimationFrame(renderMasonry), 100);
});

async function loadData() {
  const tabs = (await chrome.tabs.query({})).filter(t => isRealTab(t.url || ''));
  const groups: Record<string, { domain: string; tabs: chrome.tabs.Tab[] }> = {};
  for (const tab of tabs) {
    try {
      const hostname = new URL(tab.url!).hostname;
      if (!groups[hostname]) groups[hostname] = { domain: hostname, tabs: [] };
      groups[hostname].tabs.push(tab);
    } catch {}
  }

  const sortedGroups = Object.values(groups).sort((a, b) => b.tabs.length - a.tabs.length);
  
  state.cards = sortedGroups.map(g => ({
    type: 'tab-group' as const,
    domain: g.domain,
    title: friendlyName(g.domain),
    tabs: g.tabs,
    prepared: prepare(`${friendlyName(g.domain)} ${g.tabs.length} tabs`, font),
  }));

  // 书签
  try {
    const tree = await chrome.bookmarks.getTree();
    const folders: { title: string; bookmarks: { title: string; url: string }[] }[] = [];
    function extract(node: chrome.bookmarks.BookmarkTreeNode) {
      if (node.children) {
        const bookmarks: { title: string; url: string }[] = [];
        function collect(children: chrome.bookmarks.BookmarkTreeNode[]) {
          for (const child of children) {
            if (child.url) bookmarks.push({ title: child.title, url: child.url });
            if (child.children) collect(child.children);
          }
        }
        collect(node.children);
        if (bookmarks.length > 0) {
          folders.push({ title: node.title || '书签', bookmarks: bookmarks.slice(0, 15) });
        }
        if (folders.length >= 6) return;
        for (const child of node.children) {
          if (folders.length >= 6) break;
          extract(child);
        }
      }
    }
    for (const node of tree) {
      if (folders.length >= 6) break;
      extract(node);
    }
    for (const folder of folders) {
      state.cards.push({
        type: 'bookmark',
        title: folder.title,
        bookmarks: folder.bookmarks,
        prepared: prepare(`${folder.title} ${folder.bookmarks.length}`, font),
      });
    }
  } catch {}

  requestAnimationFrame(renderMasonry);
}

async function createTab(domain: string, mode: 'tab' | 'window' | 'split' = 'tab') {
  const url = domain.includes('.') ? `https://${domain}` : `https://${domain}.com`;
  const currentWin = await chrome.windows.getCurrent();
  const w = Math.floor((currentWin.width || 1200) / 2);
  if (mode === 'split') {
    await chrome.windows.create({ url, focused: true, left: (currentWin.left || 0) + w, width: w, top: currentWin.top || 0, height: currentWin.height || 800 });
  } else if (mode === 'window') {
    await chrome.windows.create({ url, focused: true });
  } else {
    await chrome.tabs.create({ url });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const dateEl = document.getElementById('dateDisplay')!;
  dateEl.textContent = new Date().toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  document.body.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const cardTitle = target.closest('.card-title');
    const closeBtn = target.closest('.tab-chip .close');
    const chip = target.closest('.tab-chip');
    const closeAllBtn = target.closest('.close-all-btn');

    if (cardTitle) {
      e.preventDefault();
      const domain = (cardTitle as HTMLElement).dataset.domain || '';
      const mode = e.ctrlKey ? 'split' : e.shiftKey ? 'window' : 'tab';
      await createTab(domain, mode);
      return;
    }
    if (closeBtn) {
      e.stopPropagation();
      const tabId = parseInt((closeBtn as HTMLElement).dataset.id || '0');
      await chrome.tabs.remove(tabId);
      location.reload();
      return;
    }
    if (chip && !closeBtn) {
      e.preventDefault();
      const tabId = parseInt((chip as HTMLElement).dataset.id || '0');
      const tab = await chrome.tabs.get(tabId);
      if (tab.windowId) await chrome.windows.update(tab.windowId, { focused: true });
      await chrome.tabs.update(tabId, { active: true });
      return;
    }
    if (closeAllBtn) {
      e.preventDefault();
      const domain = (closeAllBtn as HTMLElement).dataset.domain || '';
      const tabs = await chrome.tabs.query({});
      const toClose = tabs.filter(t => { try { return new URL(t.url!).hostname === domain; } catch { return false; } }).map(t => t.id);
      if (toClose.length > 0) { await chrome.tabs.remove(toClose); location.reload(); }
    }
  });

  loadData();
});