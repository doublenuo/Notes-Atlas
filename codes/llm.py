from openai import OpenAI
from typing import List



class LLMAdapter:
    def __init__(self, api_key: str,  base_url: str , model: str, timeout: int = 30):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url
        self.timeout = timeout
        self.client = OpenAI(base_url=self.base_url, api_key=self.api_key)


    def __repr__(self):
        return (
            f"LLMAdapter(\n"
            f"  model='{self.model}',\n"
            f"  base_url='{self.base_url}',\n"
            f"  timeout={self.timeout},\n"
            f")"
        )
    
    def think(self, messages: List[dict], temperature: float = 0.7, stream: bool = False):
        print(f"🧠 正在调用 {self.model} 模型...")
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                stream=stream,
                timeout=self.timeout
            )
            if stream:  
                print("✅ 大语言模型响应成功:")
                content = []
                for chunk in response:
                    if not chunk.choices:
                        continue
                    print(chunk.choices[0].delta.content, end='', flush=True)
                    content.append(chunk.choices[0].delta.content)  
                return "".join(content)
            else:
                print(f"✅ 大语言模型响应成功:{response.choices[0].message.content}")
                return response.choices[0].message.content
        except Exception as e:
            print(f"❌ 大语言模型响应失败:{e}")
            return None