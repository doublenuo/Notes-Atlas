# 大模型 API Key 汇总

## 心流

> iFlow API 将于 2026 年 4 月 17 日（北京时间）正式停止服务。

- Project docs url: [https://platform.iflow.cn/docs](https://platform.iflow.cn/docs)

### 支持的模型

- iflow-rome-30ba3b
- qwen3-coder-plus
- qwen3-max
- qwen3-vl-plus
- kimi-k2-0905
- qwen3-max-preview
- kimi-k2
- deepseek-v3.2
- deepseek-r1
- deepseek-v3
- qwen3-32b
- qwen3-235b-a22b-thinking-2507
- qwen3-235b-a22b-instruct
- qwen3-235b

### API Key

| base_url                  | API Key                                                      | comment              |
| ------------------------- | ------------------------------------------------------------ | -------------------- |
| <https://apis.iflow.cn/v1/> | <span style="text-decoration:line-through;">sk-78a59dcc7cfc27a616901049db23dbd4</span> | 过期时间：2026-04-04 |
| <https://apis.iflow.cn/v1/> | <span style="text-decoration:line-through;">sk-247263e68e19fdfced9baf3f25fa458d</span> | 过期时间：2026-04-05 |
| <https://apis.iflow.cn/v1/> | sk-b005fd6623553ee335cc3b11dc85cba3                          | 过期时间：2026-04-10 |
| <https://apis.iflow.cn/v1/> | sk-b4b5519b5aea6b98a04bba91efd1075c                          | 过期时间：2026-04-10 |
| <https://apis.iflow.cn/v1/> | sk-d2495989d89f676c13e3c34c062373c8                          | 过期时间：2026-04-13 |

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

> 注册体验金活动已取消

- Project docs url: [https://ai.baishan.com/key/index](https://ai.baishan.com/key/index)

### 支持的模型

- MiniMax-M2.5
- GLM-5
- GLM-4.7
- DeepSeek-V3.2
- GLM-4.6
- Qwen3-Next-80B-A3B-Instruct
- DeepSeek-R1-0528
- Qwen3-Coder-480B-A35B-Instruct
- GLM-4.5
- KAT-Coder-Exp-72B-1010
- Qwen3-32B-FP8
- Qwen3-30B-A3B-FP8
- DeepSeek-R1-0528-Qwen3-8B
- DeepSeek-V3
- Qwen3-235B-A22B
- DeepSeek-R1-Distill-Qwen-14B
- Qwen2.5-72B-Instruct
- Kimi-K2-Instruct
- Qwen3-235B-A22B-2507
- GLM-4.5V
- Qwen3-Next-80B-A3B-Thinking
- KAT-Coder-Pro-V1
- DeepSeek-V3.2-EXP

### API Key

| base url                  | API Key                                             | Comment |
| ------------------------- | --------------------------------------------------- | ------- |
| <https://api.edgefn.net/v1> | sk-Crcn0itEIkxPf3hxD575F32bA9Fc49B48c95B1EbB776F3De | 无      |
| <https://api.edgefn.net/v1> | sk-IVNSRB82BYrsQXgoC5CeAe7831C6478dA1F627A86cD69aC7 |         |

### 示例程序

```bash
curl --request POST \                                                                                   
  --url https://api.edgefn.net/v1/chat/completions \
  --header 'Authorization: Bearer {Your API Ke}' \
  --header 'Content-Type: application/json' \
  --data '{
  "model": "DeepSeek-R1-0528-Qwen3-8B",
  "messages": [{"role": "user", "content": "Hello, how are you?"}]
}'
```

示例程序测试结果：[https://app.warp.dev/block/J3eq9rwYvbRxvnmrFTjpPC](https://app.warp.dev/block/J3eq9rwYvbRxvnmrFTjpPC)

## Groq

> 设备需要支持外网环境，部分模型调用有限制

- Project docs url: [https://console.groq.com/docs/overview](https://console.groq.com/docs/overview)

### 支持的模型

- openai/gpt-oss-20b
- allam-2-7b
- canopylabs/orpheus-arabic-saudi
- moonshotai/kimi-k2-instruct
- meta-llama/llama-prompt-guard-2-86m
- groq/compound
- whisper-large-v3-turbo
- meta-llama/llama-prompt-guard-2-22m
- canopylabs/orpheus-v1-english
- openai/gpt-oss-safeguard-20b
- groq/compound-mini
- llama-3.3-70b-versatile
- llama-3.1-8b-instant
- whisper-large-v3
- moonshotai/kimi-k2-instruct-0905
- qwen/qwen3-32b
- openai/gpt-oss-120b
- meta-llama/llama-4-scout-17b-16e-instruct

### API Key

| base url                       | API Key                                                  | comment |
| :----------------------------- | :------------------------------------------------------- | ------- |
| <https://api.groq.com/openai/v1> | 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 | 无      |

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

> 支持的模型最多，免费模型调用可能被别人占用

- Project docs url: [https://openrouter.ai/models](https://openrouter.ai/models)

### 支持的模型

- qwen/qwen3.6-plus-preview: free
- qwen/qwen3-next-80b-a3b-instruct: free
- qwen/qwen3-coder: free
- minimax/minimax-m2.5: free
- bytedance-seed/seedream-4.5
- black-forest-labs/flux.2-max
- google/lyria-3-pro-preview
- google/lyria-3-clip-preview
- google/gemma-3n-e2b-it: free
- google/gemma-3n-e4b-it: free
- google/gemma-3-4b-it: free
- google/gemma-3-12b-it: free
- google/gemma-3-27b-it: free
- meta-llama/llama-3.3-70b-instruct: free
- nousresearch/hermes-3-llama-3.1-405b: free
- liquid/lfm-2.5-1.2b-thinking: free
- arcee-ai/trinity-mini: free
- nvidia/nemotron-nano-12b-v2-vl: free
- nvidia/nemotron-nano-9b-v2: free
- nvidia/nemotron-3-super-120b-a12b: free
- openai/gpt-oss-120b: free
- openai/gpt-oss-20b: free
- z-ai/glm-4.5-air: free

### API Key

| base url                     | API Key                                                      | comment |
| ---------------------------- | ------------------------------------------------------------ | ------- |
| <https://openrouter.ai/api/v1> | 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 | 无      |

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

## ChatAnyWhere

> 免费版
>
> - 支持gpt-5.2, gpt-5.1, gpt-5, gpt-4o，gpt-4.1一天5次
> - 支持deepseek-r1, deepseek-v3, deepseek-v3-2-exp一天30次
> - 支持gpt-4o-mini，gpt-3.5-turbo，gpt-4.1-mini，gpt-4.1-nano, gpt-5-mini，gpt-5-nano一天200次。
> - 限制**200请求/天/IP/Key**

### API Key

| base url                         | API Key                                             | Comment |
| -------------------------------- | --------------------------------------------------- | ------- |
| <https://api.chatanywhere.tech/v1> | sk-HokeufMxuJNNLB0jVBDBIwLje5k7Sqi0LSmUHkdohptegZ6c | 无      |

### 示例程序

```bash
curl https://api.chatanywhere.tech/v1/chat/completions \
	-H 'Content-Type: application/json' \
    -H 'Authorization: Bearer YOUR_API_KEY' \
    -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Say this is a test!"}],
    "temperature": 0.7
    }'
```

示例程序测试结果：[https://app.warp.dev/block/7BlGl2NOCLkJmet0AYnXpu](https://app.warp.dev/block/7BlGl2NOCLkJmet0AYnXpu)

# OneAPI

OneAPI是一个LLM API 管理和分发系统，支持多种模型，docker一键部署。

- 项目地址：[https://github.com/songquanpeng/one-api](https://github.com/songquanpeng/one-api)
-
