# 复训星球 MVP Demo v1.0

## 版本信息

- **版本号**：MVP Demo v1.0
- **Service Worker 缓存**：`fuxun-planet-v7`
- **演示账号**：`demo@fuxun.local` / `demo1234`

## 演示数据说明

加载演示账号后自动包含：

| 项目 | 内容 |
|------|------|
| 家庭名称 | Daniel 的复训星球 |
| 家庭口号 | 错题清零，星球升级。 |
| 爸爸 Ryan | 理性分析型、鼓励陪伴型；爱好：跑步、阅读、科技 |
| 妈妈 Sara | 细心陪伴型、温柔沟通型；爱好：阅读、音乐、陪伴 |
| 孩子 Daniel | 高一；SAT Reading / Math / English |
| 学习目标 | 提升 SAT Reading 词汇题和结构题正确率 |
| 演示题库 | 5 道 SAT Reading（Vocabulary / Function / Evidence / Inference / Main Idea） |
| 错题 | 3 道已标记，训练池已生成，可直接演示复训清零 |

## 本地启动

```bash
cd C:\Users\kx090\OneDrive\Desktop\study-habit-pwa
python -m http.server 4173
```

浏览器打开：`http://localhost:4173`

## 手机访问（同一 WiFi）

1. 电脑运行 `ipconfig`，记下 IPv4 地址（如 `192.168.1.8`）
2. 手机浏览器打开：`http://192.168.1.8:4173`
3. 微信内可打开测试，**不要**在微信内安装 PWA

## 部署到 Vercel

1. 将 `study-habit-pwa` 文件夹推送到 GitHub
2. 登录 [vercel.com](https://vercel.com) → New Project → 导入仓库
3. Framework Preset 选 **Other**，Build Command 留空，Output Directory 填 `.`
4. Deploy 完成后访问分配的 `*.vercel.app` 地址

## 部署到 Netlify

1. 登录 [netlify.com](https://netlify.com) → Add new site → Deploy manually
2. 将项目文件夹拖拽上传，或连接 Git 仓库
3. Publish directory 设为项目根目录
4. 部署后访问 `*.netlify.app` 地址

## 添加到主屏幕

### iPhone Safari

1. 用 **Safari** 打开站点（非微信）
2. 点击底部分享按钮 → **添加到主屏幕**
3. 名称显示为 **复训星球**
4. 从主屏幕打开应为全屏独立窗口（`display: standalone`）

### Android Chrome

1. 用 Chrome 打开站点
2. 地址栏或菜单中出现 **安装应用** / **添加到主屏幕**
3. 确认安装，桌面图标名称为 **复训星球**

## 真机验收清单

在每台设备上逐项打勾（建议用演示账号）：

| # | 测试项 | iPhone Safari | Android Chrome | 微信浏览器 | 桌面 Chrome |
|---|--------|:-------------:|:--------------:|:----------:|:-------------:|
| 1 | 注册新家庭 | ☐ | ☐ | ☐ | ☐ |
| 2 | 登录演示账号 | ☐ | ☐ | ☐ | ☐ |
| 3 | 首页家庭卡片（Daniel / Ryan / Sara） | ☐ | ☐ | ☐ | ☐ |
| 4 | 复训资料导入（粘贴） | ☐ | ☐ | ☐ | ☐ |
| 5 | 拍图导入入口可打开 | ☐ | ☐ | ☐ | ☐ |
| 6 | OCR 模拟识别提示显示 | ☐ | ☐ | ☐ | ☐ |
| 7 | 题库解析（演示已预置 5 题） | ☐ | ☐ | ☐ | ☐ |
| 8 | 错题识别比对卡 | ☐ | ☐ | ☐ | ☐ |
| 9 | 一题一屏训练 | ☐ | ☐ | ☐ | ☐ |
| 10 | 错题清零完成页 | ☐ | ☐ | ☐ | ☐ |
| 11 | 打卡四段流程 | ☐ | ☐ | ☐ | ☐ |
| 12 | 成长海报生成 | ☐ | ☐ | ☐ | ☐ |
| 13 | 爸爸发送鼓励卡 | ☐ | ☐ | ☐ | ☐ |
| 14 | 妈妈发送鼓励卡 | ☐ | ☐ | ☐ | ☐ |
| 15 | 孩子收到爱心提醒 | ☐ | ☐ | ☐ | ☐ |
| 16 | 我的资料修改 | ☐ | ☐ | ☐ | ☐ |
| 17 | 退出登录 | ☐ | ☐ | ☐ | ☐ |
| 18 | 刷新后状态保持 | ☐ | ☐ | ☐ | ☐ |
| 19 | 添加到主屏幕 | ☐ | ☐ | N/A | ☐ |
| 20 | 离线打开基础页面 | ☐ | ☐ | ☐ | ☐ |

### 验收注意

- 升级后若看到顶部蓝条「发现新版本」，点 **立即刷新**
- 旧版「高中生学习习惯」缓存键已清除，导航仅为：首页 / 复训 / 打卡 / 优培 / 我的
- 离线测试：安装后开飞行模式，应能打开欢迎页/已缓存页面，非白屏

## 自动化验收

```bash
node scripts/acceptance-test.mjs
```