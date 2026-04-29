import { useState, useEffect } from 'react';

interface Bookmark {
  id: string;
  title: string;
  url: string;
  favicon?: string;
  domain: string;
  createdAt: number;
}

interface PromptTemplate {
  id: string;
  title: string;
  content: string;
  createdAt: number;
}

interface TabInfo {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
  active: boolean;
  groupId?: number;
}

interface TabGroup {
  id: number;
  title: string;
  color: string;
}

interface ChromeBookmark {
  id: string;
  title: string;
  url?: string;
  children?: ChromeBookmark[];
}

function MyBookmarksList({ onDelete }: { onDelete?: (id: string) => void }) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  useEffect(() => {
    chrome.storage.local.get('bookmarks').then(res => {
      setBookmarks(res.bookmarks || []);
    });
  }, []);

  const grouped = bookmarks.reduce((acc, b) => {
    if (!acc[b.domain]) acc[b.domain] = [];
    acc[b.domain].push(b);
    return acc;
  }, {} as Record<string, Bookmark[]>);

  return (
    <div className="max-h-80 overflow-y-auto space-y-3 mb-3">
      {Object.entries(grouped).map(([domain, items]) => (
        <div key={domain}>
          <div className="text-xs text-gray-500 mb-1">{domain}</div>
          {items.map(b => (
            <div key={b.id} className="flex items-center gap-2 p-1 rounded hover:bg-gray-50">
              <a href={b.url} className="flex-1 text-sm truncate">{b.title}</a>
              {onDelete && (
                <button onClick={() => onDelete(b.id)} className="text-gray-400 hover:text-red-500">×</button>
              )}
            </div>
          ))}
        </div>
      ))}
      {bookmarks.length === 0 && <div className="text-gray-400 text-sm">暂无书签</div>}
    </div>
  );
}

function renderBookmarkTree(bookmark: ChromeBookmark, depth = 0) {
  const isFolder = !bookmark.url && bookmark.children?.length;
  const hasChildren = bookmark.children && bookmark.children.length > 0;
  
  return (
    <div key={bookmark.id}>
      {bookmark.url ? (
        <a href={bookmark.url} className="flex items-center gap-2 p-1.5 hover:bg-gray-100 rounded text-sm">
          <span className="truncate">{bookmark.title}</span>
        </a>
      ) : hasChildren ? (
        <div className="py-1">
          <div className="text-sm font-medium text-gray-700">{bookmark.title}</div>
          <div className="pl-2">
            {bookmark.children!.map(child => renderBookmarkTree(child, depth + 1))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<'tabs' | 'chromeBookmarks' | 'myBookmarks' | 'prompt'>('tabs');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [saved, setSaved] = useState(false);
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [groups, setGroups] = useState<TabGroup[]>([]);
  const [chromeBookmarks, setChromeBookmarks] = useState<ChromeBookmark[]>([]);
  const [myPrompts, setMyPrompts] = useState<PromptTemplate[]>([]);

  useEffect(() => {
    if (view === 'tabs') loadTabs();
    else if (view === 'chromeBookmarks') loadChromeBookmarks();
    else if (view === 'prompt') loadPrompts();
  }, [view]);

  const loadPrompts = async () => {
    const res = await chrome.storage.local.get('prompts');
    setMyPrompts(res.prompts || []);
  };

  const loadTabs = async () => {
    const [win] = await chrome.windows.getCurrent();
    const tabList = await chrome.tabs.query({ windowId: win.id });
    const groupList = await chrome.tabGroups.query({ windowId: win.id });
    setGroups(groupList);
    setTabs(tabList.map(t => ({
      id: t.id!,
      title: t.title || '无标题',
      url: t.url || '',
      favIconUrl: t.favIconUrl,
      active: t.active,
      groupId: t.groupId && t.groupId > 0 ? t.groupId : undefined
    })));
  };

  const loadChromeBookmarks = async () => {
    const tree = await chrome.bookmarks.getTree();
    setChromeBookmarks(tree);
  };

  const goToTab = (tabId: number) => chrome.tabs.update(tabId, { active: true });
  const closeTab = (tabId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    chrome.tabs.remove(tabId).then(loadTabs);
  };

  const getDomain = (urlStr: string) => {
    try { return new URL(urlStr).hostname.replace('www.', ''); } catch { return urlStr; }
  };

  const handleSave = async () => {
    if (view === 'myBookmarks' && title && url) {
      const newBookmark: Bookmark = {
        id: Date.now().toString(),
        title,
        url,
        domain: getDomain(url),
        createdAt: Date.now(),
      };
      const stored = await chrome.storage.local.get('bookmarks');
      await chrome.storage.local.set({ bookmarks: [newBookmark, ...(stored.bookmarks || [])] });
    } else if (view === 'prompt' && title && content) {
      const newPrompt: PromptTemplate = {
        id: Date.now().toString(),
        title,
        content,
        createdAt: Date.now(),
      };
      const stored = await chrome.storage.local.get('prompts');
      await chrome.storage.local.set({ prompts: [newPrompt, ...(stored.prompts || [])] });
    }
    setSaved(true);
    setTimeout(() => {
      setTitle(''); setContent(''); setUrl(''); setSaved(false);
    }, 1500);
  };

  const handleDeleteBookmark = async (id: string) => {
    const stored = await chrome.storage.local.get('bookmarks');
    const bookmarks = (stored.bookmarks || []).filter((b: Bookmark) => b.id !== id);
    await chrome.storage.local.set({ bookmarks });
    chrome.storage.local.get('bookmarks').then(res => {
      const grouped = (res.bookmarks || []).reduce((acc: Record<string, Bookmark[]>, b: Bookmark) => {
        if (!acc[b.domain]) acc[b.domain] = [];
        acc[b.domain].push(b);
        return acc;
      }, {});
      setTabs(Object.values(grouped).flat() as any);
    });
  };

  const groupColors: Record<string, string> = {
    grey: 'bg-gray-400', blue: 'bg-blue-400', red: 'bg-red-400',
    yellow: 'bg-yellow-400', green: 'bg-green-400', pink: 'bg-pink-400',
    purple: 'bg-purple-400', cyan: 'bg-cyan-400', orange: 'bg-orange-400',
  };

  return (
    <div className="w-80 p-4 bg-white">
      <h2 className="text-lg font-bold mb-4">快速添加</h2>

      <div className="flex flex-wrap gap-1 mb-4">
        {(['tabs', 'chromeBookmarks', 'myBookmarks', 'prompt'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-3 py-1.5 rounded-lg text-sm ${view === v ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
          >
            {v === 'tabs' ? '标签页' : v === 'chromeBookmarks' ? 'Chrome书签' : v === 'myBookmarks' ? '我的书签' : '提示词'}
          </button>
        ))}
      </div>

      {view === 'tabs' && (
        <div className="max-h-80 overflow-y-auto space-y-1">
          {groups.map(g => {
            const gTabs = tabs.filter(t => t.groupId === g.id);
            return gTabs.length > 0 ? (
              <div key={g.id} className="mb-2">
                <div className={`px-2 py-1 rounded text-white text-xs ${groupColors[g.color] || 'bg-gray-400'}`}>
                  {g.title || '未命名'} ({gTabs.length})
                </div>
                {gTabs.map(t => (
                  <div key={t.id} onClick={() => goToTab(t.id)} className={`flex items-center gap-2 p-2 ml-2 rounded hover:bg-gray-100 ${t.active ? 'bg-blue-50' : ''}`}>
                    {t.favIconUrl ? <img src={t.favIconUrl} className="w-4 h-4" /> : <div className="w-4 h-4 bg-gray-300 rounded" />}
                    <span className="flex-1 text-sm truncate">{t.title}</span>
                    <button onClick={(e) => closeTab(t.id, e)} className="text-gray-400 hover:text-red-500">×</button>
                  </div>
                ))}
              </div>
            ) : null;
          })}
          {tabs.filter(t => !t.groupId).map(t => (
            <div key={t.id} onClick={() => goToTab(t.id)} className={`flex items-center gap-2 p-2 rounded hover:bg-gray-100 ${t.active ? 'bg-blue-50' : ''}`}>
              {t.favIconUrl ? <img src={t.favIconUrl} className="w-4 h-4" /> : <div className="w-4 h-4 bg-gray-300 rounded" />}
              <span className="flex-1 text-sm truncate">{t.title}</span>
              <button onClick={(e) => closeTab(t.id, e)} className="text-gray-400 hover:text-red-500">×</button>
            </div>
          ))}
        </div>
      )}

      {view === 'chromeBookmarks' && (
        <div className="max-h-80 overflow-y-auto">
          {chromeBookmarks.map(b => renderBookmarkTree(b))}
        </div>
      )}

      {view === 'myBookmarks' && <MyBookmarksList onDelete={handleDeleteBookmark} />}

      {view === 'prompt' && (
        <div className="max-h-80 overflow-y-auto mb-3">
          {myPrompts.map(p => (
            <div key={p.id} className="p-2 border rounded mb-2 cursor-pointer hover:bg-gray-50" onClick={() => navigator.clipboard.writeText(p.content)}>
              <div className="font-medium text-sm">{p.title}</div>
              <div className="text-xs text-gray-500 truncate">{p.content}</div>
            </div>
          ))}
          {myPrompts.length === 0 && <div className="text-gray-400 text-sm">暂无提示词</div>}
        </div>
      )}

      {(view === 'myBookmarks' || view === 'prompt') && (
        <div className="space-y-2">
          <input type="text" placeholder="标题" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
          {view === 'myBookmarks' ? (
            <input type="url" placeholder="网址" value={url} onChange={e => setUrl(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
          ) : (
            <textarea placeholder="提示词内容..." value={content} onChange={e => setContent(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm h-20 resize-none" />
          )}
          <button onClick={handleSave} className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
            {saved ? '已保存 ✓' : '保存'}
          </button>
        </div>
      )}
    </div>
  );
}