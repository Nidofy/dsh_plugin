export const en = {
  title: 'Live2D companion', open: 'Open Live2D companion', close: 'Close', settings: 'Appearance',
  full: 'Full body', half: 'Half body', portrait: 'Portrait', camera: 'Framing / zoom', panX: 'Horizontal position', panY: 'Vertical position',
  animation: 'Animation', reset: 'Reset framing', retry: 'Retry animation', loading: 'Loading offline model…',
  failed: 'Animation unavailable. Showing the static portrait.', unavailable: 'Portrait unavailable.', static: 'Static portrait', animated: 'Live2D',
  idle: 'Idle', working: 'Working', waiting: 'Waiting for you', disconnected: 'Disconnected', unknown: 'Session status unavailable',
  hidden: 'The companion is hidden while the right sidebar is open or the conversation is too narrow.',
  reduced: 'Animation starts paused because reduced motion is enabled.',
}
export const zh: Record<keyof typeof en, string> = {
  title: 'Live2D 伙伴', open: '打开 Live2D 伙伴', close: '关闭', settings: '外观',
  full: '全身', half: '半身', portrait: '头像', camera: '取景 / 缩放', panX: '水平位置', panY: '垂直位置',
  animation: '动画', reset: '重置取景', retry: '重试动画', loading: '正在加载离线模型…',
  failed: '动画暂不可用，已回退静态立绘。', unavailable: '立绘暂不可用。', static: '静态立绘', animated: 'Live2D',
  idle: '空闲', working: '工作中', waiting: '等待你的操作', disconnected: '连接已断开', unknown: '会话状态暂不可用',
  hidden: '右侧栏展开或对话区域过窄时，伙伴暂时隐藏。',
  reduced: '系统已启用减少动态效果，动画默认暂停。',
}
