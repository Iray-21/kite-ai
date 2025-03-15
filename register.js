import { proxyConfig, rateLimitConfig, Code } from "./config.js";
import Web3 from "web3";
import axios from "axios";
import fs from "fs";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import displayBanner from './banner.js';

// 🔥 Load wallets from files
function loadWallets() {
  try {
    const wallets = fs.readFileSync("wallets.txt", "utf8").split("\n").map(line => line.trim()).filter(Boolean);
    const privKeys = fs.readFileSync("priv.txt", "utf8").split("\n").map(line => line.trim()).filter(Boolean);

    if (wallets.length !== privKeys.length) {
      console.error("❌ Mismatch between wallets and private keys!");
      process.exit(1);
    }

    return wallets.map((wallet, index) => ({ address: wallet, privateKey: privKeys[index] }));
  } catch (error) {
    console.error("❌ Error reading wallets.txt or priv.txt:", error.message);
    process.exit(1);
  }
}

// 🔹 Load proxy list from file
function loadProxies() {
  try {
    const proxies = fs.readFileSync("proxy.txt", "utf8") // Ganti "proxies.txt" menjadi "proxy.txt"
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean); // Remove empty lines

    if (proxies.length === 0) {
      console.error("❌ No proxies found in proxy.txt!"); // Ganti pesan error
      process.exit(1);
    }

    return proxies;
  } catch (error) {
    console.error("❌ Error reading proxy.txt:", error.message); // Ganti pesan error
    process.exit(1);
  }
}

// 🔹 Rotate proxy for each request
let proxyIndex = 0;
const proxies = proxyConfig.useProxy ? loadProxies() : []; // Menggunakan proxyConfig dari config.js

function getNextProxy() {
  if (!proxyConfig.useProxy || proxies.length === 0) return null; // Menggunakan proxyConfig dari config.js
  const proxy = proxies[proxyIndex];
  proxyIndex = (proxyIndex + 1) % proxies.length; // Cycle through proxies
  return proxy;
}

// 🔹 Configure Axios with or without proxy
function createAxiosInstance(proxyUrl) {
  if (proxyUrl) {
    let agent;

    // Deteksi jenis proxy secara otomatis berdasarkan URL
    if (proxyUrl.startsWith("socks")) {
      agent = new SocksProxyAgent(proxyUrl);
    } else {
      agent = new HttpsProxyAgent(proxyUrl);
    }

    return axios.create({
      baseURL: "https://api-kiteai.bonusblock.io/api/auth",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      httpsAgent: agent,
    });
  } else {
    // Jika tidak menggunakan proxy
    return axios.create({
      baseURL: "https://api-kiteai.bonusblock.io/api/auth",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
    });
  }
}

// 🔥 Sleep function to prevent rate limits
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 🔹 Fetch nonce from API
async function getNonce(nonce, axiosInstance) {
  await sleep(rateLimitConfig.baseDelay); // Menggunakan rateLimitConfig dari config.js
  try {
    const payload = { nonce };
    const response = await axiosInstance.post("/get-auth-ticket", payload);
    return response.data?.payload?.trim() || null;
  } catch (error) {
    console.error("❌ Error fetching nonce:", error.response?.data || error.message);
    return null;
  }
}

// 🔹 Sign nonce with private key
async function signMessage(privateKey, message, web3Instance) {
  try {
    const { signature } = web3Instance.eth.accounts.sign(message, privateKey);
    return signature;
  } catch (error) {
    console.error("❌ Error signing message:", error.message);
    return null;
  }
}

// 🔹 Send signed message to API
async function authenticate(walletAddress, signature, nonce, axiosInstance) {
  try {
    const payload = {
      blockchainName: "ethereum",
      nonce: nonce,
      referralId: Code.code, // Menggunakan Code dari config.js
      signedMessage: signature,
    };

    const response = await axiosInstance.post("/eth", payload);
    return response.data || null;
  } catch (error) {
    console.error("❌ Authentication error:", error.response?.data || error.message);
    return null;
  }
}

// 🔹 Get the current proxy IP
async function getCurrentIP(axiosInstance) {
  try {
    const response = await axiosInstance.get("https://api64.ipify.org?format=json");
    return response.data.ip;
  } catch (error) {
    console.error("❌ Error fetching proxy IP:", error.response?.data || error.message);
    return "Unknown";
  }
}

// 🔹 Register a wallet using rotating proxies (jika diaktifkan)
async function registerWallet(wallet) {
  let retryCount = 0;
  const maxRetries = rateLimitConfig.walletVerificationRetries; // Menggunakan rateLimitConfig dari config.js

  while (retryCount < maxRetries) {
    const proxyUrl = getNextProxy();
    const axiosInstance = createAxiosInstance(proxyUrl);
    const web3Instance = new Web3(new Web3.providers.HttpProvider("https://rpc-sepolia.rockx.com/", {
      agent: proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined,
    }));

    // 🔥 Get proxy IP before registering (jika menggunakan proxy)
    if (proxyUrl) {
      const currentIP = await getCurrentIP(axiosInstance);
      console.log(`🌍 Current Proxy IP: ${currentIP}`);
    } else {
      console.log("🌍 No proxy used (direct connection)");
    }

    console.log(`📝 Registering wallet: ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`);

    const nonce = `timestamp_${Date.now()}`;
    const authTicket = await getNonce(nonce, axiosInstance);

    if (!authTicket) {
      console.error("❌ Failed to fetch auth ticket. Retrying with next proxy...");
      retryCount++;
      continue; // Coba lagi dengan proxy berikutnya
    }

    const signature = await signMessage(wallet.privateKey, authTicket, web3Instance);
    if (!signature) {
      console.error("❌ Failed to sign message.");
      retryCount++;
      continue; // Coba lagi dengan proxy berikutnya
    }

    const authData = await authenticate(wallet.address, signature, nonce, axiosInstance);
    if (!authData || !authData.success) {
      console.error("❌ Authentication failed.");
      retryCount++;
      continue; // Coba lagi dengan proxy berikutnya
    }

    console.log("✅ Wallet registration successful!");
    console.log("=".repeat(50));
    return; // Berhasil, keluar dari loop
  }

  // Jika semua proxy gagal, coba tanpa proxy
  if (retryCount >= maxRetries) {
    console.log("⚠️ All proxies failed. Trying without proxy...");
    const axiosInstance = createAxiosInstance(null); // Tanpa proxy
    const web3Instance = new Web3(new Web3.providers.HttpProvider("https://rpc-sepolia.rockx.com/"));

    console.log(`📝 Registering wallet: ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`);

    const nonce = `timestamp_${Date.now()}`;
    const authTicket = await getNonce(nonce, axiosInstance);

    if (!authTicket) {
      console.error("❌ Failed to fetch auth ticket without proxy.");
      return;
    }

    const signature = await signMessage(wallet.privateKey, authTicket, web3Instance);
    if (!signature) {
      console.error("❌ Failed to sign message without proxy.");
      return;
    }

    const authData = await authenticate(wallet.address, signature, nonce, axiosInstance);
    if (!authData || !authData.success) {
      console.error("❌ Authentication failed without proxy.");
      return;
    }

    console.log("✅ Wallet registration successful without proxy!");
    console.log("=".repeat(50));
  }
}

// 🔥 Start wallet registration process
async function startRegistration() {
  const wallets = loadWallets();
  console.log(`🔹 Starting registration for ${wallets.length} wallets...`);

  for (const wallet of wallets) {
    await registerWallet(wallet);
  }
}

displayBanner();
startRegistration();
