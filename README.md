# New Tab Home - 智能新标签页

## 功能特性

- 书签整理与快捷入口
- 搜索功能（集成搜索引擎）
- 快速添加链接
- 自动归类同域名书签
- AI提示词模板保存

## 技术栈

- React + TypeScript
- Tailwind CSS
- Vite + WXT (Chrome扩展构建框架)

## 开发指南

```bash
# 安装依赖
npm install

# 开发模式（带热重载）
npm run dev

# 构建生产版本
npm run build
```

## 文件结构

```
├── entrypoints/
│   ├── popup/        # 弹出页面
│   ├── newtab/       # 新标签页
│   └── options/      # 设置页面
├── src/
│   ├── components/   # React组件
│   ├── hooks/        # 自定义Hooks
│   ├── utils/        # 工具函数
│   └── types/        # TypeScript类型
├── manifest.ts       # 扩展清单配置
└── package.json
```