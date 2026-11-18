import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WorkbenchApp, PreviewApp } from './app.tsx';
import './root.css';

// iframe 使用相同入口与独立文档，让媒体查询和视口单位按预览宽高计算。
const preview = new URLSearchParams(location.search).has('preview');
createRoot(document.getElementById('root')!).render(<StrictMode>{preview ? <PreviewApp /> : <WorkbenchApp />}</StrictMode>);
