# 机器学习平台产品设计 · 16周学习营

一个纯静态、可离线使用的学习打卡程序，覆盖《机器学习平台产品设计实战手册》31章。

## 功能

- 16周渐进学习计划与上、中、下三篇进度。
- 每章五项学习任务、4道测验题和实战作业。
- 3次阶段考试、错题本、连续打卡、学习热力图和成就。
- 自定义开始日期、暂停顺延和历史补卡。
- 数据仅保存在浏览器，支持JSON导出与导入。
- PWA安装和离线使用。

在线访问优先获取最新静态文件，网络不可用时回退到离线缓存；Service Worker版本更新时页面会提示刷新。

## 本地预览

不要直接双击`index.html`，ES Module和Service Worker需要HTTP环境。

```bash
cd study-tracker
python3 -m http.server 4173
```

浏览器打开：`http://localhost:4173`

## 验证

需要Node.js 20或更高版本，不需要安装第三方包。

```bash
npm test
npm run validate
```

测试会检查31章映射、124道题、掌握规则、暂停顺延、跨年日期、数据持久化和阶段考试。

## 发布到GitHub Pages

1. 将`study-tracker`目录作为一个新GitHub仓库的根目录。
2. 默认分支使用`main`，提交并推送全部文件，包括`.github/workflows/pages.yml`。
3. 在仓库`Settings → Pages → Build and deployment`中选择`GitHub Actions`。
4. 等待`Deploy GitHub Pages`工作流完成，Pages页面会显示在线地址。

项目全部使用相对路径，可同时支持用户主页和`username.github.io/repository/`项目页。

## 数据备份与换设备

进入“数据设置”选择“导出JSON备份”。换设备后打开在线网站，在同一页面导入该文件。导入会先校验31章数据和版本，确认后整体替换当前浏览器记录。

清理浏览器站点数据会删除本地进度，因此建议每周导出一次备份。

## 更新书稿数据

课程数据由三篇工作源文件生成：

```bash
python3 tools/generate_data.py
npm test
```

生成工具会读取上、中、下篇章节标题、标签、预计时间、学习目标、结论和实战作业，并重新生成`data.js`。

## 数据与隐私

- 无账号、无后端、无埋点和第三方统计。
- 不上传学习记录、笔记或备份。
- 不包含三篇PDF或完整书籍正文。
