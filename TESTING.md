\# BugSense AI 测试清单



\## 线上地址



Frontend:



https://bugsense-ai-flame.vercel.app



Backend Health:



https://bugsense-ai-production.up.railway.app/health



\---



\## 1. Python ImportError



\### 输入



```text

ModuleNotFoundError: No module named 'requests'

检查结果

√能识别为 Python

√能说明缺少 requests 包

√能给出 pip install requests

√能给出预防建议

实际返回摘要

Python代码尝试导入名为'requests'的模块，但该模块未安装在当前Python环境中，导致导入失败。



2\. Node.js 缺少模块

输入

Error: Cannot find module 'express'

Require stack:

\- C:\\Users\\xiasy\\Desktop\\app\\server.js

检查结果

&#x20;√能识别为 Node.js

&#x20;√能说明 express 未安装

&#x20;√能建议 npm install express

&#x20;√能提示检查 package.json

实际返回摘要

ode.js 在 server.js 文件中尝试加载 'express' 模块时失败，因为该模块未安装或安装路径不正确。这通常是因为项目依赖未通过 npm install 正确安装。



3\. npm 依赖冲突

输入

npm ERR! code ERESOLVE

npm ERR! ERESOLVE unable to resolve dependency tree

npm ERR!

npm ERR! Found: react@19.0.0

npm ERR! Could not resolve dependency:

npm ERR! peer react@"^18.0.0" from some-old-ui-library@2.3.1

检查结果

&#x20;√能识别为 npm dependency conflict

√ 能解释 peer dependency

&#x20;√能建议更换版本或使用 --legacy-peer-deps

&#x20;√能提醒不要盲目使用 --force

实际返回摘要

系统正确识别为 npm 依赖版本冲突，指出 React 19 与 some-old-ui-library 要求的 React 18 peer dependency 不兼容。修复建议包括检查 package.json、使用 npm install --legacy-peer-deps、升级旧库或降级 React，并给出了 package-lock.json 和 peer dependency 检查等预防建议。



4\. Docker build error

输入

failed to solve: process "/bin/sh -c npm install" did not complete successfully: exit code: 1

检查结果

√ 能识别为 Docker 构建错误

√能提示 npm install 阶段失败

√ 能建议检查 package.json / lock file / 网络

√能给出 Dockerfile 排查建议

实际摘要返回

系统正确识别为 Docker 构建过程中 npm install 命令失败，指出可能原因包括依赖冲突、网络连接问题、Node.js 版本不兼容或权限不足。修复建议包括检查 Node.js 基础镜像版本、本地运行 npm install 查看详细日志、清理 npm 缓存、使用 --legacy-peer-deps，以及将 Dockerfile 中的 npm install 替换为 npm ci --production。预防建议中也提到了使用 package-lock.json / yarn.lock 锁定依赖、指定精确 Node.js 镜像版本，并检查网络代理或 npm registry 配置。



5\. Next.js hydration error

输入

Error: Hydration failed because the initial UI does not match what was rendered on the server.

检查结果

&#x20;√能识别为 Next.js / React hydration error

&#x20;√能解释服务端和客户端渲染不一致

&#x20;√能建议检查 window/localStorage/random/date 等客户端逻辑

&#x20;√能给出 useEffect 或 dynamic import 方案

实际返回摘要

系统正确识别为 React / Next.js 的 Hydration 失败问题，指出根因是服务器渲染 HTML 与客户端初始渲染结果不一致。分析中提到了浏览器 API、客户端状态、localStorage、URL 参数等常见原因，并建议将客户端特定逻辑移入 useEffect。代码示例展示了如何把 window.innerWidth 从直接渲染中移到 useEffect 中，同时预防建议也提到了 Next.js dynamic、Suspense 和保持服务端/客户端渲染一致。



6\. Git 错误

输入

fatal: refusing to merge unrelated histories

检查结果

&#x20;√能识别为 Git 错误

&#x20;√能解释两个仓库历史不相关

&#x20;√能给出 git pull origin main --allow-unrelated-histories

&#x20;√能提醒先备份或检查分支

实际返回摘要

系统正确识别为 Git 合并无关历史记录问题，解释了该错误通常发生在本地仓库和远程仓库没有共同提交历史时。修复建议给出了 git pull origin main --allow-unrelated-histories，并提醒使用该参数前要谨慎，避免把不相关项目历史错误合并，同时建议在影响提交历史的操作前做好备份。



7\. 空输入

输入



不输入任何内容，直接点击分析。



检查结果

&#x20;√前端提示不能为空

&#x20;√后端不崩溃

&#x20;√页面没有 500 错误

页面在输入框为空时会禁用“开始分析”按钮，用户无法提交空内容，因此不会向后端发送无效请求，也没有出现页面报错或 500 错误。

8\. 重复输入缓存测试

操作



连续两次提交同一段错误日志。



检查结果

&#x20;√第二次响应速度更快

&#x20;√如果页面显示 cached=true，则缓存正常

&#x20;√Railway 后端没有异常

9\. 限流测试

操作



连续多次提交不同错误日志。



检查结果

&#x20;√remaining\_requests 正常变化

&#x20;√超过限制后能给出友好提示

&#x20;√后端不会崩溃





