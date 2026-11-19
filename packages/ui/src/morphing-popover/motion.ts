/** LeiBox Deep Agent Composer 原版弹簧与连续圆角参数；提取时保持数值和计算方式。
 * 来源：https://leibox.pantoria.cn/docs/animations/deep-agent-composer
 */
const CONTINUOUS_CORNERS = Object.freeze({ radius: 24, smoothing: 0.6 });
const CORNER_RADIUS_SCALE = 1 + CONTINUOUS_CORNERS.smoothing;
const CORNER_CURVATURE = Math.log2(
  -Math.LN2 / Math.log(1 - (1 - Math.SQRT1_2) / CORNER_RADIUS_SCALE)
);
function supportsContinuousCorners() {
  return typeof CSS !== "undefined" && CSS.supports("corner-shape", "superellipse(2)");
}
function continuousRadius(radius: number, supported = supportsContinuousCorners()) {
  return supported ? radius * CORNER_RADIUS_SCALE : radius;
}
function computedCornerCurvature(style: CSSStyleDeclaration) {
  const shape = style.getPropertyValue("corner-shape");
  if (shape === "round" || !supportsContinuousCorners()) return 1;
  const match = shape.match(/superellipse\(([\d.]+)\)/);
  return match ? Number(match[1]) : CORNER_CURVATURE;
}
const SHARE_MOTION = {
  open: {
    width: { stiffness: 306.25, damping: 28, duration: 0.7, delay: 0 },
    height: { stiffness: 196, damping: 18.34, duration: 0.86, delay: 0.057 }
  },
  close: {
    width: { stiffness: 400, damping: 33, duration: 0.64, delay: 0.07 },
    height: { stiffness: 600.25, damping: 40, duration: 0.62, delay: 0 }
  },
  resize: { stiffness: 280, damping: 24, duration: 0.64 }
};
function springEase(stiffness: number, damping: number, duration: number) {
  const decay = damping / 2;
  const frequency = Math.sqrt(stiffness - decay * decay);
  return (progress: number) => {
    if (progress === 0 || progress === 1) return progress;
    const time = progress * duration;
    return 1 - Math.exp(-decay * time) * (Math.cos(frequency * time) + decay / frequency * Math.sin(frequency * time));
  };
}
function motionColor(color: string) {
  if (/^rgba?\(/i.test(color)) return color;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d");
  if (!context) return color;
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
  return `rgba(${red}, ${green}, ${blue}, ${alpha / 255})`;
}

export { SHARE_MOTION, CORNER_CURVATURE, continuousRadius, computedCornerCurvature, springEase, motionColor };
