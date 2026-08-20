import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sceneUuid = '44ab1e30-2741-4c03-94fb-68b40a5c4f89';
const frameworkDemoUuid = 'b6e0a2c8-4569-4d1d-9b4c-1f2e3a4b5c6d';
const frameworkDemoType = 'b6e0aLIRWlNHZtMHy46S1xt';
const designResolution = { width: 375, height: 852 };

/** 将对象以 Creator 友好的格式写入项目。 */
function writeJson(relativePath, value) {
  const destination = resolve(root, relativePath);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/** 根据项目内相对路径生成稳定 UUID，避免不同机器产生不一致的资源引用。 */
function uuidFor(relativePath) {
  const hex = createHash('sha1')
    .update(`cocos-creator-scaffold:${relativePath.replaceAll('\\', '/')}`)
    .digest('hex')
    .slice(0, 32)
    .split('');
  hex[12] = '4';
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const value = hex.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

/** 创建目录、TypeScript、文本和场景对应的标准 meta。 */
function createMeta(relativePath, importer, uuid = uuidFor(relativePath)) {
  const versions = {
    directory: '1.2.0',
    typescript: '4.0.24',
    text: '1.0.1',
    scene: '1.1.50',
  };
  const files = importer === 'scene' || importer === 'text' ? ['.json'] : [];
  writeJson(`${relativePath}.meta`, {
    ver: versions[importer],
    importer,
    imported: true,
    uuid,
    files,
    subMetas: {},
    userData: {},
  });
}

const scene = [
  {
    __type__: 'cc.SceneAsset',
    _name: 'main',
    _objFlags: 0,
    __editorExtras__: {},
    _native: '',
    scene: { __id__: 1 },
  },
  {
    __type__: 'cc.Scene',
    _name: 'main',
    _objFlags: 0,
    __editorExtras__: {},
    _parent: null,
    _children: [{ __id__: 2 }],
    _active: true,
    _components: [],
    _prefab: { __id__: 9 },
    _lpos: { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 },
    _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 },
    _lscale: { __type__: 'cc.Vec3', x: 1, y: 1, z: 1 },
    _mobility: 0,
    _layer: 1073741824,
    _euler: { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 },
    autoReleaseAssets: false,
    _globals: { __id__: 10 },
    _id: sceneUuid,
  },
  {
    __type__: 'cc.Node',
    _name: 'Canvas',
    _objFlags: 0,
    __editorExtras__: {},
    _parent: { __id__: 1 },
    _children: [{ __id__: 3 }],
    _active: true,
    _components: [{ __id__: 5 }, { __id__: 6 }, { __id__: 7 }, { __id__: 8 }],
    _prefab: null,
    _lpos: {
      __type__: 'cc.Vec3',
      x: designResolution.width / 2,
      y: designResolution.height / 2,
      z: 0,
    },
    _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 },
    _lscale: { __type__: 'cc.Vec3', x: 1, y: 1, z: 1 },
    _mobility: 0,
    _layer: 33554432,
    _euler: { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 },
    _id: '5db2e097-2c9b-4ad5-b62e-b286cbca83bb',
  },
  {
    __type__: 'cc.Node',
    _name: 'Camera',
    _objFlags: 0,
    __editorExtras__: {},
    _parent: { __id__: 2 },
    _children: [],
    _active: true,
    _components: [{ __id__: 4 }],
    _prefab: null,
    _lpos: { __type__: 'cc.Vec3', x: 0, y: 0, z: 1000 },
    _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 },
    _lscale: { __type__: 'cc.Vec3', x: 1, y: 1, z: 1 },
    _mobility: 0,
    _layer: 1073741824,
    _euler: { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 },
    _id: '9efaa09a-a55e-43df-8cc1-e6b31396319f',
  },
  {
    __type__: 'cc.Camera',
    _name: '',
    _objFlags: 0,
    __editorExtras__: {},
    node: { __id__: 3 },
    _enabled: true,
    __prefab: null,
    _projection: 0,
    _priority: 0,
    _fov: 45,
    _fovAxis: 0,
    _orthoHeight: designResolution.height / 2,
    _near: 0,
    _far: 2000,
    _color: { __type__: 'cc.Color', r: 24, g: 29, b: 37, a: 255 },
    _depth: 1,
    _stencil: 0,
    _clearFlags: 7,
    _rect: { __type__: 'cc.Rect', x: 0, y: 0, width: 1, height: 1 },
    _aperture: 19,
    _shutter: 7,
    _iso: 0,
    _screenScale: 1,
    _visibility: 1108344832,
    _targetTexture: null,
    _postProcess: null,
    _usePostProcess: false,
    _cameraType: -1,
    _trackingType: 0,
    _id: '1acc3777-e5eb-40ff-941f-eacd7f275d23',
  },
  {
    __type__: 'cc.UITransform',
    _name: '',
    _objFlags: 0,
    __editorExtras__: {},
    node: { __id__: 2 },
    _enabled: true,
    __prefab: null,
    _contentSize: { __type__: 'cc.Size', ...designResolution },
    _anchorPoint: { __type__: 'cc.Vec2', x: 0.5, y: 0.5 },
    _id: '49ceaa3c-8305-4bb5-b37f-61f9f7cf060c',
  },
  {
    __type__: 'cc.Canvas',
    _name: '',
    _objFlags: 0,
    __editorExtras__: {},
    node: { __id__: 2 },
    _enabled: true,
    __prefab: null,
    _cameraComponent: { __id__: 4 },
    _alignCanvasWithScreen: true,
    _id: 'f856db38-96eb-4b62-a597-1794c4c69da3',
  },
  {
    __type__: 'cc.Widget',
    _name: '',
    _objFlags: 0,
    __editorExtras__: {},
    node: { __id__: 2 },
    _enabled: true,
    __prefab: null,
    _alignFlags: 45,
    _target: null,
    _left: 0,
    _right: 0,
    _top: 0,
    _bottom: 0,
    _horizontalCenter: 0,
    _verticalCenter: 0,
    _isAbsLeft: true,
    _isAbsRight: true,
    _isAbsTop: true,
    _isAbsBottom: true,
    _isAbsHorizontalCenter: true,
    _isAbsVerticalCenter: true,
    _originalWidth: 0,
    _originalHeight: 0,
    _alignMode: 2,
    _lockFlags: 0,
    _id: '4ac3dd6c-427a-4725-9918-ceccbdd67aa4',
  },
  {
    __type__: frameworkDemoType,
    _name: '',
    _objFlags: 0,
    __editorExtras__: {},
    node: { __id__: 2 },
    _enabled: true,
    __prefab: null,
    _id: '59f7b7cb-f58a-4420-b707-f582c8ac9e5b',
  },
  {
    __type__: 'cc.PrefabInfo',
    root: null,
    asset: null,
    fileId: 'c058dd3c-1e6c-4691-9510-93a72f3fc76b',
    instance: null,
    targetOverrides: null,
  },
  {
    __type__: 'cc.SceneGlobals',
    ambient: { __id__: 11 },
    shadows: { __id__: 12 },
    _skybox: { __id__: 13 },
    fog: { __id__: 14 },
    octree: { __id__: 15 },
    skin: { __id__: 16 },
    lightProbeInfo: { __id__: 17 },
    postSettings: { __id__: 18 },
    bakedWithStationaryMainLight: false,
    bakedWithHighpLightmap: false,
  },
  {
    __type__: 'cc.AmbientInfo',
    _skyColorHDR: { __type__: 'cc.Vec4', x: 0, y: 0, z: 0, w: 0.520833125 },
    _skyColor: { __type__: 'cc.Vec4', x: 0, y: 0, z: 0, w: 0.520833125 },
    _skyIllumHDR: 20000,
    _skyIllum: 20000,
    _groundAlbedoHDR: { __type__: 'cc.Vec4', x: 0, y: 0, z: 0, w: 0 },
    _groundAlbedo: { __type__: 'cc.Vec4', x: 0, y: 0, z: 0, w: 0 },
    _skyColorLDR: { __type__: 'cc.Vec4', x: 0.2, y: 0.5, z: 0.8, w: 1 },
    _skyIllumLDR: 20000,
    _groundAlbedoLDR: { __type__: 'cc.Vec4', x: 0.2, y: 0.2, z: 0.2, w: 1 },
  },
  {
    __type__: 'cc.ShadowsInfo',
    _enabled: false,
    _type: 0,
    _normal: { __type__: 'cc.Vec3', x: 0, y: 1, z: 0 },
    _distance: 0,
    _planeBias: 1,
    _shadowColor: { __type__: 'cc.Color', r: 76, g: 76, b: 76, a: 255 },
    _maxReceived: 4,
    _size: { __type__: 'cc.Vec2', x: 512, y: 512 },
  },
  {
    __type__: 'cc.SkyboxInfo',
    _envLightingType: 0,
    _envmapHDR: null,
    _envmap: null,
    _envmapLDR: null,
    _diffuseMapHDR: null,
    _diffuseMapLDR: null,
    _enabled: false,
    _useHDR: true,
    _editableMaterial: null,
    _reflectionHDR: null,
    _reflectionLDR: null,
    _rotationAngle: 0,
  },
  {
    __type__: 'cc.FogInfo',
    _type: 0,
    _fogColor: { __type__: 'cc.Color', r: 225, g: 225, b: 225, a: 255 },
    _enabled: false,
    _fogDensity: 0.3,
    _fogStart: 0.5,
    _fogEnd: 300,
    _fogAtten: 5,
    _fogTop: 1.5,
    _fogRange: 1.2,
    _accurate: false,
  },
  {
    __type__: 'cc.OctreeInfo',
    _enabled: false,
    _minPos: { __type__: 'cc.Vec3', x: -1024, y: -1024, z: -1024 },
    _maxPos: { __type__: 'cc.Vec3', x: 1024, y: 1024, z: 1024 },
    _depth: 8,
  },
  {
    __type__: 'cc.SkinInfo',
    _enabled: false,
    _blurRadius: 0.01,
    _sssIntensity: 3,
  },
  {
    __type__: 'cc.LightProbeInfo',
    _giScale: 1,
    _giSamples: 1024,
    _bounces: 2,
    _reduceRinging: 0,
    _showProbe: true,
    _showWireframe: true,
    _showConvex: false,
    _data: null,
    _lightProbeSphereVolume: 1,
  },
  {
    __type__: 'cc.PostSettingsInfo',
    _toneMappingType: 0,
  },
];

writeJson('assets/scenes/main.scene', scene);

const directories = [
  'assets/framework',
  'assets/framework/audio',
  'assets/framework/base',
  'assets/framework/core',
  'assets/framework/core/states',
  'assets/framework/effects',
  'assets/framework/platform',
  'assets/framework/utils',
  'assets/examples',
  'assets/examples/configs',
  'assets/examples/core',
  'assets/examples/entities',
  'assets/examples/scenes',
  'assets/scenes',
];

const typeScriptFiles = [
  'assets/framework/index.ts',
  'assets/framework/audio/AudioManager.ts',
  'assets/framework/base/BaseEntity.ts',
  'assets/framework/core/EventBus.ts',
  'assets/framework/core/GameManager.ts',
  'assets/framework/core/PoolManager.ts',
  'assets/framework/core/ShakeModel.ts',
  'assets/framework/core/StateMachine.ts',
  'assets/framework/core/states/LifecycleStates.ts',
  'assets/framework/effects/CameraShake.ts',
  'assets/framework/platform/Advertising.ts',
  'assets/framework/platform/ByteDancePlatform.ts',
  'assets/framework/platform/MiniGamePlatform.ts',
  'assets/framework/platform/MiniGameSdk.ts',
  'assets/framework/platform/MiniGameServices.ts',
  'assets/framework/platform/PlatformErrors.ts',
  'assets/framework/platform/PlatformFactory.ts',
  'assets/framework/platform/PlatformTypes.ts',
  'assets/framework/platform/WebPlatform.ts',
  'assets/framework/platform/WeChatPlatform.ts',
  'assets/framework/utils/CollisionUtils.ts',
  'assets/framework/utils/MathUtils.ts',
  'assets/examples/configs/DemoEvents.ts',
  'assets/examples/core/DemoController.ts',
  'assets/examples/core/DemoStateMachine.ts',
  'assets/examples/entities/DemoOrb.ts',
  'assets/examples/scenes/FrameworkDemo.ts',
];

for (const directory of directories) createMeta(directory, 'directory');
for (const file of typeScriptFiles) {
  createMeta(file, 'typescript', file.endsWith('/FrameworkDemo.ts') ? frameworkDemoUuid : uuidFor(file));
}
createMeta('assets/framework/README.md', 'text');
createMeta('assets/scenes/main.scene', 'scene', sceneUuid);

console.log(`Generated main.scene and ${directories.length + typeScriptFiles.length + 2} meta files.`);
