const https = require("https");
const tiktoken = require("js-tiktoken");
const encoding = tiktoken.getEncoding("cl100k_base");
const tokenUsage = {
  prompt_tokens: 0,
  completion_tokens: 0,
  total_tokens: 0,
};

// https://platform.openai.com/docs/guides/gpt/managing-tokens
const numTokensFromPrompt = (messages) => {
  let numTokens = 0;

  for (const message of messages) {
    numTokens += 4; // every message follows <im_start>{role/name}\n{content}<im_end>\n

    for (const [key, value] of Object.entries(message)) {
      numTokens += encoding.encode(value).length;

      if (key === "name") numTokens -= 1; // role is always required and always 1 token
    }
  }

  numTokens += 2; // every reply is primed with <im_start>assistant

  return numTokens;
};

const options = {
  hostname: "api.openai.com",
  path: "/v1/chat/completions",
  port: 443,
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  },
};

const payload = {
  model: "gpt-3.5-turbo",
  messages: [
    {
      role: "user",
      content: "say hello world",
    },
  ],
  temperature: 0.7,
  stream: true,
};

tokenUsage.prompt_tokens = numTokensFromPrompt(payload.messages);

const request = https.request(options, (res) => {
  let content = "";
  res.on("data", (chunk) => {
    const jsonString = chunk.toString();
    const prefixToRemove = "data: ";
    const trimmedString = jsonString.slice(prefixToRemove.length);
    try {
      const jsonObject = JSON.parse(trimmedString);
      const deltaContent = jsonObject.choices[0]?.delta.content || "";
      content += deltaContent;
    } catch (error) {
      console.error("Error counting tokens from OpenAI response:", error);
    }
  });
  res.on("end", () => {
    const tokens = encoding.encode(content);
    tokenUsage.completion_tokens = tokens.length;
    if (tokens.length > 0) tokenUsage.completion_tokens += 1; // +1 missing token from first chunk: https://community.openai.com/t/stream-response-from-v1-chat-completions-endpoint-is-missing-the-first-token/187835/7?u=zenbuidler
    tokenUsage.total_tokens = tokenUsage.prompt_tokens + tokenUsage.completion_tokens;
    console.log("tokenUsage", tokenUsage);
  });
});
request.write(JSON.stringify(payload));
request.end();
