import { execSync } from 'node:child_process'
import fs from 'node:fs'

// ===== 1. 只拿 PR 的 diff（对比 main，不是全局代码） =====
console.log('📥 获取代码变更 diff...')
// 只审查这次 push 的改动（before → after），而不是整个分支相对 main 的累积 diff
// execSync('git fetch origin main --quiet') //这是为了确保有最新的 main 分支代码
const before = process.env.BEFORE_SHA
const after = process.env.AFTER_SHA
const diff = execSync(`git diff ${before}...${after}`, {
  maxBuffer: 10 * 1024 * 1024, // 防止 diff 太大撑爆缓冲区
}).toString()

if (!diff.trim()) {
  console.log('✅ 没有代码变更，跳过审查')
  process.exit(0)
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

代码 diff：
\`\`\`diff
${diff}
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
    temperature: 0.3, // 降低随机性，让审查结果更稳定
  }),
})

if (!res.ok) {
  console.error('❌ DeepSeek API 调用失败:', res.status, await res.text())
  process.exit(1)
}

const data = await res.json()
const review = data.choices[0].message.content

// ===== 4. 判断是否有问题 =====
const isFail = /STATUS:\s*FAIL/.test(review)

// ===== 5. 生成独立文档 =====
const date = new Date().toISOString().slice(0, 10)
const commit = process.env.AFTER_SHA || 'unknown'
const shortCommit = commit.slice(0, 7)   // 取 commit 前 7 位做标识
const dir = 'docs/ai-review'
fs.mkdirSync(dir, { recursive: true })

const filePath = `${dir}/push-${shortCommit}-${date}.md`
const doc = `# AI 代码审查报告

- PR: #${prNumber}
- 日期: ${date}
- 结论: ${isFail ? '❌ 不通过（需修改）' : '✅ 通过'}

---

${review}
`

fs.writeFileSync(filePath, doc)
console.log(`📄 审查报告已生成: ${filePath}`)

// ===== 6. 提交文档到 PR 分支（带 [skip review] 防止死循环） =====
console.log('📤 提交审查报告到 PR 分支...')
execSync('git config user.name "github-actions[bot]"')
execSync('git config user.email "github-actions[bot]@users.noreply.github.com"')
execSync('git add docs/ai-review')
execSync('git commit -m "[skip review] 生成 AI 代码审查报告"')
execSync('git push')

// ===== 7. 有问题则阻塞合并 =====
if (isFail) {
  console.error('❌ 发现代码问题，审查不通过')
  process.exit(1) // exit 1 → check 变失败 → 配合 branch protection 阻止 merge
}

console.log('✅ 审查通过')