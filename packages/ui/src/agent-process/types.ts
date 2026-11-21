/** 展示调用方已确认的节点状态；不根据耗时、内容或其他节点推测执行结果。 */
export type ProcessStatus = 'running' | 'awaiting_approval' | 'awaiting_answer' | 'completed' | 'failed' | 'stopped';
