// Adapted from deepseek-harness-leetcode. Copyright (c) 2026 kapelame. MIT; see LICENSE.
/** Local lexical completion; no network, model, or language server is used. */
import type { CodeLanguage } from './editor-types.ts'

const words: Record<CodeLanguage, string> = {
  cpp: 'alignas auto bool break case catch char class const constexpr continue default delete do double else enum explicit false float for if int long namespace new nullptr private protected public return short signed sizeof static struct switch template this throw true try typedef typename unsigned using virtual void volatile while std string vector array pair tuple map unordered_map set unordered_set queue priority_queue stack deque list bitset optional ListNode TreeNode Node Solution INT_MAX INT_MIN LLONG_MAX LLONG_MIN',
  python:
    'and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield self int float str bool list dict set tuple List Optional np numpy torch',
  typescript:
    'async await break case catch class const continue default delete do else enum export extends false finally for function if implements import in instanceof interface let new null of private protected public readonly return static super switch this throw true try type typeof undefined var void while number string boolean Array Map Set Promise ListNode TreeNode Node Solution',
}
const calls: Record<CodeLanguage, string> = {
  cpp: 'sort stable_sort lower_bound upper_bound binary_search reverse max min swap abs accumulate iota max_element min_element next_permutation make_pair make_tuple move to_string stoi stoll push_back pop_back emplace_back push pop top front back begin end rbegin rend size empty clear insert erase find count reserve resize substr length',
  python:
    'len range enumerate zip sorted reversed min max sum abs all any print isinstance int str list dict set tuple append extend insert pop remove sort reverse clear copy get items keys values add discard update split join strip startswith endswith reshape transpose swapaxes matmul softmax exp log sum mean backward zero_grad detach tensor asarray array concatenate split einsum',
  typescript:
    'push pop shift unshift slice splice sort reverse map filter reduce forEach find findIndex includes indexOf join split substring charAt charCodeAt set get has add delete clear entries keys values max min floor ceil abs trunc parseInt Number String Array',
}

export interface Completion {
  readonly label: string
  readonly insert: string
  /** Caret offset within the inserted text. */
  readonly caret: number
}
export interface CompletionList {
  readonly from: number
  readonly to: number
  readonly items: readonly Completion[]
}

function codeOnly(source: string, language: CodeLanguage): string {
  // Preserve offsets while excluding comments/strings, including unfinished ones.
  const pattern =
    language === 'python'
      ? /#[^\n]*|"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\[\s\S]|[^"\\])*(?:"|$)|'(?:\\[\s\S]|[^'\\])*(?:'|$)/g
      : /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)|"(?:\\[\s\S]|[^"\\])*(?:"|$)|'(?:\\[\s\S]|[^'\\])*(?:'|$)|`(?:\\[\s\S]|[^`\\])*(?:`|$)/g
  return source.replace(pattern, (match) => ' '.repeat(match.length))
}

/** Offer keywords, common library methods and identifiers from this document. */
export function complete(
  source: string,
  position: number,
  language: CodeLanguage,
  explicit = false,
): CompletionList | undefined {
  if (position < 0 || position > source.length || source.length > 200_000) return undefined
  const prefixCode = codeOnly(source.slice(0, position), language)
  if (position > 0 && prefixCode[position - 1] !== source[position - 1]) return undefined
  const prefix = /[A-Za-z_$][\w$]*$/.exec(prefixCode)?.[0] ?? ''
  if (!explicit && prefix.length < 2) return undefined
  const from = position - prefix.length
  const suffix = /^[\w$]*/.exec(source.slice(position))?.[0] ?? ''
  const identifiers = codeOnly(source, language).match(/[A-Za-z_$][\w$]*/g) ?? []
  const candidates = new Map<string, boolean>()
  for (const name of words[language].split(' ')) candidates.set(name, false)
  for (const name of calls[language].split(' ')) candidates.set(name, true)
  // Document identifiers are completed verbatim; no guessed argument signatures.
  for (const name of identifiers) if (!candidates.has(name)) candidates.set(name, false)
  const items = [...candidates]
    .filter(([name]) => name.startsWith(prefix) && name !== prefix + suffix)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 12)
    .map(([label, callable]) => {
      const parentheses = callable && !/^\s*\(/.test(source.slice(position + suffix.length))
      return {
        label,
        insert: label + (parentheses ? '()' : ''),
        caret: label.length + (parentheses ? 1 : 0),
      }
    })
  return items.length ? { from, to: position + suffix.length, items } : undefined
}
