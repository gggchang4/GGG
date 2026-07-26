# ProfileWeb TODO

> 最后更新：2026-07-26  
> 说明：`[x]` 表示代码或文档中已确认完成；尚未进行的浏览器与真实设备视觉验收不会被提前标记。

## 当前状态

- [x] Next.js App Router / React / TypeScript strict。
- [x] Tailwind CSS 4 与全局设计变量。
- [x] GSAP / Motion / Lenis / Three.js / React Three Fiber 已安装。
- [x] GSAP 已用于首页入场节奏。
- [x] Three.js / R3F 已用于首页金属圆盘。
- [x] `stylesConfig` 多风格注册表。
- [x] `profileData` 多风格共享内容雏形。
- [x] Classic / Experimental 占位路由。
- [x] 架构审计文档。
- [x] PRD 与可验收需求。
- [x] 新 Home Page 第一版。
- [x] lint、TypeScript、production build 通过。
- [ ] 浏览器视觉与交互验收。
- [ ] 自动化测试与正式发布链路。

## P0：Home Page 验收

- [x] 将旧卡片网格替换为全视口入口。
- [x] 首页移除普通 Navbar。
- [x] 建立独立 Client Island。
- [x] 使用暖白、金属、石墨与单一酸性绿视觉系统。
- [x] 建立 Canvas Loading / Static Fallback。
- [x] 实现金属厚度、边缘、反射、拉丝细节与中心信号点。
- [x] Profile 入口由配置生成。
- [x] 所有未完成入口统一为 Placeholder + `route: null`。
- [x] 避免空链接、`href="#"` 与 404 入口。
- [ ] 在 `1440×900` 检查构图、字号、圆盘尺寸。
- [ ] 在 `1024×768` 检查构图与标签位置。
- [ ] 在 `390×844` 与 `360×800` 检查移动端。
- [ ] 检查不同系统字体加载后的排版差异。
- [ ] 检查真实金属质感，必要时微调灯光与 roughness。

## P0：圆盘交互

- [x] Pointer Events。
- [x] Pointer capture。
- [x] 虚拟轨迹球映射。
- [x] Quaternion 连续三维旋转。
- [x] 跨 ±180° 无欧拉角跳变。
- [x] 拖拽末端角速度采样。
- [x] 最大角速度限制。
- [x] 惯性 + 阻尼弹簧复位。
- [x] 回弹中再次接管。
- [x] `pointercancel` / lost capture / window blur 清理。
- [x] 6px 拖拽阈值。
- [x] 拖动时隐藏入口文字。
- [x] 方向键旋转。
- [x] `Escape` / `Home` 复位。
- [ ] 验证快速甩动不会过度旋转。
- [ ] 验证慢速释放不会出现夸张回摆。
- [ ] 验证触控笔。
- [ ] 验证 iOS 单指拖拽与系统手势冲突。

## P1：可访问性与降级

- [x] 页面真实 H1。
- [x] Canvas 与 DOM 语义分层。
- [x] Placeholder 使用 `aria-disabled`。
- [x] 圆盘区域可键盘聚焦。
- [x] 可见焦点样式。
- [x] `prefers-reduced-motion` 静态模式。
- [x] 动态加载与错误边界 fallback。
- [ ] 使用屏幕阅读器检查入口顺序和文案。
- [ ] 使用自动工具检查 WCAG AA 对比度。
- [ ] 主动处理 WebGL context lost / restored。
- [ ] 决定 reduced-motion 下是否仍允许无惯性的直接拖动。

## P1：性能与测试

- [x] Canvas `frameloop="demand"`。
- [x] DPR 上限 1.5。
- [x] 不引入后处理。
- [x] 每帧姿态保存在 ref，不触发 React 重渲染。
- [x] `npm run lint`。
- [x] `npx tsc --noEmit --incremental false`。
- [x] `npm run build`。
- [ ] Chrome / Edge 生产控制台检查。
- [ ] Safari / iOS WebGL 检查。
- [ ] 桌面拖拽 FPS 基线。
- [ ] 移动端 FPS、温度与内存基线。
- [ ] Lighthouse Performance / Accessibility 基线。
- [ ] 添加路由 smoke test。
- [ ] 添加圆盘物理纯函数 unit test。
- [ ] 添加拖拽、复位、reduced-motion E2E。
- [ ] 添加关键视口视觉回归。
- [ ] 建立 CI。

## P0：依赖安全

- [ ] 在单独分支评估 `npm audit --omit=dev` 的 12 项漏洞。
- [ ] 优先评估 Next.js 可安全升级版本。
- [ ] 检查 `shadcn` 是否应移到 `devDependencies`。
- [ ] 升级后重新运行 lint、type-check、build 和交互验收。
- [ ] 不使用 `npm audit fix --force` 直接覆盖依赖树。

## P1：工程整理

- [ ] 声明 `packageManager` 与 Node `engines`。
- [ ] 明确 `public/` 与根 `assets/` 的职责，删除重复空目录。
- [ ] 评估归档旧 `StyleSelector` / `StyleCard`。
- [ ] 将 Link 与 Button 拆为独立类型安全组件。
- [ ] 为 Profile 页面补移动端导航。
- [ ] 添加 `loading.tsx`、`error.tsx` 与定制 `not-found.tsx`。
- [ ] 添加 favicon、sitemap、robots。
- [ ] 添加专属 OG Image 与社交 metadata。

## P2：真实 Profile 页面

- [ ] 补充真实姓名、职业定位、简介与联系方式。
- [ ] 补充真实项目、角色、技术栈和成果。
- [ ] 确定第一个真实风格：Classic / Editorial / Experimental。
- [ ] 为第一个风格建立独立视觉 thesis。
- [ ] 实现第一个 Profile 页面。
- [ ] 将对应配置改为 `available` 并填写 route。
- [ ] 验证无需修改首页组件即可启用入口。
- [ ] 逐步完成其余风格。
- [ ] 每个风格独立完成 SEO、响应式、降级和可访问性。

## 后续想法池

- [ ] 首页到 Profile 的空间化转场。
- [ ] 圆盘刻蚀文字贴图或自定义 shader。
- [ ] 圆盘与 Profile 主题色的实时联动。
- [ ] Profile 预览在圆盘边缘短暂显影。
- [ ] 轻微环境声与显式静音开关。
- [ ] Lab / Creative Coding 实验索引。
- [ ] Case Study 的 MDX 内容系统。
- [ ] Profile 风格对比模式。
- [ ] Lenis 驱动的长页面滚动叙事。
- [ ] Analytics、Web Vitals 与错误监控。

## 发布清单

- [ ] 所有 P0 验收标准通过。
- [ ] 不存在空链接或 404 入口。
- [ ] 鼠标、键盘、触控均可用。
- [ ] reduced-motion 可用。
- [ ] WebGL fallback 可用。
- [ ] lint / type-check / build 通过。
- [ ] 桌面与移动端视觉审核通过。
- [ ] Chrome / Edge / Safari 验证。
- [ ] 依赖安全风险已评估并记录。
- [ ] Metadata、favicon、OG、sitemap、robots 完成。
- [ ] 正式域名与部署平台确认。

