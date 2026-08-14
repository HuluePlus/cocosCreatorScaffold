import { AudioClip, AudioSource, Node } from 'cc';

/** 音效槽位耗尽时的处理策略。 */
export type AudioOverflowPolicy = 'replace-oldest' | 'reject';

/** 音频管理器的创建参数。 */
export interface AudioManagerOptions {
  readonly maxConcurrentEffects?: number;
  readonly overflowPolicy?: AudioOverflowPolicy;
  readonly masterVolume?: number;
  readonly musicVolume?: number;
  readonly effectsVolume?: number;
}

/** 背景音乐单次播放参数。 */
export interface MusicPlaybackOptions {
  readonly loop?: boolean;
  readonly restart?: boolean;
  readonly volumeScale?: number;
}

/** 音效单次播放参数。 */
export interface EffectPlaybackOptions {
  readonly volumeScale?: number;
}

/** 可由业务层保留并提前停止的音效句柄。 */
export interface AudioEffectHandle {
  readonly active: boolean;
  stop(): void;
}

interface EffectSlot {
  readonly node: Node;
  readonly source: AudioSource;
  readonly onEnded: () => void;
  active: boolean;
  generation: number;
  order: number;
  volumeScale: number;
}

/** 将槽位生命周期封装成不会误停后续复用音效的句柄。 */
class ManagedEffectHandle implements AudioEffectHandle {
  public constructor(
    private readonly isActive: () => boolean,
    private readonly stopPlayback: () => void,
  ) {}

  public get active(): boolean {
    return this.isActive();
  }

  /** 幂等停止此句柄对应的那一次播放。 */
  public stop(): void {
    this.stopPlayback();
  }
}

/**
 * 管理单路背景音乐和有上限的并发音效。
 * 管理器不负责加载资源，业务层传入 AudioClip，并在所属场景或组件销毁时调用 destroy。
 */
export class AudioManager {
  private readonly root: Node;
  private readonly musicSource: AudioSource;
  private readonly effectSlots: EffectSlot[] = [];
  private readonly overflowPolicy: AudioOverflowPolicy;
  private _masterVolume: number;
  private _musicVolume: number;
  private _effectsVolume: number;
  private musicVolumeScale = 1;
  private musicPaused = false;
  private mutedValue = false;
  private suspended = false;
  private destroyed = false;
  private playOrder = 0;

  public constructor(host: Node, options: AudioManagerOptions = {}) {
    if (!host.isValid) throw new Error('AudioManager host must be valid');
    const maxConcurrentEffects = options.maxConcurrentEffects ?? 8;
    if (!Number.isInteger(maxConcurrentEffects) || maxConcurrentEffects <= 0) {
      throw new Error('maxConcurrentEffects must be a positive integer');
    }

    this.overflowPolicy = options.overflowPolicy ?? 'replace-oldest';
    this._masterVolume = this.normalizeVolume(options.masterVolume ?? 1, 'masterVolume');
    this._musicVolume = this.normalizeVolume(options.musicVolume ?? 1, 'musicVolume');
    this._effectsVolume = this.normalizeVolume(options.effectsVolume ?? 1, 'effectsVolume');
    this.root = new Node('__FrameworkAudio');
    host.addChild(this.root);
    this.musicSource = this.createSource('Music');
    this.musicSource.loop = true;

    for (let index = 0; index < maxConcurrentEffects; index += 1) {
      this.effectSlots.push(this.createEffectSlot(index));
    }
    this.applyVolumes();
  }

  /** 全局音量，取值会限制在 0 到 1。 */
  public get masterVolume(): number {
    return this._masterVolume;
  }

  public set masterVolume(value: number) {
    this.assertAlive();
    this._masterVolume = this.normalizeVolume(value, 'masterVolume');
    this.applyVolumes();
  }

  /** 背景音乐分组音量，取值会限制在 0 到 1。 */
  public get musicVolume(): number {
    return this._musicVolume;
  }

  public set musicVolume(value: number) {
    this.assertAlive();
    this._musicVolume = this.normalizeVolume(value, 'musicVolume');
    this.applyVolumes();
  }

  /** 音效分组音量，取值会限制在 0 到 1。 */
  public get effectsVolume(): number {
    return this._effectsVolume;
  }

  public set effectsVolume(value: number) {
    this.assertAlive();
    this._effectsVolume = this.normalizeVolume(value, 'effectsVolume');
    this.applyVolumes();
  }

  /** 静音只改变最终输出音量，不丢失原有音量设置和播放进度。 */
  public get muted(): boolean {
    return this.mutedValue;
  }

  public set muted(value: boolean) {
    this.assertAlive();
    this.mutedValue = value;
    this.applyVolumes();
  }

  /**
   * 播放或切换背景音乐，同一片段默认不会重新起播。
   * @param clip 已由业务层加载完成的音乐资源。
   */
  public playMusic(clip: AudioClip, options: MusicPlaybackOptions = {}): void {
    this.assertAlive();
    const sameClip = this.musicSource.clip === clip;
    const restart = options.restart ?? false;
    this.musicVolumeScale = this.normalizeVolume(options.volumeScale ?? 1, 'volumeScale');
    this.musicPaused = false;
    this.musicSource.loop = options.loop ?? true;
    this.applyVolumes();

    if (!sameClip || restart) {
      this.musicSource.stop();
      this.musicSource.clip = clip;
    }
    if (!this.suspended && (!sameClip || restart || !this.musicSource.playing)) {
      this.musicSource.play();
    }
  }

  /** 暂停背景音乐，但保留当前位置。 */
  public pauseMusic(): void {
    this.assertAlive();
    if (!this.musicSource.clip) return;
    this.musicPaused = true;
    this.musicSource.pause();
  }

  /** 恢复由 pauseMusic 暂停的背景音乐。 */
  public resumeMusic(): void {
    this.assertAlive();
    if (!this.musicSource.clip || !this.musicPaused) return;
    this.musicPaused = false;
    if (!this.suspended) this.musicSource.play();
  }

  /** 停止背景音乐并解除对片段资源的引用。 */
  public stopMusic(): void {
    this.assertAlive();
    this.stopMusicInternal();
  }

  /**
   * 播放一次可独立停止的音效。
   * @returns 播放句柄；暂停期间或 reject 策略槽位耗尽时返回 null。
   */
  public playEffect(
    clip: AudioClip,
    options: EffectPlaybackOptions = {},
  ): AudioEffectHandle | null {
    this.assertAlive();
    if (this.suspended) return null;
    const volumeScale = this.normalizeVolume(options.volumeScale ?? 1, 'volumeScale');
    const slot = this.acquireEffectSlot();
    if (!slot) return null;

    slot.active = true;
    slot.generation += 1;
    slot.order = this.playOrder;
    slot.volumeScale = volumeScale;
    this.playOrder += 1;
    slot.source.loop = false;
    slot.source.clip = clip;
    slot.source.volume = this.effectOutputVolume(slot.volumeScale);
    slot.source.play();
    const generation = slot.generation;
    return new ManagedEffectHandle(
      () => slot.active && slot.generation === generation,
      () => this.releaseEffectSlot(slot, generation, true),
    );
  }

  /** 停止全部音效并解除片段资源引用。 */
  public stopAllEffects(): void {
    this.assertAlive();
    for (const slot of this.effectSlots) {
      if (slot.active) this.releaseEffectSlot(slot, slot.generation, true);
    }
  }

  /**
   * 暂停全部当前播放内容，适合在应用进入后台时调用。
   * 暂停期间新的音效请求会被忽略。
   */
  public pauseAll(): void {
    this.assertAlive();
    if (this.suspended) return;
    this.suspended = true;
    if (this.musicSource.clip && !this.musicPaused) this.musicSource.pause();
    for (const slot of this.effectSlots) {
      if (slot.active) slot.source.pause();
    }
  }

  /** 恢复由 pauseAll 暂停的播放内容。 */
  public resumeAll(): void {
    this.assertAlive();
    if (!this.suspended) return;
    this.suspended = false;
    if (this.musicSource.clip && !this.musicPaused) this.musicSource.play();
    for (const slot of this.effectSlots) {
      if (slot.active) slot.source.play();
    }
  }

  /** 停止所有音频、移除监听并销毁管理器创建的节点。 */
  public destroy(): void {
    if (this.destroyed) return;
    this.stopMusicInternal();
    for (const slot of this.effectSlots) {
      if (slot.active) this.releaseEffectSlot(slot, slot.generation, true);
      slot.node.off(AudioSource.EventType.ENDED, slot.onEnded, this);
    }
    this.effectSlots.length = 0;
    if (this.root.isValid) this.root.destroy();
    this.destroyed = true;
  }

  /** 创建一个关闭自动播放的音源子节点。 */
  private createSource(name: string): AudioSource {
    const node = new Node(name);
    this.root.addChild(node);
    const source = node.addComponent(AudioSource);
    source.playOnAwake = false;
    return source;
  }

  /** 创建一个长期复用的音效槽位及其结束监听。 */
  private createEffectSlot(index: number): EffectSlot {
    const source = this.createSource(`Effect:${index + 1}`);
    let slot: EffectSlot;
    const onEnded = (): void => {
      this.releaseEffectSlot(slot, slot.generation, false);
    };
    slot = {
      node: source.node,
      source,
      onEnded,
      active: false,
      generation: 0,
      order: 0,
      volumeScale: 1,
    };
    slot.node.on(AudioSource.EventType.ENDED, onEnded, this);
    return slot;
  }

  /** 按配置寻找空闲槽位，必要时替换最早播放的音效。 */
  private acquireEffectSlot(): EffectSlot | null {
    const available = this.effectSlots.find((slot) => !slot.active);
    if (available) return available;
    if (this.overflowPolicy === 'reject') return null;

    let oldest = this.effectSlots[0];
    for (const slot of this.effectSlots) {
      if (slot.order < oldest.order) oldest = slot;
    }
    this.releaseEffectSlot(oldest, oldest.generation, true);
    return oldest;
  }

  /** 仅在代次匹配时释放槽位，旧句柄不会影响复用后的新播放。 */
  private releaseEffectSlot(slot: EffectSlot, generation: number, stop: boolean): void {
    if (!slot.active || slot.generation !== generation) return;
    if (stop) slot.source.stop();
    slot.source.clip = null;
    slot.active = false;
    slot.volumeScale = 1;
  }

  /** 更新背景音乐和所有有效音效的最终输出音量。 */
  private applyVolumes(): void {
    const muteScale = this.mutedValue ? 0 : 1;
    this.musicSource.volume = this._masterVolume
      * this._musicVolume
      * this.musicVolumeScale
      * muteScale;
    for (const slot of this.effectSlots) {
      slot.source.volume = this.effectOutputVolume(slot.volumeScale);
    }
  }

  /** 计算单个音效叠加各级音量后的输出。 */
  private effectOutputVolume(volumeScale: number): number {
    return this._masterVolume
      * this._effectsVolume
      * volumeScale
      * (this.mutedValue ? 0 : 1);
  }

  /** 停止音乐的内部实现，供销毁流程绕过存活检查。 */
  private stopMusicInternal(): void {
    this.musicSource.stop();
    this.musicSource.clip = null;
    this.musicPaused = false;
  }

  /** 将音量限制在引擎支持的区间，并拒绝非有限数值。 */
  private normalizeVolume(value: number, name: string): number {
    if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
    return Math.min(1, Math.max(0, value));
  }

  /** 防止销毁后的管理器被业务代码继续复用。 */
  private assertAlive(): void {
    if (this.destroyed) throw new Error('AudioManager has been destroyed');
  }
}
