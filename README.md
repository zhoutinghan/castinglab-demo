# NOON CASTING 正午阳光选角系统演示版

这是一个纯静态、多页面的 casting 系统试用演示版，可直接部署到 GitHub Pages。

## 访问入口

- 本地入口：`index.html`
- GitHub Pages 入口：`https://<github用户名>.github.io/<仓库名>/`
- 登录页：`login.html`
- 内部后台：`admin-workspace.html`
- 演员端：`actor.html`
- 经纪端：`agent.html`

## 发布到 GitHub Pages

1. 在 GitHub 创建仓库，优先选择 Private。
2. 上传本项目所有文件和 `assets/` 文件夹。
3. 打开仓库 `Settings -> Pages`。
4. `Source` 选择 `Deploy from a branch`。
5. 分支选择 `main`，目录选择 `/root`。
6. 保存后等待 GitHub Pages 发布完成。

如果当前账号不支持私有仓库启用 GitHub Pages，可临时将仓库设为 Public。演示数据均为虚构数据。

## 后续更新方式

使用 GitHub 网页端上传替换文件即可更新：

1. 在本地修改并测试。
2. 进入 GitHub 仓库，上传替换变更文件。
3. 提交说明建议写清楚本次改动，例如 `Update dashboard simplification`。
4. GitHub Pages 会自动重新发布。

建议每次更新前保留本地文件夹备份，避免网页上传误覆盖。

## 演示版限制

- 当前版本不包含真实登录、后端、数据库或云文件存储。
- `localStorage` 仅保存当前浏览器的演示状态，换设备或换浏览器不会同步。
- 演员端和经纪端不会展示内部评分、风险备注、竞争演员、短名单排序和淘汰原因。
- 不要上传真实演员隐私、合同、片酬或未经授权的视频素材。

## 未来真实上线方向

- 前端迁移到 React/Vite 或同类框架。
- 接入后端 API、数据库、账号权限、文件上传和审计日志。
- 建立真实演员档案、试镜提交、视频存储、报告导出和项目归档流程。
