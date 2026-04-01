# 大模型API Key汇总

## 心流

>   iFlow API 将于2026年4月17日（北京时间）正式停止服务。

-   Project docs url: [https://platform.iflow.cn/docs](https://platform.iflow.cn/docs)

### 支持的模型

-   iflow-rome-30ba3b
-   qwen3-coder-plus
-   qwen3-max
-   qwen3-vl-plus
-   kimi-k2-0905
-   qwen3-max-preview
-   kimi-k2
-   deepseek-v3.2
-   deepseek-r1
-   deepseek-v3
-   qwen3-32b
-   qwen3-235b-a22b-thinking-2507
-   qwen3-235b-a22b-instruct
-   qwen3-235b

### API Key

| base_url                  | API Key                             | comment              |
| ------------------------- | ----------------------------------- | -------------------- |
| https://apis.iflow.cn/v1/ | sk-78a59dcc7cfc27a616901049db23dbd4 | 过期时间：2026-04-04 |
| https://apis.iflow.cn/v1/ | sk-247263e68e19fdfced9baf3f25fa458d | 过期时间：2026-04-05 |

### 示例程序

```bash
curl https://apis.iflow.cn/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-247263e68e19fdfced9baf3f25fa458d" \
  -d '{
    "model": "qwen3-coder-plus",
    "messages": [
      {"role": "system", "content": "你是一个专业的AI助手。"},
      {"role": "user", "content": "请介绍一下人工智能的发展历史"}
    ],
    "temperature": 0.7,
    "max_tokens": 1000
  }'
```

示例程序测试结果：[https://app.warp.dev/block/GNwtquEvP9KynZ51Hvcig1](https://app.warp.dev/block/GNwtquEvP9KynZ51Hvcig1)

## 白山智算



## Groq

>   设备需要支持外网环境

-   Project docs url: [https://console.groq.com/docs/overview](https://console.groq.com/docs/overview)

### 支持的模型

-   openai/gpt-oss-20b
-   allam-2-7b
-   canopylabs/orpheus-arabic-saudi
-   moonshotai/kimi-k2-instruct
-   meta-llama/llama-prompt-guard-2-86m
-   groq/compound
-   whisper-large-v3-turbo
-   meta-llama/llama-prompt-guard-2-22m
-   canopylabs/orpheus-v1-english
-   openai/gpt-oss-safeguard-20b
-   groq/compound-mini
-   llama-3.3-70b-versatile
-   llama-3.1-8b-instant
-   whisper-large-v3
-   moonshotai/kimi-k2-instruct-0905
-   qwen/qwen3-32b
-   openai/gpt-oss-120b
-   meta-llama/llama-4-scout-17b-16e-instruct

### API Key

| base url                       | API Key                                                  | comment |
| :----------------------------- | :------------------------------------------------------- | ------- |
| https://api.groq.com/openai/v1 | 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 | 无      |

### 示例程序

```bash
curl -X POST https://api.groq.com/openai/v1/responses \
-H "Authorization: Bearer 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" \
-H "Content-Type: application/json" \
-d '{
    "model": "qwen/qwen3-32b",
    "input": "Explain the importance of fast language models"
}'
```

示例程序测试结果: [https://app.warp.dev/block/9JgwzJbkgtvtpIXlVDlQuw0](https://app.warp.dev/block/9JgwzJbkgtvtpIXlVDlQuw)

## OpenRouter

-   Project docs url: [https://openrouter.ai/models](https://openrouter.ai/models)

### 支持的模型

-   qwen/qwen3.6-plus-preview:free
-   qwen/qwen3-next-80b-a3b-instruct:free
-   qwen/qwen3-coder:free
-   minimax/minimax-m2.5:free
-   bytedance-seed/seedream-4.5
-   black-forest-labs/flux.2-max
-   google/lyria-3-pro-preview
-   google/lyria-3-clip-preview
-   google/gemma-3n-e2b-it:free
-   google/gemma-3n-e4b-it:free
-   google/gemma-3-4b-it:free
-   google/gemma-3-12b-it:free
-   google/gemma-3-27b-it:free
-   meta-llama/llama-3.3-70b-instruct:free
-   nousresearch/hermes-3-llama-3.1-405b:free
-   liquid/lfm-2.5-1.2b-thinking:free
-   arcee-ai/trinity-mini:free
-   nvidia/nemotron-nano-12b-v2-vl:free
-   nvidia/nemotron-nano-9b-v2:free
-   nvidia/nemotron-3-super-120b-a12b:free
-   openai/gpt-oss-120b:free
-   openai/gpt-oss-20b:free
-   z-ai/glm-4.5-air:free

### API Key

| base url                     | API Key                                                      | comment |
| ---------------------------- | ------------------------------------------------------------ | ------- |
| https://openrouter.ai/api/v1 | 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 | 无      |

### 示例程序

```bash
curl https://openrouter.ai/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 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" \
  -d '{
  "model": "qwen/qwen3.6-plus-preview:free",
  "messages": [
    {
      "role": "user",
      "content": "How many r`s are in the word `strawberry?`"
    }
  ],
  "reasoning": {
    "enabled": true
  }
}'
```

示例程序测试结果：[https://app.warp.dev/block/Hyk2ULXtxGF6mS9Zz31hCZ](https://app.warp.dev/block/Hyk2ULXtxGF6mS9Zz31hCZ)

