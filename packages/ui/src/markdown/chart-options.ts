/** 接受常用 ECharts JSON 配置；禁用远程图片与链接，tooltip 使用图形文字而不是 HTML。 */
export function parseChartOptions(source: string): Record<string, unknown> {
  const option: unknown = JSON.parse(source);
  if (!option || typeof option !== 'object' || Array.isArray(option)) throw new Error('图表配置必须是 JSON 对象。');
  const input = option as Record<string, unknown>;
  const series = Array.isArray(input.series) ? input.series : [input.series];
  if (!series.length || series.some(item => !item || !['bar', 'line', 'pie'].includes(item.type))) {
    throw new Error('series 需包含 bar、line 或 pie 类型的图表。');
  }
  // 不接入 graphic、toolbox、地图或自定义脚本。仅开放本轮有对应引擎模块的顶层配置。
  const allowed = new Set(['title', 'legend', 'grid', 'xAxis', 'yAxis', 'series', 'dataset', 'color', 'tooltip']);
  const output = Object.fromEntries(Object.entries(input).filter(([key]) => allowed.has(key)));
  const inspect = (value: unknown): void => {
    if (typeof value === 'string' && /(?:image:\/\/|https?:\/\/|data:|javascript:)/i.test(value)) throw new Error('图表配置不支持外部资源或脚本地址。');
    if (value && typeof value === 'object') {
      for (const [key, entry] of Object.entries(value)) {
        if (['link', 'sublink', 'href'].includes(key)) throw new Error('图表内不支持链接跳转。');
        inspect(entry);
      }
    }
  };
  inspect(output);
  const tooltip = input.tooltip && typeof input.tooltip === 'object' && !Array.isArray(input.tooltip) ? input.tooltip : {};
  return { ...output, tooltip: { ...tooltip, renderMode: 'richText', confine: true }, animation: false, aria: { enabled: true } };
}
