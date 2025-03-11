import axios from 'axios';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs';

// Load payloads from JSON file
let payloads = JSON.parse(fs.readFileSync('questions.json', 'utf-8'));

// Mapping between MAIN API URLs and Deployment IDs with their names
const mainApiToDeploymentId = {
  'https://deployment-r89ftdnxa7jwwhyr97wq9lkg.stag-vxzy.zettablock.com/main': {
    id: 'deployment_R89FtdnXa7jWWHyr97WQ9LKG',
    name: 'Professor'
  },
  'https://deployment-fsegykivcls3m9nrpe9zguy9.stag-vxzy.zettablock.com/main': {
    id: 'deployment_fseGykIvCLs3m9Nrpe9Zguy9',
    name: 'Crypto Buddy'
  },
  'https://deployment-zs6oe0edbuquit8kk0v10djt.stag-vxzy.zettablock.com/main': {
    id: 'deployment_zs6OE0EdBuQuit8KK0V10dJT',
    name: 'Sherlock'
  }
};

const mainApiUrls = Object.keys(mainApiToDeploymentId);

const apiName = 'Testnet.GoKite.AI';

const ttftApiUrl = 'https://quests-usage-dev.prod.zettablock.com/api/ttft';

// REPORT USAGE API
const reportUsageApiUrl = 'https://quests-usage-dev.prod.zettablock.com/api/report_usage';

let walletResponses = {};

// Function to calculate time difference in milliseconds
const calculateTimeDifference = (startTime, endTime) => {
  return endTime - startTime;
};

// Function to shuffle an array
const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

// Function to get a random MAIN API URL
const getRandomMainApiUrl = () => {
  const randomIndex = Math.floor(Math.random() * mainApiUrls.length);
  return mainApiUrls[randomIndex];
};

// Function to check if the response contains certain keywords
const containsUnwantedKeywords = (response) => {
  const unwantedKeywords = [
    'maaf', 'Maaf', 'sorry', 'Sorry', 'I do not know', 'i do not know', 'Saya tidak tahu', 'saya tidak tahu', 
    'i do not have', 'saya tidak memiliki', 'Saya tidak mengetahui', 'I do not have', 'Saya tidak memiliki', 
    'saya tidak mempunyai', 'saya tidak mengetahui', 'Saya tidak mempunyai'
  ];
  return unwantedKeywords.some(keyword => response.includes(keyword));
};

const removeUnknownQuestionsFromPayloads = () => {
  const unknownQuestionsFile = '.questions_fails.json';
  const payloadsFile = 'questions.json';

  if (fs.existsSync(unknownQuestionsFile)) {
    const unknownQuestions = JSON.parse(fs.readFileSync(unknownQuestionsFile, 'utf-8'));
    payloads = JSON.parse(fs.readFileSync(payloadsFile, 'utf-8'));

    // Filter out the unknown questions from payloads
    payloads = payloads.filter(question => !unknownQuestions.includes(question));

    // Write the updated payloads back to the file
    fs.writeFileSync(payloadsFile, JSON.stringify(payloads, null, 2));
    console.log(chalk.blueBright('\n📋 Preparing Questions ...\n'));
  } else {
    console.log(chalk.yellow(' ⚠️ .questions_fails.json does not exist. No action taken.'));
  }
};

const sendMainApiRequest = async (message, mainApiUrl) => {
  const startTime = Date.now();
  const maxRetries = 3;
  const retryDelay = 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(mainApiUrl, { message, stream: true }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        responseType: 'stream',
        timeout: 10000
      });

      let responseData = '';
      let buffer = '';

      response.data.on('data', (chunk) => {
        buffer += chunk.toString();

        const lines = buffer.split('\n');
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (line === '' || line === 'data: [DONE]') continue;

          try {
            if (line.startsWith('data: ')) {
              const jsonStr = line.replace('data: ', '').trim();
              if (jsonStr) {
                const jsonData = JSON.parse(jsonStr);
                if (jsonData.choices[0].delta.content) {
                  responseData += jsonData.choices[0].delta.content;
                }
              }
            }
          } catch (error) {
            console.error('Error parsing chunk:', error);
            console.error('Chunk content:', line);
          }
        }

        buffer = lines[lines.length - 1];
      });

      return new Promise((resolve) => {
        response.data.on('end', () => {
          const endTime = Date.now();
          const timeToFirstToken = calculateTimeDifference(startTime, endTime);
          resolve({ responseData, timeToFirstToken });
        });
      });
    } catch (error) {
      if (error.code === 'ECONNABORTED' && attempt < maxRetries) {
        console.log(chalk.red(`Connection lost. Retrying in ${retryDelay}ms... (${attempt}/${maxRetries})`));
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        console.error(chalk.red(` ❌ Error: ${error.message}`));
        throw error;
      }
    }
  }
};

// Function to send request to TTFT API with retry logic
const sendTtftApiRequest = async (timeToFirstToken, deploymentId) => {
  const maxRetries = 3;
  const retryDelay = 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const ttftPayload = {
        deployment_id: deploymentId,
        time_to_first_token: timeToFirstToken
      };

      const response = await axios.post(ttftApiUrl, ttftPayload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // Timeout 10 detik
      });
      return response.data.message;
    } catch (error) {
      if (error.code === 'ECONNABORTED' && attempt < maxRetries) {
        console.log(chalk.red(`Connection lost. Retrying in ${retryDelay}ms... ( ${attempt}/${maxRetries})`));
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        console.error(chalk.red(` ⛔ Error: ${error.message}`));
        throw error;
      }
    }
  }
};

// Function to send request to REPORT USAGE API with retry logic
const sendReportUsageApiRequest = async (walletAddress, requestText, responseText, deploymentId) => {
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

      const response = await axios.post(reportUsageApiUrl, reportUsagePayload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // Timeout 10 detik
      });
      return response.data.message;
    } catch (error) {
      if (error.code === 'ECONNABORTED' && attempt < maxRetries) {
        console.log(chalk.red(`Connection lost. Retrying in ${retryDelay}ms... ( ${attempt}/${maxRetries})`));
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        const errorCode = error.response?.status;
        const detailedError = error.response?.data?.error || error.response?.data?.message || error.message;
        console.error(chalk.red(` ☣️ Error ${errorCode}: ${detailedError}`));
        return `Error ${errorCode}: ${detailedError}`;
      }
    }
  }
};

// Function to display welcome message
const displayWelcomeMessage = () => {
  console.log("");
  console.log(chalk.white('        ██╗██████╗  █████╗██╗   ██╗  █████╗███╗'));
  console.log(chalk.white('        ██║██╔══██╗██╔══██╗██╗ ██╔╝     ██╝ ██║'));
  console.log(chalk.white('        ██║██████╔╝███████║  ██╔╝     ██║   ██║'));
  console.log(chalk.white('        ██║██║  ██╗██╔══██║  ██║     █████║ ██║'));
  console.log(chalk.white('        ██║██║  ██║██║  ██║  ██║     ╚════╝ ╚═╝'));
  console.log(chalk.white('        ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝  ╚═╝  El-Psy-Kongroo'));
  console.log(chalk.greenBright('       < <  エ ル ・ プ サ イ ・ コングルゥ  > >'));
  console.log("");
  console.log(chalk.cyan(`                   ${apiName}`));
  console.log(chalk.yellowBright.bold('                •• github.com/Iray-21 ••'));
  console.log("");
};

// Function to get wallets from wallets.txt
const getWallets = () => {
  if (fs.existsSync('wallets.txt')) {
    const wallets = fs.readFileSync('wallets.txt', 'utf-8').split('\n');
    return wallets.filter(wallet => wallet.trim() !== ''); // Hapus baris kosong
  } else {
    return []; // Jika file tidak ada, kembalikan array kosong
  }
};

// Function to add a new wallet
const addWalletMenu = async () => {
  while (true) {
    const { walletAddress } = await inquirer.prompt([
      {
        type: 'input',
        name: 'walletAddress',
        message: 'Enter new wallet address (blank to return):',
      }
    ]);

    if (!walletAddress.trim()) {
      console.log(chalk.yellow(' ⚠️ Back to Main Menu'));
      return;
    }

    // Tambahkan wallet ke file wallets.txt
    fs.appendFileSync('wallets.txt', `${walletAddress}\n`);
    console.log(chalk.green(' ✅ Wallet Added Successfully!'));
  }
};

// Function to run the script for a single question and multiple wallets
const runScriptForQuestionAndWallets = async (question, selectedWallets) => {
  let successfulDeployment = null;
  const triedApiUrls = new Set();

  while (triedApiUrls.size < mainApiUrls.length && !successfulDeployment) {
    const availableApiUrls = mainApiUrls.filter(url => !triedApiUrls.has(url));
    const mainApiUrl = availableApiUrls[Math.floor(Math.random() * availableApiUrls.length)];
    triedApiUrls.add(mainApiUrl);

    const deploymentInfo = mainApiToDeploymentId[mainApiUrl];
    console.log(chalk.whiteBright(`🧠 Question : ${question}`));
    console.log(chalk.magentaBright(`🤖 AI Agent : ${deploymentInfo.name} \n`));

    try {
      const { responseData, timeToFirstToken } = await sendMainApiRequest(question, mainApiUrl);

      if (containsUnwantedKeywords(responseData)) {
        console.log(chalk.blueBright(`📢 : Question not answered successfully by ${deploymentInfo.name}. \n🔄 : Try another AI...`));
      } else {
        successfulDeployment = { mainApiUrl, deploymentInfo, responseData, timeToFirstToken };
        console.log(chalk.whiteBright(`${responseData} \n`));
      }
    } catch (error) {
      console.error(chalk.yellow(` ☣️ Error sending request to ${deploymentInfo.name}: ${error.message}`));
    }
  }

  if (successfulDeployment) {
    const { deploymentInfo, responseData, timeToFirstToken } = successfulDeployment;

    for (const wallet of selectedWallets) {
      console.log(chalk.yellow(` 🔑 : ${wallet}`));

      try {
        const ttftResponse = await sendTtftApiRequest(timeToFirstToken, deploymentInfo.id);
        console.log(chalk.blue(' 📝 :'), ttftResponse);

        const reportUsageResponse = await sendReportUsageApiRequest(wallet, question, responseData, deploymentInfo.id);
        console.log(chalk.green(' ✅ :'), reportUsageResponse);

        // Update the response count for the wallets
        if (!walletResponses[wallet]) {
          walletResponses[wallet] = 0;
        }
        walletResponses[wallet] += 10;
        console.log(chalk.yellowBright(` 💰 : ${walletResponses[wallet]}/200\n`));
      } catch (error) {
        console.error(chalk.red(` 📛 Error reporting usage for ${wallet}: ${error.message}`));
      }

      if (selectedWallets.indexOf(wallet) < selectedWallets.length - 1) {
        console.log(chalk.white(' ⏳ : Wait 10 seconds for next response... \n'));
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
  } else {
    console.log(chalk.redBright(` 🚨 All AI fails to answer the question: ${question}`));

    const unknownQuestionsFile = '.questions_fails.json';
    let unknownQuestions = [];

    if (fs.existsSync(unknownQuestionsFile)) {
      unknownQuestions = JSON.parse(fs.readFileSync(unknownQuestionsFile, 'utf-8'));
    }

    if (!unknownQuestions.includes(question)) {
      unknownQuestions.push(question);
      fs.writeFileSync(unknownQuestionsFile, JSON.stringify(unknownQuestions, null, 2));
      console.log(chalk.blueBright(` 🚮 Question will be deleted`));
    }
  }

  const allWalletsCompleted = selectedWallets.every(wallet => walletResponses[wallet] >= 200);
  if (allWalletsCompleted) {
    console.log(chalk.whiteBright(' 🎉 All wallets have reached 200 points.. \n   🔴 Script has been automatically turned off. \n     👋 See you tomorrow...'));
    process.exit(0);
  }
};

// Function to run the script for multiple wallets
const runScriptForWallets = async (selectedWallets) => {
  console.log(chalk.yellowBright(`\n🔔 STARTING the BOT....`));

  // Inisialisasi walletResponses
  walletResponses = {};
  selectedWallets.forEach(wallet => {
    walletResponses[wallet] = 0;
  });

  // Shuffle the payloads array once for all wallets
  const shuffledPayloads = shuffleArray(payloads);

  // Process the same shuffled questions for all wallets
  for (const question of shuffledPayloads) {
    console.log(chalk.whiteBright(`\n📩 Uploading Questions.....`));
    await runScriptForQuestionAndWallets(question, selectedWallets);
  }
};

// Main menu function
const mainMenu = async () => {
  const { menuOption } = await inquirer.prompt([
    {
      type: 'list',
      name: 'menuOption',
      message: 'Pilih opsi:',
      choices: ['Running a BOT', 'Add wallet', 'Exit']
    }
  ]);

  if (menuOption === 'Running a BOT') {
    const wallets = getWallets();
    if (wallets.length === 0) {
      console.log(chalk.redBright(' ⚠️ Tidak ada wallet yang tersedia. Silakan tambahkan wallet terlebih dahulu.'));
      await mainMenu();
      return;
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
      console.log(chalk.yellow(' ⚠️ No wallet selected. Back to main menu...'));
      await mainMenu();
      return;
    }

    await runScriptForWallets(selectedWallets);
    await mainMenu();
  } else if (menuOption === 'Add wallet') {
    await addWalletMenu();
    await mainMenu();
  } else {
    console.log(chalk.red(' 🔴 Operataion canceled.'));
    process.exit(0);
  }
};

// Main function to execute the flow
const main = async () => {
  displayWelcomeMessage();
  removeUnknownQuestionsFromPayloads();
  await mainMenu();
};

// Run the main function
main();
