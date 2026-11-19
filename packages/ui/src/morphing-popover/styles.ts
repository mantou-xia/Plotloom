import { CORNER_CURVATURE } from './motion.ts';
/** 仅作用于形变外壳，避免依赖原版 Tailwind 全量样式；支持原版与项目主题变量。 */
export const morphingPopoverStyles = `
.pl-morphing-popover{position:relative;max-width:100%}
.pl-morphing-popover__anchor{position:relative;display:inline-flex;max-width:100%;vertical-align:top}
.pl-morphing-popover__shell{position:relative;display:inline-flex;max-width:100%;corner-shape:superellipse(var(--morph-corner-curvature,1))}
.pl-morphing-popover__compact{display:inline-flex;max-width:100%;width:max-content;pointer-events:auto}
.pl-morphing-popover[data-trigger-layout=block],.pl-morphing-popover[data-trigger-layout=block]>.pl-morphing-popover__anchor{display:flex;width:100%}
.pl-morphing-popover[data-trigger-layout=block] .pl-morphing-popover__shell,.pl-morphing-popover[data-trigger-layout=block] .pl-morphing-popover__compact{width:100%}
.pl-morphing-popover__panel{position:absolute;left:0;top:0;width:max-content;max-width:calc(100vw - 32px);border:0;border-radius:16px;background:var(--theme-elevated,var(--pl-surface,#fff));color:var(--theme-fg,var(--pl-text,#202124));box-sizing:border-box}
.pl-morphing-popover__content{max-width:calc(100vw - 32px);border-radius:inherit;corner-shape:inherit;background:var(--theme-elevated,var(--pl-surface,#fff));box-sizing:border-box}
.pl-morphing-popover__shell .floating-menu-panel,.pl-morphing-popover__shell .floating-menu-item{animation:none!important}
@supports(corner-shape:superellipse(2)){.pl-morphing-popover__panel{border-radius:25.6px;corner-shape:superellipse(${CORNER_CURVATURE})}}
`;
