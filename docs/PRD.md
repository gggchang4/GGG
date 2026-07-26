# ProfileWeb PRD

> 产品版本：0.1  
> 文档状态：Active  
> 最后更新：2026-07-26

## 1. 产品定义

ProfileWeb 是一个以多风格个人 Profile 为内容、以交互设计与创意前端为媒介的个人数字展厅。

首页不是传统简历，也不是普通作品卡片列表；它是一个风格索引。访客从同一个首页进入不同视觉语言的 Profile，以此同时看到作者的个人信息、审美判断、交互能力与工程能力。

## 2. 本版本设计主张

### Visual thesis

暖白静谧展厅中的一枚精密拉丝金属身份拨盘，以工业材质、克制排版和一个酸性绿色信号点建立记忆。

### Content plan

1. 品牌：Profile Index / Edition 001。
2. 主视觉：全视口中央金属圆盘。
3. 入口：Classic、Editorial、Experimental 三种 Profile 视角。
4. 辅助信息：拖拽提示、入口数量、系统状态。

首页不加入介绍长文、项目卡片或营销区块。

### Interaction thesis

1. 页面元素以短促、克制的 GSAP 序列入场。
2. 圆盘支持鼠标、触控笔与触摸的全方向三维拖拽。
3. 松手后保留短暂惯性，再通过阻尼弹簧回到初始姿态。

## 3. 用户与使用场景

### 目标用户

- 招聘者、面试官与潜在合作方。
- 前端、设计、创意技术同行。
- 希望快速判断作者审美与交互能力的访客。

### 核心场景

- 访客在 5 秒内理解“这是一个多风格个人 Profile 入口”。
- 访客直接拖拽圆盘，感知材质、空间和物理反馈。
- 访客在 Profile 页面开放后，从首页进入不同表达风格。

## 4. 产品目标

1. 首屏建立清晰且独特的记忆点。
2. 首页本身证明 3D、动效、交互和工程化能力。
3. 保持页面干净、克制，不因“炫技”牺牲审美。
4. 风格入口配置化，增加新风格无需重写首页。
5. 在桌面、移动端、键盘和 reduced-motion 环境中保持可用。

## 5. 非目标

当前版本不包含：

- 完整 Profile 内容页。
- 后端、CMS、登录、留言、数据库。
- 长滚动营销首页。
- 全站平滑滚动系统。
- 复杂页面转场、声音、粒子场与后处理特效。
- 为展示依赖而同时运行所有动效库。

## 6. 信息架构

```txt
/                         Profile 风格入口
/profile/classic          后续实现
/profile/editorial        后续实现
/profile/experimental     后续实现
```

当前迭代中三个入口均为 Placeholder，只展示，不跳转。

## 7. 内容模型

`data/stylesConfig.ts` 是首页入口的唯一事实来源。

```ts
type ProfileStyleConfig =
  | {
      id: string;
      index: string;
      name: string;
      shortLabel: string;
      description: string;
      status: "available";
      route: string;
      previewImage: string | null;
      tags: string[];
    }
  | {
      id: string;
      index: string;
      name: string;
      shortLabel: string;
      description: string;
      status: "placeholder" | "coming-soon";
      route: null;
      previewImage: string | null;
      tags: string[];
    };
```

仅当 `status === "available"` 且 `route` 存在时生成真实链接。

Profile 内容继续由 `data/profileData.ts` 统一提供，视觉风格不能复制个人事实数据。

## 8. 首页需求与验收标准

### HOME-01：全视口入口

- 访问 `/` 后，首屏只有一个主视觉：中央金属圆盘。
- 不出现旧版卡片网格与普通 Profile Navbar。
- 页面在 `1440×900`、`1024×768`、`390×844` 下不出现意外横向滚动。
- 品牌、操作提示与入口状态可以在数秒内被扫描理解。

### HOME-02：Profile 入口

- 入口由 `stylesConfig` 生成，不在 JSX 中重复写死。
- 当前入口全部显示 Reserved。
- 不使用 `href="#"`、空 `href` 或不存在的路由。
- 未开放入口具备 `aria-disabled` 语义。
- 将某项改为 available 并补充 route 后，无需修改首页组件即可启用跳转。

### DISC-01：金属视觉

- 静止状态可以辨认出实体金属圆盘，而不是灰色平面圆形。
- 至少具有圆盘厚度、金属边缘、环境反射、高光、粗糙度细节和投影。
- 圆盘姿态变化时，高光与明暗关系随空间角度变化。
- Canvas 加载前存在同尺寸静态圆盘，避免布局跳变。
- WebGL 失败时仍显示静态金属圆盘与 DOM 入口。

### DISC-02：连续三维拖拽

- 支持 Mouse、Pen、单指 Touch Pointer Events。
- 使用 pointer capture，指针离开圆盘范围后仍继续拖动。
- 使用虚拟轨迹球与 Quaternion，不限制在普通卡片的轻微 tilt。
- 可以连续跨越 ±180°，没有欧拉角边界跳变。
- 拖动期间圆盘入口淡出，避免视觉文字与空间姿态冲突。
- `pointercancel`、lost capture 和窗口失焦不会卡在 dragging 状态。

### DISC-03：物理复位

“物理复位”定义为：

> 松手后先延续末端角速度，再由阻尼弹簧将当前 Quaternion 拉回初始 Quaternion。

验收标准：

- 快速释放后至少继续沿原方向运动一个渲染帧。
- Pointer Up 前后姿态连续，无瞬移。
- 返回过程不是固定时长 linear ease。
- 正常操作后约 1.5 秒内稳定回到初始姿态。
- 高速拖拽存在角速度上限。
- 返回过程中再次按下可以立即接管当前姿态。

### INPUT-01：键盘

- 圆盘区域可以获得可见焦点。
- 方向键可以旋转圆盘。
- `Escape` 与 `Home` 可以触发复位。
- Canvas 不使用 `role="application"` 劫持辅助技术默认行为。

### A11Y-01：可访问性

- 页面有真实 H1。
- Canvas 为视觉层，不是唯一内容来源。
- Profile 入口存在真实 DOM 和导航语义。
- 文本、焦点和状态对比度满足 WCAG AA。
- reduced-motion 模式取消 GSAP 入场、惯性和回弹过冲，并使用静态圆盘。

### PERF-01：性能

- WebGL 组件仅在客户端动态加载。
- Canvas DPR 最大为 1.5。
- 静止后停止持续 RAF，使用 demand frameloop。
- 不使用 Bloom、DOF、SSR 等昂贵后处理。
- 生产构建无 TypeScript、ESLint 与编译错误。
- 桌面拖拽目标 ≥55 FPS，主流移动设备目标 ≥30 FPS；需在真实设备验收。

## 9. 响应式要求

### Desktop

- 圆盘直径约占短边 60%–70%。
- 辅助信息贴近四角，中心保持单一构图。
- Profile 标签稀疏分布在圆盘正面。

### Tablet

- 圆盘保持完整可见。
- 两侧信息让位于圆盘，不形成拥挤的中栏。

### Mobile

- 圆盘直径使用视口宽度与视口高度的双重约束。
- 安全区使用 `env(safe-area-inset-*)`。
- Header 元信息允许换行。
- 边侧说明隐藏，底部保留最关键状态。
- 圆盘触控区域使用 `touch-action: none`；圆盘外不阻止正常手势。

### Landscape mobile

- 圆盘按视口高度缩放。
- 空间不足时隐藏次要操作说明。

## 10. 视觉约束

- 背景：暖灰白。
- 正文：近黑石墨色。
- 金属：银灰、钛灰与冷白高光。
- 唯一强调色：酸性黄绿色，只用于中心信号点、状态和未来选中反馈。
- 最多两种字体：无衬线主体 + 等宽辅助信息。
- 不使用卡片墙、玻璃拟态、霓虹粒子、多色渐变或无意义装饰。

## 11. 工程约束

1. `app/page.tsx` 保持 Server Component。
2. 首页交互放在独立 Client Island。
3. Three.js 独占圆盘姿态；GSAP 只处理 DOM 入场。
4. 不为了单屏首页启用 Lenis。
5. Profile 视觉层与 Profile 内容数据分离。
6. 历史代码只保留在 `archive/`，不进入活动构建。
7. 新依赖必须解释其不可替代的用途。

## 12. 里程碑

### M0：工程与需求基线

- [x] 架构审计。
- [x] PRD 与 TODO。
- [x] 数据状态语义统一。
- [x] lint、TypeScript 与 production build 基线。

### M1：首页视觉

- [x] 全视口构图。
- [x] 金属圆盘几何、材质与环境反射。
- [x] 静态圆盘 Loading / Fallback。
- [x] 桌面、平板、移动端 CSS 布局。

### M2：核心交互

- [x] 虚拟轨迹球与 Quaternion。
- [x] Pointer capture。
- [x] 角速度采样与限制。
- [x] 惯性、阻尼、弹簧复位。
- [x] 键盘旋转与复位。

### M3：产品级验收

- [x] reduced-motion 静态模式。
- [x] 入口 DOM 语义层。
- [ ] 浏览器视觉验收。
- [ ] 真实移动设备与 Safari 验收。
- [ ] FPS、Lighthouse 与内存基线。
- [ ] E2E 与视觉回归。

### M4：Profile 内容

- [ ] 补充真实个人内容。
- [ ] 选择并实现第一个 Profile 风格。
- [ ] 将第一个入口切换为 available。

## 13. 风险与缓解

| 风险 | 缓解方式 |
| --- | --- |
| 金属变成廉价 CSS 渐变 | 使用真实厚度、PBR 材质、环境反射与静态 fallback 双轨 |
| 多动画引擎争抢 transform | Three.js 管 3D；GSAP 只管 DOM 入场 |
| 欧拉角跨 180°翻转 | 全程使用 Quaternion |
| 手机上 GPU 压力过大 | 动态加载、DPR 上限、按需渲染、无后处理 |
| Canvas 文字不可访问 | Profile 入口使用 DOM 覆盖层 |
| 拖动误触未来链接 | 入口与姿态分层，启用链接时保留 6px 手势阈值 |
| 入口置空却产生 404 | Placeholder 的 route 在类型层强制为 null |
| 效果过多破坏克制感 | 首页只保留一个主视觉与一个核心手势 |

## 14. 待确认的产品决策

以下事项不阻塞当前 Home Page，但会影响下一阶段：

1. 网站最终使用英文、中文还是双语。
2. 真实姓名、职业定位、所在地与联系方式。
3. 第一个需要完成的 Profile 风格。
4. Profile 标签未来是随圆盘旋转，还是只在圆盘静止时保持可读。
5. 是否将 `/profile/classic` 和 `/profile/experimental` 的现有占位页归档。
6. 最低支持浏览器与设备范围。
7. 正式部署平台与域名。

