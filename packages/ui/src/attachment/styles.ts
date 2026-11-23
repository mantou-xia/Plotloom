/** 同一份样式随组件进入普通 DOM 或 TaskComposer 的 Shadow DOM，避免两处外观漂移。 */
export const attachmentStyles = `
.pl-attachment-card { box-sizing: border-box; display: inline-flex; align-items: center; flex: 0 1 auto; gap: 10px; width: 220px; max-width: 100%; height: 64px; min-width: 0; padding: 10px 12px; border: 0; border-radius: 14px; background: var(--pl-surface-muted, #f3f3f4); color: var(--pl-text, #26272b); font-family: inherit; text-align: left; }
.pl-attachment-card__body { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; padding: 0; border: 0; border-radius: 6px; background: transparent; color: inherit; font: inherit; text-align: inherit; }
button.pl-attachment-card__body { cursor: pointer; }
.pl-attachment-card__body:focus-visible, .pl-attachment-card__remove:focus-visible, .pl-attachment-image-trigger:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--pl-focus, #737780); }
.pl-attachment-card__icon { display: flex; align-items: center; justify-content: center; flex: 0 0 30px; width: 30px; height: 36px; }
.pl-attachment-card__icon svg { display: block; height: 32px; width: 28px; }
.pl-attachment-card__info { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
.pl-attachment-card__name { display: flex; min-width: 0; font-size: 12px; font-weight: 500; line-height: 18px; }
.pl-attachment-card__basename { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pl-attachment-card__extension { flex: none; }
.pl-attachment-card__detail { display: block; overflow: hidden; height: 16px; color: var(--pl-text-muted, #777a82); font-size: 11px; line-height: 16px; text-overflow: ellipsis; white-space: nowrap; }
.pl-attachment-card__detail[data-failed=true] { color: var(--pl-danger, #b42318); }
.pl-attachment-card__remove { display: flex; align-items: center; justify-content: center; flex: 0 0 22px; width: 22px; height: 22px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--pl-text-muted, #777a82); cursor: pointer; }
.pl-attachment-card__remove:hover { background: var(--pl-surface-active, #e4e4e7); color: var(--pl-text, #26272b); }
.pl-attachment-card__remove:disabled { opacity: .4; cursor: default; }
.pl-attachment-thumbnail { position: relative; display: inline-flex; align-items: center; justify-content: center; flex: none; width: 68px; height: 68px; overflow: hidden; border-radius: 10px; background: var(--pl-surface-muted, #f3f3f4); color: var(--pl-text-muted, #777a82); vertical-align: top; }
.pl-attachment-thumbnail img { display: block; width: 100%; height: 100%; object-fit: cover; }
.pl-attachment-thumbnail__fallback { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
.pl-attachment-thumbnail img[data-failed=true] { visibility: hidden; }
.pl-attachment-image-trigger { display: inline-flex; flex: none; width: 68px; height: 68px; padding: 0; border: 0; border-radius: 10px; background: transparent; cursor: zoom-in; }
.pl-attachment-image-trigger:hover .pl-attachment-thumbnail { filter: brightness(.96); }
`;
