# 🚀KiteAI Bot Chat🚀
Register to tesnet gokite ai, if you don't have you can register [https://testnet.gokite.ai/](https://testnet.gokite.ai?r=rgwSKk46).


# Prerequisites
- [Node.js](https://nodejs.org/)
- Groq API key
  [Register & Get Groq API Key](https://console.groq.com/docs/quickstart)


# ⚙️ Feature
- **Easy to register multiple accounts directly**
- **Multiple Wallet**
- **Support Proxy**
- **Auto Disconnect** when all wallets have reached 200 points**


# 🔧 Installation
**1. Clone the repository to your local machine :**
   ```bash
   git clone https://github.com/Iray-21/kite-ai
   ```
**2. Navigate to the project directory:**
	```bash
	cd kite-ai
	```
**3. Install the necessary dependencies:**
	```bash
	npm install
	```

# 📝 Create required configuration files:
**1️⃣ Wallets addresses file:**
	```bash
	nano wallets.txt
	```
**2️⃣ Private keys file:**
	```bash
	nano priv.txt
	```
**3️⃣ Proxy file:**
	```bash
	nano proxy.txt
	```
Format: http://user:pass@host:port
**4️⃣ Insert your Groq API key :**
	```bash
	nano config.js
	```

# ⚙️ Usage Guide 🚀
**✏️ To Register (First-time Users Only) 📜**
🔹 Ensure that priv.txt contains your private key before running register.js.
	```bash
	node register.js
	```

🚀 To Start the Bot 🤖
🔹 Ensure wallets.txt is set up correctly.
🔹 Wallets must be registered and signed before use.
	```bash
	node main.js
	```


