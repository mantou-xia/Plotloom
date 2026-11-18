/** RGB 输入只接受 0—255 的整数，空值和半输入状态不作为新颜色提交。 */
export function rgbFieldsToHex(fields: readonly string[]): string | null {
  if (fields.length !== 3 || fields.some((field) => !/^\d{1,3}$/.test(field.trim()) || Number(field) > 255)) return null;
  return `#${fields.map((field) => Number(field).toString(16).padStart(2, '0')).join('')}`;
}

/** 调用方传入规范化的六位 HEX；显示格式变化不改变对外的 HEX 契约。 */
export function hexToRgbFields(hex: string): string[] {
  return [1, 3, 5].map((index) => String(parseInt(hex.slice(index, index + 2), 16)));
}
