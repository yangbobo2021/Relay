export const zh = {
  advancedNav: '高级',
  advancedDebug: '高级调试模式',
  advancedDebugDetail: '轨迹与诊断包',
} as const

export const en: Record<keyof typeof zh, string> = {
  advancedNav: 'Advanced',
  advancedDebug: 'Advanced debugging',
  advancedDebugDetail: 'Trajectory and diagnostic archive',
}

export type CodexLocaleKey = keyof typeof zh
