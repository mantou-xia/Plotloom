import { init, use } from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { AriaComponent, DatasetComponent, GridComponent, LegendComponent, TitleComponent, TooltipComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

// 只注册本轮需要的图表和交互；整个模块由图表组件动态导入。
use([BarChart, LineChart, PieChart, AriaComponent, DatasetComponent, GridComponent, LegendComponent, TitleComponent, TooltipComponent, SVGRenderer]);
export { init };
