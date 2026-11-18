/** 固定版本第三方引擎的接入边界；内部算法保持 JavaScript 原样以便核对来源。 */
interface Fish {
  x: number;
  y: number;
  alive: boolean;
}
interface Shark {
  nodes: Float32Array;
  length: number;
  orbitRadius: number;
}
interface OceanWorld {
  time: number;
  fish: Fish[];
  sharks: Shark[];
  pointer: { x: number; y: number; active: boolean };
  resize(width: number, height: number, cellWidth: number, cellHeight: number): void;
  step(dt: number): void;
  splash(x: number, y: number): void;
}
interface OceanRenderer {
  dpr: number;
  cellWidth: number;
  cellHeight: number;
  bg: HTMLCanvasElement;
  setFontFamily(family: string): void;
  resize(width: number, height: number, dpr: number): void;
  render(world: OceanWorld, dt: number): void;
}
export function createSimulation(seed: number, document: Document): {
  World: new (specs: { kind: string; size: number }[], fishCount: number) => OceanWorld;
  AsciiRenderer: new (canvas: HTMLCanvasElement) => OceanRenderer;
};
