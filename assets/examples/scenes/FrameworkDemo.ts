import {
  _decorator,
  Button,
  Color,
  Component,
  Game,
  Graphics,
  Label,
  Node,
  ResolutionPolicy,
  UITransform,
  game,
  screen,
  view,
} from 'cc';
import { EventBus, type Unsubscribe } from '../../framework/core/EventBus';
import { GameManager } from '../../framework/core/GameManager';
import { CameraShake } from '../../framework/effects/CameraShake';
import { DEMO_ARENA_NUMBERS } from '../configs/DemoArenaNumbers';
import type { DemoEventMap } from '../configs/DemoEvents';
import { DEMO_POOL_NUMBERS } from '../configs/DemoPoolNumbers';
import { DemoController } from '../core/DemoController';

const { ccclass } = _decorator;

const PALETTE = {
  background: new Color(24, 29, 37),
  panel: new Color(35, 42, 52),
  panelStrong: new Color(45, 54, 66),
  line: new Color(78, 91, 108),
  text: new Color(244, 247, 250),
  muted: new Color(157, 169, 184),
  mint: new Color(78, 205, 196),
  coral: new Color(255, 107, 107),
  yellow: new Color(255, 209, 102),
} as const;

/**
 * 示例场景入口，负责组合 framework 与演示业务。
 * 场景只序列化此入口组件，其余界面通过代码构建，方便 clone 后直接修改和复用。
 */
@ccclass('FrameworkDemo')
export class FrameworkDemo extends Component {
  private readonly lifecycle = GameManager.instance;
  private readonly events = new EventBus<DemoEventMap>();
  private readonly unsubscribers: Unsubscribe[] = [];
  private controller: DemoController | null = null;
  private cameraShake: CameraShake | null = null;
  private stateLabel: Label | null = null;
  private activeLabel: Label | null = null;
  private pooledLabel: Label | null = null;
  private createdLabel: Label | null = null;
  private collisionLabel: Label | null = null;
  private pauseButtonLabel: Label | null = null;
  private readonly logLines: string[] = [];
  private logLabel: Label | null = null;
  private backgroundNode: Node | null = null;
  private resumeAfterAppShow = false;

  /** 配置生命周期管理器并启动示例。 */
  protected override onLoad(): void {
    this.lifecycle.configure({
      onStart: () => this.startApplication(),
      onPause: () => this.pauseApplication(),
      onResume: () => this.resumeApplication(),
      onDestroy: () => this.destroyApplication(),
    });
    this.lifecycle.start();
  }

  /** 每帧只在应用生命周期处于运行状态时推进示例。 */
  protected override update(deltaTime: number): void {
    this.lifecycle.update(deltaTime);
    if (this.lifecycle.state === 'running') this.controller?.update(deltaTime);
  }

  /** 将 Cocos 组件销毁委托给统一生命周期管理器。 */
  protected override onDestroy(): void {
    this.lifecycle.destroy();
  }

  /** 构建界面、绑定事件并创建示例控制器。 */
  private startApplication(): void {
    this.configureViewport();
    const interfaceRoot = this.buildInterface();
    const cameraNode = this.node.getChildByName('Camera');
    if (!cameraNode) throw new Error('Camera node was not found');
    this.cameraShake = cameraNode.getComponent(CameraShake) ?? cameraNode.addComponent(CameraShake);
    view.on('canvas-resize', this.handleCanvasResize, this);
    this.bindEvents();
    const arena = interfaceRoot.getChildByName('Arena');
    if (!arena) throw new Error('Arena node was not created');
    this.controller = new DemoController(
      arena,
      {
        x: -DEMO_ARENA_NUMBERS.width / 2,
        y: -DEMO_ARENA_NUMBERS.height / 2,
        width: DEMO_ARENA_NUMBERS.width,
        height: DEMO_ARENA_NUMBERS.height,
      },
      this.events,
    );
    this.controller.start();
    this.controller.spawn(DEMO_POOL_NUMBERS.initialSpawnCount);
    this.appendLog('示例已启动');
    game.on(Game.EVENT_HIDE, this.handleHide, this);
    game.on(Game.EVENT_SHOW, this.handleShow, this);
  }

  /** 应用退到后台时记录原状态并暂停。 */
  private pauseApplication(): void {
    this.resumeAfterAppShow = this.controller?.state === 'running';
    this.controller?.pause();
  }

  /** 应用回到前台时只恢复此前正在运行的示例。 */
  private resumeApplication(): void {
    if (this.resumeAfterAppShow) this.controller?.resume();
    this.resumeAfterAppShow = false;
  }

  /** 释放 Cocos 监听器、业务控制器和 EventBus 订阅。 */
  private destroyApplication(): void {
    view.off('canvas-resize', this.handleCanvasResize, this);
    game.off(Game.EVENT_HIDE, this.handleHide, this);
    game.off(Game.EVENT_SHOW, this.handleShow, this);
    this.controller?.destroy();
    this.controller = null;
    this.cameraShake?.stop();
    this.cameraShake?.destroy();
    this.cameraShake = null;
    this.backgroundNode = null;
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers.length = 0;
    this.events.clear();
  }

  /** 转发 Cocos 隐藏事件。 */
  private handleHide(): void {
    this.lifecycle.pause();
  }

  /** 转发 Cocos 显示事件。 */
  private handleShow(): void {
    this.lifecycle.resume();
  }

  /** 画布尺寸变化后重新选择适配策略并铺满背景。 */
  private handleCanvasResize(): void {
    this.configureViewport();
    this.drawBackground();
  }

  /** 根据设备比例设置稳定的竖屏设计分辨率。 */
  private configureViewport(): void {
    const frame = screen.windowSize;
    const wide = frame.width > 0
      && frame.height > 0
      && frame.width / frame.height > DEMO_ARENA_NUMBERS.designWidth / DEMO_ARENA_NUMBERS.designHeight;
    view.setDesignResolutionSize(
      DEMO_ARENA_NUMBERS.designWidth,
      DEMO_ARENA_NUMBERS.designHeight,
      wide ? ResolutionPolicy.FIXED_HEIGHT : ResolutionPolicy.FIXED_WIDTH,
    );
  }

  /** 创建完整的示例操作界面，并返回承载业务节点的缩放根节点。 */
  private buildInterface(): Node {
    // Camera 是场景序列化节点，重新构建运行时 UI 时必须保留它。
    for (const child of [...this.node.children]) {
      if (child.name !== 'Camera') child.destroy();
    }
    this.backgroundNode = null;
    this.drawBackground();
    const interfaceRoot = this.createNode(
      'Interface',
      this.node,
      DEMO_ARENA_NUMBERS.designWidth / DEMO_ARENA_NUMBERS.interfaceScale,
      DEMO_ARENA_NUMBERS.designHeight / DEMO_ARENA_NUMBERS.interfaceScale,
    );
    interfaceRoot.setScale(
      DEMO_ARENA_NUMBERS.interfaceScale,
      DEMO_ARENA_NUMBERS.interfaceScale,
      1,
    );

    this.createLabel(interfaceRoot, 'COCOS FRAMEWORK', 22, 420, 40, PALETTE.mint, true)
      .node.setPosition(0, 600);
    this.createLabel(interfaceRoot, '对象池游乐场', 46, 560, 72, PALETTE.text, true)
      .node.setPosition(0, 548);

    const statePanel = this.createPanel('StatePanel', interfaceRoot, 650, 92, PALETTE.panel);
    statePanel.setPosition(0, 445);
    this.stateLabel = this.createLabel(statePanel, '准备中', 23, 140, 48, PALETTE.mint, true);
    this.stateLabel.node.setPosition(-238, 0);
    this.activeLabel = this.createMetric(statePanel, '活跃', -80);
    this.pooledLabel = this.createMetric(statePanel, '池内', 74);
    this.createdLabel = this.createMetric(statePanel, '已创建', 228);

    const arena = this.createPanel(
      'Arena',
      interfaceRoot,
      DEMO_ARENA_NUMBERS.width,
      DEMO_ARENA_NUMBERS.height,
      PALETTE.panel,
    );
    arena.setPosition(0, 58);
    this.drawArenaGrid(arena);

    const controls = this.createNode('Controls', interfaceRoot, 650, 82);
    controls.setPosition(0, -330);
    this.createButton(controls, '生成 5 个', -220, PALETTE.mint, () => {
      this.controller?.spawn(DEMO_POOL_NUMBERS.buttonSpawnCount);
      this.appendLog('生成请求 +5');
    });
    this.pauseButtonLabel = this.createButton(controls, '暂停', 0, PALETTE.yellow, () => {
      this.controller?.toggle();
    });
    this.createButton(controls, '清空', 220, PALETTE.coral, () => {
      this.controller?.clear();
      this.appendLog('活跃对象已清空');
    });

    const logPanel = this.createPanel('EventLog', interfaceRoot, 650, 190, PALETTE.panelStrong);
    logPanel.setPosition(0, -492);
    this.createLabel(logPanel, 'EVENT BUS', 17, 140, 30, PALETTE.muted, true)
      .node.setPosition(-236, 62);
    this.collisionLabel = this.createLabel(logPanel, '碰撞 0', 17, 140, 30, PALETTE.yellow, true);
    this.collisionLabel.node.setPosition(236, 62);
    this.logLabel = this.createLabel(logPanel, '', 18, 570, 112, PALETTE.text, false);
    this.logLabel.node.setPosition(0, -16);
    this.logLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
    return interfaceRoot;
  }

  /** 绑定强类型业务事件并刷新 HUD。 */
  private bindEvents(): void {
    this.unsubscribers.push(
      this.events.on('demo:state-changed', ({ state }) => {
        const running = state === 'running';
        if (this.stateLabel) {
          this.stateLabel.string = running ? '运行中' : state === 'paused' ? '已暂停' : '准备中';
          this.stateLabel.color = running ? PALETTE.mint : PALETTE.yellow;
        }
        if (this.pauseButtonLabel) this.pauseButtonLabel.string = running ? '暂停' : '继续';
        this.appendLog(running ? '状态切换：运行' : '状态切换：暂停');
      }),
      this.events.on('demo:population-changed', ({ active, pooled, created }) => {
        if (this.activeLabel) this.activeLabel.string = `活跃\n${active}`;
        if (this.pooledLabel) this.pooledLabel.string = `池内\n${pooled}`;
        if (this.createdLabel) this.createdLabel.string = `已创建\n${created}`;
      }),
      this.events.on('demo:collision', ({ total }) => {
        this.cameraShake?.shake({ duration: 0.16, strength: 2.5, frequency: 26, rotation: 0.12 });
        if (this.collisionLabel) this.collisionLabel.string = `碰撞 ${total}`;
        if (total <= 3 || total % 10 === 0) this.appendLog(`碰撞事件 #${total}`);
      }),
    );
  }

  /** 绘制全屏背景和顶部强调线。 */
  private drawBackground(): void {
    const visibleSize = view.getVisibleSize();
    const width = Math.max(DEMO_ARENA_NUMBERS.designWidth, visibleSize.width);
    const height = Math.max(DEMO_ARENA_NUMBERS.designHeight, visibleSize.height);
    const background = this.backgroundNode ?? this.createNode('Background', this.node, width, height);
    this.backgroundNode = background;
    const transform = background.getComponent(UITransform);
    if (!transform) throw new Error('Background UITransform was not created');
    transform.setContentSize(width, height);
    const graphics = background.getComponent(Graphics) ?? background.addComponent(Graphics);
    graphics.clear();
    graphics.fillColor = PALETTE.background;
    graphics.rect(-width / 2, -height / 2, width, height);
    graphics.fill();
    graphics.fillColor = PALETTE.mint;
    const accentWidth = DEMO_ARENA_NUMBERS.designWidth - 50;
    graphics.rect(-accentWidth / 2, height / 2 - 26, accentWidth, 2);
    graphics.fill();
  }

  /** 在场地区域绘制低对比度网格。 */
  private drawArenaGrid(arena: Node): void {
    const grid = this.createNode(
      'Grid',
      arena,
      DEMO_ARENA_NUMBERS.width,
      DEMO_ARENA_NUMBERS.height,
    );
    const graphics = grid.addComponent(Graphics);
    graphics.strokeColor = new Color(PALETTE.line.r, PALETTE.line.g, PALETTE.line.b, 70);
    graphics.lineWidth = 1;
    for (let x = -260; x <= 260; x += 65) {
      graphics.moveTo(x, -300);
      graphics.lineTo(x, 300);
    }
    for (let y = -260; y <= 260; y += 65) {
      graphics.moveTo(-300, y);
      graphics.lineTo(300, y);
    }
    graphics.stroke();
  }

  /** 创建固定尺寸节点并挂到父节点。 */
  private createNode(name: string, parent: Node, width: number, height: number): Node {
    const node = new Node(name);
    parent.addChild(node);
    const transform = node.addComponent(UITransform);
    transform.setContentSize(width, height);
    return node;
  }

  /** 创建带细描边的面板。 */
  private createPanel(name: string, parent: Node, width: number, height: number, fill: Color): Node {
    const panel = this.createNode(name, parent, width, height);
    const graphics = panel.addComponent(Graphics);
    graphics.fillColor = fill;
    graphics.roundRect(-width / 2, -height / 2, width, height, 8);
    graphics.fill();
    graphics.strokeColor = PALETTE.line;
    graphics.lineWidth = 2;
    graphics.roundRect(-width / 2, -height / 2, width, height, 8);
    graphics.stroke();
    return panel;
  }

  /** 创建文本标签。 */
  private createLabel(
    parent: Node,
    text: string,
    fontSize: number,
    width: number,
    height: number,
    color: Color,
    bold: boolean,
  ): Label {
    const node = this.createNode(`Label:${text}`, parent, width, height);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = Math.round(fontSize * 1.35);
    label.color = color;
    label.isBold = bold;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.overflow = Label.Overflow.SHRINK;
    label.enableWrapText = true;
    return label;
  }

  /** 创建双行统计标签。 */
  private createMetric(parent: Node, title: string, x: number): Label {
    const label = this.createLabel(parent, `${title}\n0`, 20, 130, 68, PALETTE.text, true);
    label.node.setPosition(x, 0);
    return label;
  }

  /** 创建稳定尺寸的操作按钮，并返回其文本组件以便动态更新。 */
  private createButton(
    parent: Node,
    text: string,
    x: number,
    fill: Color,
    onClick: () => void,
  ): Label {
    const buttonNode = this.createNode(`Button:${text}`, parent, 194, 76);
    buttonNode.setPosition(x, 0);
    const graphics = buttonNode.addComponent(Graphics);
    graphics.fillColor = fill;
    graphics.roundRect(-97, -38, 194, 76, 8);
    graphics.fill();
    const label = this.createLabel(buttonNode, text, 23, 170, 58, PALETTE.background, true);
    const button = buttonNode.addComponent(Button);
    button.transition = Button.Transition.SCALE;
    button.zoomScale = 0.96;
    button.duration = 0.08;
    buttonNode.on(Node.EventType.TOUCH_END, () => {
      if (button.interactable) onClick();
    });
    return label;
  }

  /** 将最新事件写入固定四行日志，避免动态内容改变布局。 */
  private appendLog(message: string): void {
    this.logLines.unshift(message);
    this.logLines.length = Math.min(this.logLines.length, 4);
    if (this.logLabel) this.logLabel.string = this.logLines.map((line) => `· ${line}`).join('\n');
  }
}
