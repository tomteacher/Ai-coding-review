import { execSync } from 'node:child_process'
import fs from 'node:fs'

const MAX_DIFF_CHARS = 60000 // 约 15K token，留足输出空间

// ===== 1. 获取 PR 的 diff（base → head） =====
console.log('📥 获取 PR 代码变更 diff...')
const before = process.env.BEFORE_SHA
const after = process.env.AFTER_SHA

if (!before || !after) {
  console.error('❌ 缺少 BEFORE_SHA / AFTER_SHA，请确认由 pull_request 事件触发')
  process.exit(1)
}

let diff = ''
try {
  diff = execSync(`git diff ${before}...${after}`, {
    maxBuffer: 10 * 1024 * 1024,
  }).toString()
} catch (e) {
  console.error('❌ 计算 diff 失败:', e.message)
  process.exit(1)
}

if (!diff.trim()) {
  console.log('✅ 没有代码变更，跳过审查')
  process.exit(0)
}

// 防止 diff 过长超出模型上下文
let diffForPrompt = diff
let truncated = false
if (diff.length > MAX_DIFF_CHARS) {
  diffForPrompt = diff.slice(0, MAX_DIFF_CHARS)
  truncated = true
  console.log(
    `⚠️  diff 过长（${diff.length} 字符），已截断到 ${MAX_DIFF_CHARS}，仅审查前部分`
  )
}

// ===== 2. 构造审查 prompt =====
const prompt = `你是一名资深前端工程师，请审查下面这段代码变更（git diff）。

要求：
1. 只分析 diff 中新增或修改的代码，绝不评论未改动的代码
2. 用中文输出，严格使用 markdown 格式
3. 报告结构：
   - 第一行单独输出状态标记：STATUS: PASS 或 STATUS: FAIL
   - 然后输出「## ✅ 优点」（列出做得好的地方）
   - 然后输出「## ❌ 问题」（列出问题，每个问题包含：严重程度、位置、原因、修改建议）
4. 判断标准：只有在 diff 中存在明确的 bug、安全隐患、明显违反规范、或严重影响可读性/维护性的代码时，才输出 STATUS: FAIL，否则输出 STATUS: PASS。不要吹毛求疵。

代码 diff${truncated ? '（注意：因过长已截断，只展示前部分）' : ''}：
\`\`\`diff
${diffForPrompt}
\`\`\``

// ===== 3. 调用 DeepSeek API =====
console.log('🤖 调用 DeepSeek 进行审查...')
const res = await fetch('https://api.deepseek.com/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
  },
  body: JSON.stringify({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
  }),
})

if (!res.ok) {
  console.error('❌ DeepSeek API 调用失败:', res.status, await res.text())
  process.exit(1)
}

const data = await res.json()
const review = data.choices[0].message.content

// ===== 4. 判断是否有问题（fail-safe：没匹配到 STATUS 视为不通过） =====
const statusMatch = review.match(/STATUS:\s*(PASS|FAIL)/i)
let isFail = false
let statusText = '✅ 通过'

if (!statusMatch) {
  console.warn('⚠️  AI 输出未包含 STATUS 标记，按格式异常处理，视为不通过')
  isFail = true
  statusText = '⚠️ 格式异常（状态未知）'
} else if (statusMatch[1].toUpperCase() === 'FAIL') {
  isFail = true
  statusText = '❌ 不通过（需修改）'
}

// ===== 5. 生成审查报告文档 =====
const date = new Date().toISOString().slice(0, 10)
const commit = process.env.AFTER_SHA || 'unknown'
const shortCommit = commit.slice(0, 7)
const prNumber = process.env.PR_NUMBER || 'unknown'
const dir = 'docs/ai-review'
fs.mkdirSync(dir, { recursive: true })

const filePath = `${dir}/pr-${prNumber}-${shortCommit}-${date}.md`
const doc = `# AI 代码审查报告

- PR: #${prNumber}
- 提交: ${shortCommit}
- 日期: ${date}
- 结论: ${statusText}

---

${review}
`

fs.writeFileSync(filePath, doc)
console.log(`📄 审查报告已生成: ${filePath}`)

// ===== 6. 提交报告回 PR 的 head 分支（带 [skip review] 防止死循环） =====
console.log('📤 提交审查报告到 PR 分支...')
execSync('git config user.name "github-actions[bot]"')
execSync('git config user.email "github-actions[bot]@users.noreply.github.com"')
execSync('git add docs/ai-review')

const hasStaged = (() => {
  try {
    execSync('git diff --staged --quiet', { stdio: 'pipe' })
    return false
  } catch {
    return true
  }
})()

if (!hasStaged) {
  console.log('ℹ️  没有需要提交的新报告，跳过 commit/push')
} else {
  execSync('git commit -m "[skip review] 生成 AI 代码审查报告 (PR #${prNumber})"'.replace('${prNumber}', prNumber))
  try {
    execSync('git push', { stdio: 'inherit' })
    console.log('✅ 报告已推送到 PR 分支')
  } catch (e) {
    // fork PR 的 token 只读，push 会失败；不阻断审查结论
    console.warn('⚠️  推送报告失败（fork PR 属正常现象），不影响审查结论:', e.message)
  }
}

// ===== 7. 有问题则阻塞合并 =====
if (isFail) {
  console.error('❌ 审查不通过')
  process.exit(1)
}

console.log('✅ 审查通过')