export const groqConfig = {
  apiKey: "InputYourGroqApiKey",
  model: "mistral-saba-24b",
  temperature: 0.7,
};

export const proxyConfig = {
  useProxy: true, // type "false" if not use proxy
};

export const rateLimitConfig = {
  maxRetries: 5,
  baseDelay: 2000,
  maxDelay: 10000,
  requestsPerMinute: 15,
  intervalBetweenCycles: 5000,
  walletVerificationRetries: 3,
};

export const agents = {
  deployment_R89FtdnXa7jWWHyr97WQ9LKG: "Professor",
  deployment_fseGykIvCLs3m9Nrpe9Zguy9: "Crypto Buddy",
  deployment_zs6OE0EdBuQuit8KK0V10dJT: "Sherlock",
};


export const Code = {
  code: "rgwSKk46"
};

