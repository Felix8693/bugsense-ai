# BugSense AI — MVP 手动测试清单

> 版本：v1.0  
> 对应蓝图：BUGSENSE_BLUEPRINT_v1.2.md 第 20 节 MVP 验收标准  
> 更新日期：2026-05-23

---

## 1. 测试前置条件

- [ ] `docker-compose up` 启动 backend + redis
- [ ] `cd frontend && npm run dev` 启动前端
- [ ] 浏览器访问 `http://localhost:3000`，确认页面正常加载
- [ ] 后端 `/health` 接口返回 200
- [ ] 环境变量已配置（`MIMO_API_KEY`、`MIMO_BASE_URL`、`MIMO_MODEL`、`REDIS_URL`）

---

## 2. 测试用例清单

### 2.1 API Key 脱敏

**目标**：粘贴含 API Key 的报错 → 脱敏后分析 → warnings 中出现密钥提醒

**前置条件**：确保 Redis 中无该报错的缓存

**步骤**：
1. 切换到「开发者模式」
2. 在输入框粘贴以下报错：
   ```
   Error: OpenAI API request failed
   API Key: sk-abc1234567890123456789012345678901234567890
   Status: 401 Unauthorized
   ```
3. 点击「分析」按钮
4. 等待结果返回

**验收标准**：
- [ ] 返回 200，结果正常展示
- [ ] `result.warnings` 中包含敏感信息提醒（如「检测到你的报错中包含 OpenAI API Key」）
- [ ] 响应中 `cached` 为 `false`
- [ ] 后端日志中不包含原始 `sk-abc...` 值（只有脱敏后的 `[REDACTED_OPENAI_KEY]`）
- [ ] 结果内容中不包含原始 API Key

**异常场景**：
- 如果 warnings 为空 → 检查 `backend/core/redactor.py` 正则是否匹配
- 如果结果中仍可见原始 Key → 脱敏器未生效，检查 `redact()` 调用顺序

---

### 2.2 缓存命中 + warnings 追加

**目标**：相同报错第 2 次请求 → cached:true，但本次输入仍触发脱敏检查 → warnings 仍出现密钥提醒

**前置条件**：2.1 测试已完成（Redis 中已有该报错缓存）

**步骤**：
1. 保持在同一页面（不清除输入）
2. 再次点击「分析」按钮（或刷新页面后粘贴相同报错）
3. 等待结果返回

**验收标准**：
- [ ] 返回 200，结果正常展示
- [ ] `cached` 为 `true`（响应更快）
- [ ] `result.warnings` 中**仍然**包含敏感信息提醒（动态追加，非来自缓存）
- [ ] 后端日志显示命中缓存

**异常场景**：
- 如果 `cached` 为 `false` → 缓存 key 不一致，检查 `_make_key()` 实现
- 如果 warnings 为空 → 缓存命中时未动态追加 warnings，检查 `routers/analyze.py` 缓存命中分支

---

### 2.3 visitor_id 限流

**目标**：visitor_id 超过 10 次 → 429 RATE_LIMIT_VISITOR

**前置条件**：
- 确保 Redis 中该 visitor_id 的计数为 0（可手动删除 key 或等待次日重置）
- 准备一个有效的报错文本（如 npm 报错）

**步骤**：
1. 打开浏览器开发者工具 → Application → Local Storage → 找到 `bugsense_vid`，记录该值
2. 连续发送 10 次分析请求（每次使用不同报错文本避免缓存命中）
3. 第 11 次发送请求

**验收标准**：
- [ ] 前 10 次请求均返回 200
- [ ] 第 11 次请求返回 429
- [ ] 429 响应体包含 `error_code: "RATE_LIMIT_VISITOR"`
- [ ] 429 响应体包含中文提示「今日免费次数已用完（每日10次），明天重置」
- [ ] 前端显示限流提示（RateLimitBanner）

**手动重置**（开发环境）：
```bash
# 连接 Redis，删除该 visitor_id 的限流 key
docker exec -it bugsense-ai-redis-1 redis-cli
> KEYS "rate:vid:*"
> DEL rate:vid:<对应hash>
```

---

### 2.4 IP 限流

**目标**：IP 超过 30 次 → 429 RATE_LIMIT_IP

**前置条件**：
- 确保 Redis 中该 IP 的计数为 0
- 可通过清除 visitor_id（清除 localStorage）来单独测试 IP 限流

**步骤**：
1. 清除浏览器 localStorage 中的 `bugsense_vid`（或使用无痕模式）
2. 连续发送 30 次分析请求（每次使用不同报错文本避免缓存命中）
3. 第 31 次发送请求

**验收标准**：
- [ ] 前 30 次请求均返回 200
- [ ] 第 31 次请求返回 429
- [ ] 429 响应体包含 `error_code: "RATE_LIMIT_IP"`
- [ ] 429 响应体包含中文提示「该IP今日免费次数已用完（每日30次），明天重置」

**手动重置**（开发环境）：
```bash
docker exec -it bugsense-ai-redis-1 redis-cli
> KEYS "rate:ip:*"
> DEL rate:ip:<对应hash>
```

---

### 2.5 短输入校验

**目标**：报错内容 < 10 字符 → 400 TOO_SHORT

**步骤**：
1. 在输入框粘贴 `test`（4 个字符）
2. 点击「分析」按钮

**验收标准**：
- [ ] 前端拦截：按钮应禁用或显示提示「至少10个字符」
- [ ] 后端校验：即使绕过前端，直接调用 API 也应返回 400
- [ ] 400 响应体包含 `error_code: "TOO_SHORT"`
- [ ] 400 响应体包含中文提示「报错内容太短，请粘贴完整错误信息（至少10个字符）」

**手动 API 测试**：
```bash
curl -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"error_text": "short", "mode": "developer", "visitor_id": "test1234"}'
```

---

### 2.6 超长输入校验

**目标**：报错内容 > 12000 字符 → 413 TOO_LONG

**步骤**：
1. 生成一段超过 12000 字符的文本（可用在线工具或脚本生成）
2. 粘贴到输入框
3. 点击「分析」按钮

**验收标准**：
- [ ] 前端拦截：按钮应禁用或显示提示「超过12000字符限制」
- [ ] 后端校验：即使绕过前端，直接调用 API 也应返回 413
- [ ] 413 响应体包含 `error_code: "TOO_LONG"`
- [ ] 413 响应体包含中文提示「报错内容超过12000字符，请截取关键部分」

**生成测试数据**：
```bash
python -c "print('A' * 12001)" > /tmp/long_error.txt
```

**手动 API 测试**：
```bash
curl -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d "{\"error_text\": \"$(python -c "print('A' * 12001)")\", \"mode\": \"developer\", \"visitor_id\": \"test1234\"}"
```

---

### 2.7 模型非 JSON fallback

**目标**：模型返回非标准 JSON → fallback 结果，不出现 500

**前置条件**：需要临时修改 `backend/providers/mimo.py` 使 `complete()` 返回非 JSON 文本（测试后恢复）

**步骤**：
1. 修改 `mimo.py` 的 `complete()` 方法，使其返回如下文本：
   ```
   这是一个错误，你需要重启电脑。
   建议联系技术支持。
   ```
2. 重启后端
3. 发送任意分析请求
4. 观察结果

**验收标准**：
- [ ] 返回 200（不是 500）
- [ ] 结果为 fallback 降级内容（开发者模式：`error_type` 为「解析异常」，`confidence` 为 0.1）
- [ ] `result.warnings` 包含「本次分析结果为降级输出，准确性有限」
- [ ] 后端日志显示 `JSON extraction failed, using fallback`

**恢复**：测试完成后还原 `mimo.py`

---

### 2.8 MiMo API 401 鉴权失败

**目标**：MiMo API 返回 401 → 502 UPSTREAM_ERROR（不暴露原始错误）

**前置条件**：临时将 `MIMO_API_KEY` 设为无效值

**步骤**：
1. 修改 `backend/.env`，将 `MIMO_API_KEY` 改为 `invalid_key_12345`
2. 重启后端
3. 发送任意分析请求
4. 观察结果

**验收标准**：
- [ ] 返回 502（不是 500 或 401）
- [ ] 响应体包含 `error_code: "UPSTREAM_ERROR"`
- [ ] 响应体包含中文提示「上游模型鉴权失败，请联系管理员」
- [ ] 响应中**不包含**原始 API Key 或 MiMo 接口地址
- [ ] 前端显示友好错误提示，不暴露技术细节

**恢复**：测试完成后恢复正确的 `MIMO_API_KEY`

---

### 2.9 MiMo API 超时

**目标**：MiMo API 超时 → 504 TIMEOUT

**前置条件**：临时修改 `mimo.py` 的 `self.timeout` 为极小值（如 0.001 秒）

**步骤**：
1. 修改 `backend/providers/mimo.py`，将 `self.timeout = 60.0` 改为 `self.timeout = 0.001`
2. 重启后端
3. 发送任意分析请求
4. 观察结果

**验收标准**：
- [ ] 返回 504（不是 500）
- [ ] 响应体包含 `error_code: "TIMEOUT"`
- [ ] 响应体包含中文提示「分析超时，请缩短报错内容后重试」
- [ ] 前端显示超时提示，不显示技术性错误

**恢复**：测试完成后恢复 `self.timeout = 60.0`

---

## 3. 快速验证脚本（curl）

以下命令可在终端快速验证后端行为，无需前端参与。

```bash
# 替换 <TOKEN> 为实际 MiMo API Key（仅用于后端 .env）

# 3.1 健康检查
curl -s http://localhost:8000/health | python -m json.tool

# 3.2 正常请求（npm 报错）
curl -s -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "error_text": "npm ERR! code MODULE_NOT_FOUND\nnpm ERR! Cannot find module express",
    "mode": "developer",
    "visitor_id": "testvid12345678"
  }' | python -m json.tool

# 3.3 含 API Key 的请求
curl -s -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "error_text": "Error: OpenAI API failed\nAPI Key: sk-abc1234567890123456789012345678901234567890\nStatus: 401",
    "mode": "developer",
    "visitor_id": "testvid12345678"
  }' | python -m json.tool

# 3.4 短输入（预期 400）
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"error_text": "short", "mode": "developer", "visitor_id": "test1234"}'

# 3.5 超长输入（预期 413）
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d "{\"error_text\": \"$(python -c "print('A' * 12001)")\", \"mode\": \"developer\", \"visitor_id\": \"test1234\"}"
```

---

## 4. 测试结果记录模板

| 用例 ID | 用例名称 | 预期结果 | 实际结果 | 状态 | 备注 |
|---------|---------|---------|---------|------|------|
| 2.1 | API Key 脱敏 | warnings 含密钥提醒 | | | |
| 2.2 | 缓存命中 + warnings | cached:true + warnings 追加 | | | |
| 2.3 | visitor_id 限流 | 第11次返回 429 | | | |
| 2.4 | IP 限流 | 第31次返回 429 | | | |
| 2.5 | 短输入校验 | 返回 400 TOO_SHORT | | | |
| 2.6 | 超长输入校验 | 返回 413 TOO_LONG | | | |
| 2.7 | 非 JSON fallback | 返回 fallback，不 500 | | | |
| 2.8 | MiMo 401 | 返回 502 UPSTREAM_ERROR | | | |
| 2.9 | MiMo 超时 | 返回 504 TIMEOUT | | | |

**状态说明**：✅ 通过 / ❌ 失败 / ⚠️ 部分通过 / 🔄 待测试

---

## 5. 测试顺序建议

推荐按以下顺序执行，减少重复操作：

1. **2.5 短输入** → 2.6 超长输入**（边界校验，无需 AI 调用，快速）
2. **2.1 API Key 脱敏** → **2.2 缓存命中 warnings**（依赖顺序）
3. **2.3 visitor_id 限流** → **2.4 IP 限流**（限流测试，需清 Redis）
4. **2.7 非 JSON fallback**（需改代码，单独测试）
5. **2.8 MiMo 401** → **2.9 MiMo 超时**（需改配置/代码，最后测试）

---

## 6. 已知限制

- 限流测试依赖 Redis，每次测试后需手动清理 key 或等待次日重置
- 2.7/2.8/2.9 需要临时修改代码或配置，测试后务必恢复
- 手动测试无法覆盖并发场景，后续可补充 pytest 自动化测试
- V0.1 不含流式输出测试项（留待 V0.2）

---

*本文档仅用于手动验证，不修改任何业务代码。*
