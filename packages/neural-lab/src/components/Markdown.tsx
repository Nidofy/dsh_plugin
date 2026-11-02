import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
const labels = {
  code: { copyLabel: '复制 Copy', copiedLabel: '已复制 Copied' },
  footnotes: '参考 References',
}
export function Markdown({ text }: { text: string }) {
  return <MarkdownText text={text} labels={labels} />
}
