import json
from datetime import datetime
import requests

def chat_with_model(
    messages,                  
    model="deepseek-r1:1.5b",
    tools=None,                
    stream=False,
    url='http://localhost:11434/api/chat'
):
    payload = {
        "model": model,
        "messages": messages,
        "stream": stream
    }
    if tools:
        payload["tools"] = tools
    response = requests.post(url, json=payload)
    if response.status_code != 200:
        raise Exception(f"请求失败，状态码：{response.status_code}")

    # 流式返回文本，非流式返回 JSON 对象（直接 .json() 解析）
    if stream:
        return response.text   # NDJSON 字符串
    else:
        return response.json() # 字典
# ---------- 工具定义 ----------
def get_current_time():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def add_numbers(a: int, b: int):
    return str(a + b)

available_functions = {
    "get_current_time": get_current_time,
    "add_numbers": add_numbers,
}

tools_schema = [
    {
        "type": "function",
        "function": {
            "name": "get_current_time",
            "description": "获取当前日期和时间，无需参数",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "add_numbers",
            "description": "计算两个整数的和",
            "parameters": {
                "type": "object",
                "properties": {
                    "a": {"type": "integer", "description": "第一个数字"},
                    "b": {"type": "integer", "description": "第二个数字"}
                },
                "required": ["a", "b"]
            }
        }
    }
]

# ---------- Agent 主函数 ----------
def simple_agent(user_input, model="deepseek-r1:1.5b"): 
    messages = [{"role": "user", "content": user_input}]

    resp = chat_with_model(messages, model=model, tools=tools_schema, stream=False)
    assistant_msg = resp['message']
    messages.append(assistant_msg)  # 加入历史

    # 如果有工具调用请求
    if 'tool_calls' in assistant_msg:
        for tool_call in assistant_msg['tool_calls']:
            func_name = tool_call['function']['name']
            func_args = json.loads(tool_call['function']['arguments'])
            func = available_functions.get(func_name)
            if func:
                result = func(**func_args) if func_args else func()
            else:
                result = f"错误：未找到工具 {func_name}"
            
            # 将工具结果作为 tool 消息追加
            messages.append({
                "role": "tool",
                "content": result
            })
        
        # 第二次调用：让模型根据工具结果生成最终回答
        final_resp = chat_with_model(messages, model=model, stream=False)
        return final_resp['message']['content']
    else:
        # 没有工具调用，直接返回模型回答
        return assistant_msg['content']

# ---------- 测试 ----------
if __name__ == "__main__":
    print("用户: 现在几点了？")
    print("Agent:", simple_agent("现在几点了？"))
    print("\n用户: 15加27等于多少？")
    print("Agent:", simple_agent("15加27等于多少？"))