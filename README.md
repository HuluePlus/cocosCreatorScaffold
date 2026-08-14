# Cocos Creator Scaffold

一个可以直接 clone 并修改的 Cocos Creator 3.8.7 2D TypeScript 脚手架。项目内置独立的 `framework/` 通用层，以及一个实际运行的对象池示例。

## 快速开始

```bash
git clone git@github.com:HuluePlus/cocosCreatorScaffold.git
cd cocosCreatorScaffold
npm install
```

1. 使用 Cocos Creator 3.8.7 打开项目目录。
2. 等待 AssetDB 首次导入完成。
3. 打开 `assets/scenes/main.scene`。
4. 点击 Creator 顶部预览按钮运行。

示例提供三个操作：生成 5 个池化圆点、暂停/继续状态机、清空活跃圆点。顶部统计会实时显示活跃对象、池内对象、累计创建数和碰撞事件。

## 项目结构

```text
assets/
├── framework/                 # 与示例业务无关的通用脚手架
│   ├── base/                  # Cocos 实体基类
│   ├── core/                  # 生命周期、事件、状态机、对象池
│   └── utils/                 # 数学和二维碰撞工具
├── examples/                  # 可删除或替换的示例业务
│   ├── configs/               # 强类型业务事件
│   ├── core/                  # 示例状态和编排控制器
│   ├── entities/              # BaseEntity 子类
│   └── scenes/                # 场景入口
└── scenes/
    └── main.scene             # 默认运行场景
```

依赖方向固定为：

```text
examples  ─────>  framework  ─────>  TypeScript / Cocos 基础 API
```

`framework/` 不得反向引用 `examples/`。删除 `assets/examples/` 后，通用层仍可独立复制到其他 Creator 3.8.x 项目。

## Framework 能力

- `GameManager`：单例应用生命周期调度，只协调启动、暂停、恢复和销毁。
- `EventBus`：基于事件表的强类型观察者模式，订阅时返回幂等清理函数。
- `StateMachine`：泛型状态机，保证旧状态 `exit` 先于新状态 `enter`。
- `PoolManager`：工厂创建的强类型对象池，集中管理获取、归还和销毁。
- `BaseEntity`：统一 Cocos 实体初始化、激活、停用和池化销毁流程。
- `MathUtils`：范围限制、插值、近似比较和可测试随机整数。
- `CollisionUtils`：与引擎无关的点、矩形和圆形碰撞判断。

详细 API 与代码示例见 [assets/framework/README.md](assets/framework/README.md)。

## 示例如何组合 Framework

- `FrameworkDemo` 将 Cocos 前后台事件交给 `GameManager`。
- `DemoStateMachine` 组合 `StateMachine`，显式维护 ready/running/paused。
- `DemoController` 通过 `PoolManager` 创建和回收 `DemoOrb`。
- `DemoOrb` 继承 `BaseEntity`，并使用数学与碰撞工具完成运动。
- HUD 只订阅 `DemoEventMap`，不直接读取控制器内部集合。

## 开发验证

```bash
npm run check
git diff --check
```

`npm run check` 包含完整 Cocos TypeScript 检查、纯 framework 类型检查和 Vitest 单元测试。完整类型检查依赖 Creator 生成的 `temp/tsconfig.cocos.json`，所以首次 clone 后需要先用 Creator 打开一次项目。

重新生成默认场景和确定性 `.meta`：

```bash
npm run generate:assets
```

不要提交 `library/`、`temp/`、`build/`、`profiles/`、`coverage/` 或 `node_modules/`。

## 许可证

[MIT](LICENSE)
