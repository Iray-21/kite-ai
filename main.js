import axios from 'axios';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { groqConfig, agents } from './config.js';
import groqService from './groq.service.js';
import displayBanner from './banner.js';

const apiName = 'Testnet.GoKite.AI';

let payloads = JSON.parse(fs.readFileSync('questions.json', 'utf-8'));
let walletResponses = {};
let walletProxies = {};
let proxyIndex = 0;

const ttftApiUrl = 'https://quests-usage-dev.prod.zettablock.com/api/ttft';

const getProxies = () => {
  if (fs.existsSync('proxy.txt')) {
    const proxies = fs.readFileSync('proxy.txt', 'utf-8').split('\n');
    return proxies
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(proxy => {
        if (proxy.includes('://')) {
          const url = new URL(proxy);
          const protocol = url.protocol.replace(':', '');
          const auth = url.username ? `${url.username}:${url.password}` : '';
          const host = url.hostname;
          const port = url.port;
          return { protocol, host, port, auth };
        } else {
          const parts = proxy.split(':');
          let [protocol, host, port, user, pass] = parts;
          protocol = protocol.replace('//', '');
          const auth = user && pass ? `${user}:${pass}` : '';
          return { protocol, host, port, auth };
        }
      });
  } else {
    return [];
  }
};

const createAgent = (proxy) => {
  if (!proxy) return null;

  const { protocol, host, port, auth } = proxy;
  const authString = auth ? `${auth}@` : '';
  const proxyUrl = `${protocol}://${authString}${host}:${port}`;

  return protocol.startsWith('socks')
    ? new SocksProxyAgent(proxyUrl)
    : new HttpsProxyAgent(proxyUrl);
};

const removeUnknownQuestionsFromPayloads = () => {
  const unknownQuestionsFile = '.questions_fails.json';
  const payloadsFile = 'questions.json';

  if (fs.existsSync(unknownQuestionsFile)) {
    const unknownQuestions = JSON.parse(fs.readFileSync(unknownQuestionsFile, 'utf-8'));
    payloads = JSON.parse(fs.readFileSync(payloadsFile, 'utf-8'));

    payloads = payloads.filter(question => !unknownQuestions.includes(question));

    fs.writeFileSync(payloadsFile, JSON.stringify(payloads, null, 2));
    console.log(chalk.blueBright('\n📋 Preparing Questions ...\n'));
  } else {
    console.log(chalk.yellow('⚠️ .questions_fails.json does not exist. No action taken.'));
  }
};

const calculateTimeDifference = (startTime, endTime) => {
  return endTime - startTime;
};

const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const containsUnwantedKeywords = (response) => {
  const unwantedKeywords = [
    'maaf', 'Maaf', 'sorry', 'Sorry', 'I do not know', 'i do not know', 'Saya tidak tahu', 'saya tidak tahu',
    'i do not have', 'saya tidak memiliki', 'Saya tidak mengetahui', 'I do not have', 'Saya tidak memiliki',
    'saya tidak mempunyai', 'saya tidak mengetahui', 'Saya tidak mempunyai'
  ];
  return unwantedKeywords.some(keyword => response.includes(keyword));
};

const showBanner = () => {
  displayBanner();
};

const sendGroqApiRequest = async (message) => {
  const startTime = Date.now();
  const maxRetries = 3;
  const retryDelay = 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const completion = await groqService.client.chat.completions.create({
        messages: [{ role: 'user', content: message }],
        model: groqConfig.model,
        temperature: groqConfig.temperature,
      });

      const endTime = Date.now();
      const timeToFirstToken = calculateTimeDifference(startTime, endTime);
      return { responseData: completion.choices[0].message.content, timeToFirstToken };
    } catch (error) {
      if (error.code === 'ECONNABORTED' && attempt < maxRetries) {
        console.log(chalk.red(`Connection lost. Retrying in ${retryDelay}ms... (${attempt}/${maxRetries})`));
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        console.error(chalk.red(`❌ : ${error.message}`));
        throw error;
      }
    }
  }
};

const getWallets = () => {
  if (fs.existsSync('wallets.txt')) {
    const wallets = fs.readFileSync('wallets.txt', 'utf-8').split('\n');
    return wallets.filter(wallet => wallet.trim() !== '');
  } else {
    return [];
  }
};

const sendReportUsageApiRequest = async (walletAddress, requestText, responseText, deploymentId, proxy = null) => {
  const maxRetries = 3;
  const retryDelay = 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const reportUsagePayload = {
        wallet_address: walletAddress,
        agent_id: deploymentId,
        request_text: requestText,
        response_text: responseText,
        request_metadata: {}
      };

      const agent = createAgent(proxy);
      const response = await axios.post(
        'https://quests-usage-dev.prod.zettablock.com/api/report_usage',
        reportUsagePayload,
        {
          httpsAgent: agent,
          proxy: false,
          timeout: 10000
        }
      );

      return response.data.message;
    } catch (error) {
      if (error.code === 'ECONNABORTED' && attempt < maxRetries) {
        console.log(chalk.red(`Connection lost. Retrying in ${retryDelay}ms... (${attempt}/${maxRetries})`));
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        const errorCode = error.response?.status;
        const detailedError = error.response?.data?.error || error.response?.data?.message || error.message;
        console.error(chalk.red(`☣️ Error ${errorCode}: ${detailedError}`));
        return `Error ${errorCode}: ${detailedError}`;
      }
    }
  }
};

const sendTtftApiRequest = async (timeToFirstToken, deploymentId, proxy = null) => {
  const maxRetries = 3;
  const retryDelay = 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const ttftPayload = {
        deployment_id: deploymentId,
        time_to_first_token: timeToFirstToken
      };

      const agent = createAgent(proxy);
      const response = await axios.post(ttftApiUrl, ttftPayload, {
        httpsAgent: agent,
        proxy: false,
        timeout: 10000
      });
      return response.data.message;
    } catch (error) {
      if (error.code === 'ECONNABORTED' && attempt < maxRetries) {
        console.log(chalk.red(`Connection lost. Retrying in ${retryDelay}ms... (${attempt}/${maxRetries})`));
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        console.error(chalk.red(`⛔ : ${error.message}`));
        throw error;
      }
    }
  }
};

const runScriptForQuestionAndWallets = async (question, selectedWallets, proxies, useProxy) => {
  try {
    console.log(chalk.whiteBright(`🧠 Question : ${question}`));
    console.log(chalk.magentaBright(`🤖 AI Agent : Kite AI Assistant`));
    console.log(chalk.greenBright(`📋 Response :`));

    const { responseData, timeToFirstToken } = await sendGroqApiRequest(question);

    if (containsUnwantedKeywords(responseData)) {
      console.log(chalk.blue(`📢 : Question not answered successfully. \n🔄 : Try another question...`));
    } else {
      console.log(chalk.whiteBright(`${responseData} \n`));

      for (const wallet of selectedWallets) {
        console.log(chalk.yellow(`🔑 : ${wallet}`));

        let proxy = walletProxies[wallet];
        if (useProxy && proxies.length > 0 && !proxy) {
          proxy = proxies[proxyIndex % proxies.length];
          walletProxies[wallet] = proxy;
          proxyIndex++;
        }

        if (proxy) {
          console.log(chalk.cyan(`🌏 : ${proxy.host}:${proxy.port}`));
        }

        try {
          const ttftResponse = await sendTtftApiRequest(timeToFirstToken, Object.keys(agents)[0], proxy);
          console.log(chalk.blue('📝 :'), ttftResponse);

          const reportUsageResponse = await sendReportUsageApiRequest(
            wallet,
            question,
            responseData,
            Object.keys(agents)[0],
            proxy
          );
          console.log(chalk.green('✅ :'), reportUsageResponse);

          if (!walletResponses[wallet]) {
            walletResponses[wallet] = 0;
          }
          walletResponses[wallet] += 10;
          console.log(chalk.yellow(`💰 : ${walletResponses[wallet]}/200\n`));

          const allWalletsCompleted = selectedWallets.every(w => walletResponses[w] >= 200);
          if (allWalletsCompleted) {
            console.log(chalk.yellow('🎉 All wallets have reached 200 points. Stopping the script...'));
            process.exit(0);
          }
        } catch (error) {
          console.error(chalk.red(`📛 Error reporting usage for ${wallet}: ${error.message}`));
          if (useProxy) {
            console.log(chalk.yellow('🔄 Trying without proxy...'));
            try {
              const ttftResponse = await sendTtftApiRequest(timeToFirstToken, Object.keys(agents)[0], null);
              console.log(chalk.blue('📝 :'), ttftResponse);

              const reportUsageResponse = await sendReportUsageApiRequest(
                wallet,
                question,
                responseData,
                Object.keys(agents)[0],
                null
              );
              console.log(chalk.green('✅ :'), reportUsageResponse);

              if (!walletResponses[wallet]) {
                walletResponses[wallet] = 0;
              }
              walletResponses[wallet] += 10;
              console.log(chalk.yellow(`💰 : ${walletResponses[wallet]}/200\n`));
            } catch (error) {
              console.error(chalk.red(`📛 Error reporting usage for ${wallet} without proxy: ${error.message}`));
            }
          }
        }

        if (selectedWallets.indexOf(wallet) < selectedWallets.length - 1) {
          console.log(chalk.white('⏳ : Wait 5 seconds for next response... \n'));
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }
  } catch (error) {
    console.error(chalk.red(`🚨 Error processing question: ${question}`));
    console.error(chalk.red(`Error: ${error.message}`));
  }
};

const runScriptForWallets = async (selectedWallets, proxies, useProxy) => {
  console.log(chalk.yellowBright(`\n🔔 STARTING the BOT....`));

  walletResponses = {};
  walletProxies = {};
  proxyIndex = 0;
  selectedWallets.forEach(wallet => {
    walletResponses[wallet] = 0;
  });

  const shuffledPayloads = shuffleArray(payloads);

  for (const question of shuffledPayloads) {
    console.log(chalk.whiteBright(`\n📩 Uploading Questions.....`));
    await runScriptForQuestionAndWallets(question, selectedWallets, proxies, useProxy);
  }
};

const mainMenu = async () => {
  const { menuOption } = await inquirer.prompt([
    {
      type: 'list',
      name: 'menuOption',
      message: 'Select Option:',
      choices: ['Running a BOT', 'Exit']
    }
  ]);

  if (menuOption === 'Running a BOT') {
    const wallets = getWallets();
    if (wallets.length === 0) {
      console.log(chalk.redBright('⚠️ There are no wallets available. Please add wallets to wallets.txt first.'));
      process.exit(0);
    }

    const { useProxy } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useProxy',
        message: 'Do you want to use a proxy?',
        default: false,
      },
    ]);

    const proxies = useProxy ? getProxies() : [];
    if (useProxy && proxies.length === 0) {
      console.log(chalk.yellow('⚠️ No proxies found. Try running bot without proxy.'));
    }

    const { selectedWallets } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedWallets',
        message: 'Select a wallet to use :',
        choices: wallets
      }
    ]);

    if (selectedWallets.length === 0) {
      console.log(chalk.yellow('⚠️ No wallet selected. Back to main menu...'));
      await mainMenu();
      return;
    }

    await runScriptForWallets(selectedWallets, proxies, useProxy);
    await mainMenu();
  } else {
    console.log(chalk.red('🔴 Operation canceled.'));
    process.exit(0);
  }
};

const main = async () => {
  showBanner();
  removeUnknownQuestionsFromPayloads();
  await mainMenu();
};

main();
