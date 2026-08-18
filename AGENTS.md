# Cocos Creator Scaffold 开发说明

## 项目定位

这是一个可直接 clone 并修改的 Cocos Creator 3.8.7 2D TypeScript 脚手架。默认示例展示生命周期调度、强类型事件、状态机、对象池、实体基类以及数学和碰撞工具的组合方式。

## 目录边界

- `assets/framework/`：通用架构层，不得依赖 `assets/examples/`。
- `assets/examples/`：示例业务层，可以依赖 framework。
- `assets/scenes/main.scene`：默认可运行场景，只挂载 `FrameworkDemo` 入口组件。
- `tools/generate-project-assets.mjs`：确定性生成场景和 Cocos `.meta`。
- `tests/`：不依赖 Creator 运行时的 framework 单元测试。

## 修改规则

1. 新建 TypeScript 类、接口、关键方法和复杂逻辑使用中文注释。
2. 禁止使用 `any`，跨模块事件必须在事件表中声明载荷。
3. framework 不得引用示例、具体玩法、资源路径或平台业务。
4. Cocos 组件销毁前清理事件、计时器、Tween 和池化对象。
5. 修改 `FrameworkDemo` 的脚本 UUID 或场景结构后，同步更新生成脚本并重新运行 `npm run generate:assets`。
6. 不提交 `library/`、`temp/`、`build/`、`profiles/`、`coverage/` 或 `node_modules/`。
7. **检查微信发布转译兼容性**：Cocos Creator 3.8.7 发布构建的 loose 转译会把 `[...someSet]` 降级为 `[].concat(someSet)`，结果是只包含 `Set` 本身的数组，而不是元素数组。浏览器预览执行原生展开语法时不会复现，但微信体验版可能在运行时报 `(..., value[index]) is not a function`。运行时代码不得用数组展开复制 `Set`/`Map` 迭代器；使用 `Array.from(set)` 或显式 `forEach` 收集。涉及这类代码时，单元测试之外还要在用户重新构建后检查 `build/wechatgame-*/assets/main/index.js`，确认未生成 `[].concat(set)`。

## 必跑验证

```text
npm run check
git diff --check
```

`npm run typecheck` 依赖 Creator 生成的 `temp/tsconfig.cocos.json`。首次 clone 后先用 Cocos Creator 3.8.7 打开一次项目。

完成命令验证后，还必须进行 Creator 实际运行验证：

1. 切回已经打开当前项目的 Cocos Creator 3.8.7 窗口。
2. 等待 Creator 检测文件变化并自动完成脚本重新编译，确认控制台没有编译错误。
3. 使用 Creator 内置 Web 预览运行 `assets/scenes/main.scene`，实际验证本次改动。单元测试或外部静态服务器不能替代此步骤。
