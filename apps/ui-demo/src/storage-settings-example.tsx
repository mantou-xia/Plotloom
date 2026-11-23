import { useMemo } from 'react';
import type { ComponentExample } from '@plotloom/ui/workbench/catalog';
import { StorageSettings } from '../../web/src/features/settings/storage-settings';

export const storageSettingsExample: ComponentExample = {
  id: 'storage-settings',
  name: '应用数据位置',
  category: '产品设置',
  exportPath: 'apps/web/src/features/settings/storage-settings.tsx',
  description: '支持迁移桌面数据目录及在网页端与桌面端之间迁移产品偏好。',
  interaction: 'storage 提供目录读取、更改和导入操作。onExportPreferences 和 onImportPreferences 提供偏好文件操作。预览模拟目录及文件操作结果。',
  width: 680,
  height: 500,
  states: [
    { id: 'default', name: '默认目录', description: '点击更改位置可模拟取消选择。' },
    { id: 'migrated', name: '已迁移', description: '展示迁移后重新打开应用时的目录。' },
    { id: 'error', name: '选择失败', description: '点击更改位置可查看目标目录已存在的提示。' },
    { id: 'import-error', name: '旧目录无效', description: '点击导入旧版数据可查看无法识别数据目录的提示。' },
    { id: 'preferences', name: '网页端偏好迁移', description: '可模拟导出偏好，选择文件可模拟导入失败。' },
  ],
};

/** 用模拟宿主驱动产品组件，预览不接触本机目录。 */
export function StorageSettingsExample({ state, onAction }: { state: string; onAction: (action: string) => void }) {
  const storage = useMemo(() => ({
    getDataDirectory: async () => state === 'migrated' ? 'D:\\写作资料\\Plotloom-data' : 'C:\\Users\\Writer\\AppData\\Roaming\\Plotloom\\data',
    changeDataDirectory: async () => {
      onAction('changeDataDirectory()');
      return state === 'error' ? '所选文件夹下已有 Plotloom-data，请选择其他位置。' : null;
    },
    importDataDirectory: async () => {
      onAction('importDataDirectory()');
      return state === 'import-error' ? '所选文件夹中未找到 Plotloom 数据，请选择旧版使用的实际数据目录。' : null;
    },
  }), [state, onAction]);
  return <StorageSettings storage={state === 'preferences' ? undefined : storage}
    onExportPreferences={() => onAction('导出偏好')}
    onImportPreferences={async () => {
      onAction('导入偏好');
      if (state === 'preferences') throw new Error('无法读取偏好文件，请选择 Plotloom 导出的 JSON 文件。');
    }} />;
}
