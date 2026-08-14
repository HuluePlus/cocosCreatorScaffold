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

## 必跑验证

```text
npm run check
git diff --check
```

`npm run typecheck` 依赖 Creator 生成的 `temp/tsconfig.cocos.json`。首次 clone 后先用 Cocos Creator 3.8.7 打开一次项目。
