document.addEventListener('DOMContentLoaded', () => {
  const FRIENDLY_NAMES: Record<string, string> = {
    'github.com': 'GitHub',
    'youtube.com': 'YouTube',
    'x.com': 'X',
    'twitter.com': 'X',
    'reddit.com': 'Reddit',
    'linkedin.com': 'LinkedIn',
    'stackoverflow.com': 'Stack Overflow',
    'google.com': 'Google',
    'mail.google.com': 'Gmail',
    'chatgpt.com': 'ChatGPT',
    'chat.openai.com': 'ChatGPT',
    'claude.ai': 'Claude',
    'notion.so': 'Notion',
    'figma.com': 'Figma',
    'slack.com': 'Slack',
    'discord.com': 'Discord',
  };

  function friendlyName(hostname: string): string {
    if (!hostname) return '';
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
    if (!title) return '';
    return title.replace(/^\(\d+\+?\)\s*/, '').trim();
  }

  function isRealTab(url: string): boolean {
    if (!url) return false;
    return !url.startsWith('chrome://') && 
           !url.startsWith('chrome-extension://') && 
           !url.startsWith('about:');
  }

  function getFavicon(domain: string): string {
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  }

  async function fetchOpenTabs() {
    const tabs = await chrome.tabs.query({});
    return tabs.filter(t => isRealTab(t.url || ''));
  }

  async function focusTab(tabId: number) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.windowId) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
    await chrome.tabs.update(tabId, { active: true });
  }

  async function closeTab(tabId: number) {
    await chrome.tabs.remove(tabId);
  }

  async function render() {
    const content = document.getElementById('content')!;
    const dateEl = document.getElementById('dateDisplay')!;
    
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString('zh-CN', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const tabs = await fetchOpenTabs();
    
    if (tabs.length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <h2>Inbox zero, but for tabs.</h2>
          <p>你很自由。</p>
        </div>
      `;
      return;
    }

    const groups: Record<string, { domain: string; tabs: typeof tabs }> = {};
    for (const tab of tabs) {
      try {
        const hostname = new URL(tab.url!).hostname;
        if (!groups[hostname]) {
          groups[hostname] = { domain: hostname, tabs: [] };
        }
        groups[hostname].tabs.push(tab);
      } catch {}
    }

    const sortedGroups = Object.values(groups).sort((a, b) => b.tabs.length - a.tabs.length);

    content.innerHTML = `
      <div class="section-header">
        <h2>打开的标签页</h2>
        <span style="color:#9a918a;font-size:14px">${sortedGroups.length} 个域名 · ${tabs.length} 个标签</span>
      </div>
      <div class="cards-grid">
        ${sortedGroups.map(g => renderCard(g)).join('')}
      </div>
    `;
  }

  function renderCard(group: { domain: string; tabs: typeof chrome.tabs.Tab[] }) {
    const domain = group.domain;
    const tabs = group.tabs;
    const name = friendlyName(domain);
    const hasActive = tabs.some(t => t.active);

    return `
      <div class="card ${hasActive ? 'has-active' : ''}">
        <div class="card-bar"></div>
        <div class="card-content">
          <div class="card-title">
            <img src="${getFavicon(domain)}" onerror="this.style.display='none'">
            ${name}
            <span class="tab-count">${tabs.length} tabs</span>
          </div>
          <div class="tab-list">
            ${tabs.map(t => renderTabChip(t as any, domain)).join('')}
          </div>
          <div class="card-actions">
            <button class="close-all-btn" data-domain="${domain}">
              关闭全部 ${tabs.length} 个
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderTabChip(tab: { id: number; title?: string; url?: string; favIconUrl?: string; active: boolean }, domain: string) {
    const title = cleanTitle(stripNoise(tab.title || ''), tab.url || '');
    const safeTitle = title.replace(/"/g, '&quot;');
    return `
      <div class="tab-chip" data-id="${tab.id}" title="${safeTitle}">
        <img src="${tab.favIconUrl || getFavicon(domain)}" onerror="this.style.display='none'">
        <span>${title}</span>
        <span class="close" data-id="${tab.id}">×</span>
      </div>
    `;
  }

  async function closeDomainTabs(domain: string) {
    const tabs = await chrome.tabs.query({});
    const toClose = tabs.filter(t => {
      try { return new URL(t.url!).hostname === domain; } catch { return false; }
    }).map(t => t.id);
    
    if (toClose.length > 0) {
      await chrome.tabs.remove(toClose);
      await render();
    }
  }

  // Event delegation
  document.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const chip = target.closest('.tab-chip');
    const closeBtn = target.closest('.tab-chip .close');
    const closeAllBtn = target.closest('.close-all-btn');
    
    if (closeBtn) {
      e.stopPropagation();
      const tabId = parseInt((closeBtn as HTMLElement).dataset.id || '0');
      await closeTab(tabId);
      await render();
      return;
    }
    
    if (chip && !closeBtn) {
      const tabId = parseInt((chip as HTMLElement).dataset.id || '0');
      await focusTab(tabId);
      return;
    }
    
    if (closeAllBtn) {
      const domain = (closeAllBtn as HTMLElement).dataset.domain || '';
      await closeDomainTabs(domain);
      return;
    }
  });

  render();
});