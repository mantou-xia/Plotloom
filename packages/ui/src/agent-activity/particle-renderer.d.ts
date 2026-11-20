/** index 为内部形态编号；phase 是本次形态经过秒数，time 驱动各形态的持续运动。 */
export function createActivityRenderer(canvas: HTMLCanvasElement): (index: number, phase: number, time: number, reduced: boolean, color: string, rotation?: number) => number;
