export const en = {
  title: 'Source control', open: 'Open Git / Hg tools', close: 'Close', refresh: 'Refresh', changes: 'Changes', branch: 'Branch',
  commit: 'Commit', push: 'Push', create: 'Create branch', switch: 'Switch branch', history: 'Commit graph', worktrees: 'Worktrees',
  search: 'Search branches', clean: 'Working tree clean', files: 'changed files', detached: 'Detached HEAD', unborn: 'No commits yet',
  empty: 'The current project has no registered Git or Mercurial repository.',
  noProject: 'Select a project or a session to inspect its repository.',
  loading: 'Loading…', more: 'Repository actions', stage: 'Stage selected', unstage: 'Unstage selected', add: 'Track selected', forget: 'Forget selected',
  selected: 'selected', staged: 'Index', working: 'Working tree', message: 'Commit message', review: 'Review operation', cancel: 'Cancel', confirm: 'Confirm',
  preview: 'Review repository operation', revision: 'Based on', branchName: 'New branch name', network: 'Remotes', remote: 'Remote',
  fetch: 'Fetch', pull: 'Pull (without update)', gitCommit: 'Commits the complete staged index. Unstaged edits stay in the working tree.',
  hgCommit: 'Commits only selected tracked files. Mercurial has no staging area.', hgBranch: 'Mercurial named branches are recorded by the next commit.',
  networkHelp: 'Push publishes this HEAD and its ancestors to the selected configured remote. No force push. Fetch / pull does not merge or update working files.',
  dirtyHelp: 'Branch creation and switching require a clean working tree.', success: 'Operation completed', failure: 'Operation failed or its result is uncertain. Status has been refreshed. Check it before trying again.',
  stale: 'Repository changed since review. Refresh and review the operation again.', missing: 'Git or Mercurial is not installed or not on the host PATH.',
  command: 'The command failed. Check repository permissions, commit identity, hooks, conflicts, and remote authentication in your terminal.',
  limit: 'Repository exceeds the safe preview limit. Use your terminal for this operation.', invalid: 'The requested operation is not valid for the current repository state.',
  unavailable: 'Repository unavailable', unknown: 'Unable to read repository data', noRemote: 'No configured remotes', noDiff: 'No text diff (binary file, mode change, or no changes in this view).',
  diff: 'File diff', instructions: 'Select files for staging or tracking, and choose a filename to inspect its diff.',
  stats: 'Tracked line changes: working tree / index. Untracked files and binary contents are not included.',
  hgStats: 'Tracked line changes. Untracked files and binary contents are not included.',
  path: 'Path', parents: 'Parents', conflict: 'Unresolved conflicts', noHistory: 'No commit history yet', noWorktrees: 'Worktree listing is available for Git.',
  selectedFiles: 'Files in this operation', details: 'Details', description: 'Inspect repositories, review changes and explicitly commit or push with Git and Mercurial.',
  cancelled: 'Request cancelled. Refresh status before retrying a write.',
}
export const zh: typeof en = {
  title: '版本控制', open: '打开 Git / Hg 工具', close: '关闭', refresh: '刷新', changes: '变更', branch: '分支',
  commit: '提交', push: '推送', create: '创建分支', switch: '切换分支', history: '提交图谱', worktrees: '工作树',
  search: '搜索分支', clean: '工作区干净', files: '个文件有变更', detached: '分离的 HEAD', unborn: '尚无提交',
  empty: '当前项目没有已登记的 Git 或 Mercurial 仓库。',
  noProject: '请先选择项目或会话，再查看对应仓库。',
  loading: '正在读取…', more: '仓库操作', stage: '暂存选中项', unstage: '取消暂存', add: '跟踪选中项', forget: '取消跟踪',
  selected: '项已选', staged: '暂存区', working: '工作区', message: '提交说明', review: '检查操作', cancel: '取消', confirm: '确认执行',
  preview: '检查仓库操作', revision: '基于版本', branchName: '新分支名称', network: '远端', remote: '远端',
  fetch: '获取', pull: '拉取（不更新工作区）', gitCommit: '提交整个暂存区。未暂存的编辑保留在工作区。',
  hgCommit: '仅提交选中的已跟踪文件。Mercurial 没有暂存区。', hgBranch: 'Mercurial 命名分支将在下次提交时记入历史。',
  networkHelp: '推送会发布当前 HEAD 及其祖先到选定的已配置远端，不强制覆盖。获取 / 拉取不会合并或更新工作区。',
  dirtyHelp: '创建与切换分支需要工作区干净。', success: '操作已完成', failure: '操作失败或结果不确定，已刷新仓库状态。请核实后再操作。',
  stale: '仓库在检查后发生了变化，请刷新并重新检查操作。', missing: '宿主未安装 Git / Mercurial，或工具未加入 PATH。',
  command: '命令执行失败。请在终端检查仓库权限、提交身份、hooks、冲突及远端认证。',
  limit: '仓库超出安全预览上限，请在终端完成此操作。', invalid: '当前仓库状态不支持此操作。',
  unavailable: '仓库不可用', unknown: '无法读取仓库数据', noRemote: '未配置远端', noDiff: '没有文本差异（可能是二进制文件、权限变化，或当前视图无变更）。',
  diff: '文件差异', instructions: '选择文件进行暂存或跟踪，点击文件名查看差异。',
  stats: '已跟踪文本行变化：工作区 / 暂存区。不含未跟踪文件和二进制内容。',
  hgStats: '已跟踪文本行变化。不含未跟踪文件和二进制内容。',
  path: '路径', parents: '父提交', conflict: '存在未解决的冲突', noHistory: '暂无提交记录', noWorktrees: '工作树列表适用于 Git。',
  selectedFiles: '本次操作的文件', details: '详情', description: '查看仓库与变更，使用 Git 或 Mercurial 显式提交、推送。',
  cancelled: '请求已取消。重试写入前请刷新仓库状态。',
}
export function errorMessage(error: unknown, t: typeof en): string {
  const code = error instanceof Error ? error.message : ''
  if (code === 'REVISION_CONFLICT') return t.stale
  if (code === 'TOOL_MISSING') return t.missing
  if (code === 'COMMAND_FAILED') return t.command
  if (code.endsWith('_LIMIT')) return t.limit
  if (code === 'CLEAN_WORKTREE_REQUIRED') return t.dirtyHelp
  if (code === 'UNRESOLVED_CONFLICT') return t.conflict
  if (code === 'CANCELLED') return t.cancelled
  if (/INVALID_|NOTHING_STAGED|SELECT_FILES|BRANCH_EXISTS|BRANCH_REQUIRED|UNSUPPORTED_/.test(code)) return t.invalid
  return t.unknown
}
