import axios from 'axios';
import dotenv from 'dotenv';
import inquirer from 'inquirer';
import chalk from 'chalk';
import figlet from 'figlet';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Load payloads from JSON file
let payloads = JSON.parse(fs.readFileSync('payloads.json', 'utf-8'));

// Mapping between MAIN API URLs and Deployment IDs with their names
const mainApiToDeploymentId = {
  'https://deployment-r89ftdnxa7jwwhyr97wq9lkg.stag-vxzy.zettablock.com/main': {
    id: 'deployment_R89FtdnXa7jWWHyr97WQ9LKG',
    name: 'Professor'
  },
  'https://deployment-fsegykivcls3m9nrpe9zguy9.stag-vxzy.zettablock.com/main': {
    id: 'deployment_fseGykIvCLs3m9Nrpe9Zguy9',
    name: 'Sherlock'
  },
  'https://deployment-xkerjnnbdtazr9e15x3y7fi8.stag-vxzy.zettablock.com/main': {
    id: 'deployment_xkerJnNBdTaZr9E15X3Y7FI8',
    name: 'Crypto Buddy'
  }
};

// MAIN API URLs
const mainApiUrls = Object.keys(mainApiToDeploymentId);

// Nama untuk semua API
const apiName = 'Testnet.GoKite.AI';

// TTFT API
const ttftApiUrl = 'https://quests-usage-dev.prod.zettablock.com/api/ttft';

// REPORT USAGE API
const reportUsageApiUrl = 'https://quests-usage-dev.prod.zettablock.com/api/report_usage';

// Objek untuk melacak jumlah respons yang berhasil untuk setiap wallet
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

// Function to remove unknown questions from payloads
const removeUnknownQuestionsFromPayloads = () => {
  const unknownQuestionsFile = 'Tidak_Diketahui_Jawabannya.json';
  const payloadsFile = 'payloads.json';

  if (fs.existsSync(unknownQuestionsFile)) {
    const unknownQuestions = JSON.parse(fs.readFileSync(unknownQuestionsFile, 'utf-8'));
    payloads = JSON.parse(fs.readFileSync(payloadsFile, 'utf-8'));

    // Filter out the unknown questions from payloads
    payloads = payloads.filter(question => !unknownQuestions.includes(question));

    // Write the updated payloads back to the file
    fs.writeFileSync(payloadsFile, JSON.stringify(payloads, null, 2));
    console.log(chalk.green('🟢 Menyiapkan Pertanyaan'));
  } else {
    console.log(chalk.yellow(' ⚠️ Tidak_Diketahui_Jawabannya.json does not exist. No action taken.'));
  }
};

// Function to send request to MAIN API with retry logic
const sendMainApiRequest = async (message, mainApiUrl) => {
  const startTime = Date.now();
  const maxRetries = 3; // Jumlah maksimum percobaan ulang
  const retryDelay = 1000; // Jeda 1 detik antara percobaan ulang

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(mainApiUrl, { message, stream: true }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        responseType: 'stream',
        timeout: 10000 // Timeout 10 detik
      });

      let responseData = '';
      response.data.on('data', (chunk) => {
        const chunkStr = chunk.toString();
        const lines = chunkStr.split('\n');
        for (const line of lines) {
          if (line.trim() === '' || line.trim() === 'data: [DONE]') continue;
          try {
            const jsonStr = line.replace('data: ', '').trim();
            if (jsonStr) {
              const jsonData = JSON.parse(jsonStr);
              if (jsonData.choices[0].delta.content) {
                responseData += jsonData.choices[0].delta.content;
              }
            }
          } catch (error) {
            console.error('Error parsing chunk:', error);
            console.error('Chunk content:', line);
          }
        }
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
        console.log(chalk.redBright(`Koneksi terputus. Mencoba ulang dalam ${retryDelay}ms... (Percobaan ${attempt}/${maxRetries})`));
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        console.error(chalk.red(` ❌ Error: ${error.message}`));
        throw error; // Jika percobaan ulang habis, lempar error
      }
    }
  }
};

// Function to send request to TTFT API with retry logic
const sendTtftApiRequest = async (timeToFirstToken, deploymentId) => {
  const maxRetries = 3; // Jumlah maksimum percobaan ulang
  const retryDelay = 1000; // Jeda 1 detik antara percobaan ulang

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
        console.log(chalk.redBright(`Koneksi terputus. Mencoba ulang dalam ${retryDelay}ms... (Percobaan ${attempt}/${maxRetries})`));
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        console.error(chalk.red(` ❌ Error: ${error.message}`));
        throw error; // Jika percobaan ulang habis, lempar error
      }
    }
  }
};

// Function to send request to REPORT USAGE API with retry logic
const sendReportUsageApiRequest = async (walletAddress, requestText, responseText, deploymentId) => {
  const maxRetries = 3; // Jumlah maksimum percobaan ulang
  const retryDelay = 1000; // Jeda 1 detik antara percobaan ulang

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
        console.log(chalk.redBright(`Koneksi terputus. Mencoba ulang dalam ${retryDelay}ms... (Percobaan ${attempt}/${maxRetries})`));
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        const errorCode = error.response?.status;
        const detailedError = error.response?.data?.error || error.response?.data?.message || error.message;
        console.error(chalk.red(` ❌ Error ${errorCode}: ${detailedError}`));
        return `Error ${errorCode}: ${detailedError}`;
      }
    }
  }
};

// Function to display welcome message
const displayWelcomeMessage = () => {
  console.log(chalk.redBright(figlet.textSync('KiteAI', { horizontalLayout: 'full', font: 'Small' })));
  console.log(chalk.cyan(`Welcome to ${apiName}`));
};

// Function to get wallets from .env
const getWallets = () => {
  dotenv.config({ path: '.env' });
  return Object.keys(process.env)
    .filter((key) => key.startsWith('WALLET_ADDRESS_'))
    .map((key) => process.env[key]);
};

// Function to add a new wallet
const addWalletMenu = async () => {
  while (true) {
    const { walletAddress } = await inquirer.prompt([
      {
        type: 'input',
        name: 'walletAddress',
        message: 'Masukkan alamat wallet baru (kosong untuk kembali):',
      }
    ]);

    if (!walletAddress.trim()) {
      console.log(chalk.yellow(' ⚠️ Kembali ke menu utama...'));
      return;
    }

    const newKey = `WALLET_ADDRESS_${getWallets().length + 1}`;
    fs.appendFileSync('.env', `\n${newKey}=${walletAddress}`);
    dotenv.config({ path: '.env' });
    console.log(chalk.green(' ✅ Wallet berhasil ditambahkan!'));
  }
};

// Function to run the script for a single question and multiple wallets
const runScriptForQuestionAndWallets = async (question, selectedWallets) => {
  console.log(chalk.yellowBright(` 🧠 : ${question} \n`));

  for (const wallet of selectedWallets) {
    let allResponsesContainUnwantedKeywords = true;
    const triedApiUrls = new Set(); // Untuk melacak API yang sudah dicoba

    while (triedApiUrls.size < mainApiUrls.length) {
      // Pilih URL Main API yang belum dicoba
      const availableApiUrls = mainApiUrls.filter(url => !triedApiUrls.has(url));
      const mainApiUrl = availableApiUrls[Math.floor(Math.random() * availableApiUrls.length)];
      triedApiUrls.add(mainApiUrl);

      const deploymentInfo = mainApiToDeploymentId[mainApiUrl]; // Get the corresponding Deployment ID and name
      console.log(chalk.greenBright(` 🤖 : Testnet.GoKite.AI - ${deploymentInfo.name}`));
      console.log(chalk.magentaBright(` 🔑 : ${wallet}`)); // Menampilkan wallet address, bukan deployment ID

      // Send MAIN API request for each wallet using the selected URL
      try {
        const { responseData, timeToFirstToken } = await sendMainApiRequest(question, mainApiUrl);

        // Check if the response contains unwanted keywords
        if (containsUnwantedKeywords(responseData)) {
          console.log(chalk.yellow(` 📢 : Tidak berhasil dijawab. Mencoba AI lainnya... 🔄`));
        } else {
          allResponsesContainUnwantedKeywords = false;

          // Display FULL Response Content for each wallet
          console.log(chalk.whiteBright(` 💡 : ${responseData}`)); // Hanya menampilkan respons, tanpa wallet atau deployment name

          // Display TTFT and REPORT USAGE responses for each wallet
          const ttftResponse = await sendTtftApiRequest(timeToFirstToken, deploymentInfo.id);
          console.log(chalk.greenBright(' 📝 :'), ttftResponse);

          const reportUsageResponse = await sendReportUsageApiRequest(wallet, question, responseData, deploymentInfo.id);
          console.log(chalk.blueBright(' ✅ :'), reportUsageResponse);

          // Update the response count for the wallet
          if (!walletResponses[wallet]) {
            walletResponses[wallet] = 0;
          }
          walletResponses[wallet] += 10; // Tambahkan 10 poin untuk setiap respons yang berhasil
          console.log(chalk.cyanBright(` 🎯 : ${walletResponses[wallet]}/200`));

          // Break the loop if a valid response is found
          break;
        }
      } catch (error) {
        console.error(chalk.red(` ❌ Error saat mengirim permintaan: ${error.message}`));
      }

      // Add delay to avoid rate limit
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
    }

    // Jika semua API memberikan respons dengan kata-kata yang tidak diinginkan
    if (allResponsesContainUnwantedKeywords) {
      console.log(chalk.red(` 🚨 All API responses contain unwanted keywords for question: ${question}`));

      // Salin pertanyaan ke file Tidak_Diketahui_Jawabannya.json
      const unknownQuestionsFile = 'Tidak_Diketahui_Jawabannya.json';
      let unknownQuestions = [];

      if (fs.existsSync(unknownQuestionsFile)) {
        unknownQuestions = JSON.parse(fs.readFileSync(unknownQuestionsFile, 'utf-8'));
      }

      if (!unknownQuestions.includes(question)) {
        unknownQuestions.push(question);
        fs.writeFileSync(unknownQuestionsFile, JSON.stringify(unknownQuestions, null, 2));
        console.log(chalk.blackBright(` 🚮 Pertanyaan dibuang ke ${unknownQuestionsFile}`));
      }
    }

    // Tambahkan jarak 1 enter setelah setiap wallet selesai diproses
    console.log();
  }

  // Cek apakah semua wallet telah mencapai 200 poin
  const allWalletsCompleted = selectedWallets.every(wallet => walletResponses[wallet] >= 200);
  if (allWalletsCompleted) {
    console.log(chalk.greenBright(' 🎉 Semua wallet telah mencapai 200 poin. \n 🔴 Skrip dihentikan. \n  🕹️ Jalankan lagi besok'));
    process.exit(0);
  }
};

// Function to run the script for multiple wallets
const runScriptForWallets = async (selectedWallets) => {
  console.log(chalk.yellowBright(`\n 👾 BOT dijalankan ... \n`));

  // Inisialisasi walletResponses
  walletResponses = {};
  selectedWallets.forEach(wallet => {
    walletResponses[wallet] = 0;
  });

  // Shuffle the payloads array once for all wallets
  const shuffledPayloads = shuffleArray(payloads);

  // Process the same shuffled questions for all wallets
  for (const question of shuffledPayloads) {
    console.log(chalk.yellowBright(` 🚀 : Mengunggah Pertanyaan ...`));
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
      choices: ['Jalankan BOT', 'Tambah Wallet', 'Keluar']
    }
  ]);

  if (menuOption === 'Jalankan BOT') {
    const wallets = getWallets();
    if (wallets.length === 0) {
      console.log(chalk.red(' ⚠️ Tidak ada wallet yang tersedia. Silakan tambahkan wallet terlebih dahulu.'));
      await mainMenu();
      return;
    }

    const { selectedWallets } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedWallets',
        message: 'Pilih wallet untuk digunakan:',
        choices: wallets
      }
    ]);

    if (selectedWallets.length === 0) {
      console.log(chalk.yellow(' ⛔ Tidak ada wallet yang dipilih. Kembali ke menu utama...'));
      await mainMenu();
      return;
    }

    await runScriptForWallets(selectedWallets);
    await mainMenu();
  } else if (menuOption === 'Tambah Wallet') {
    await addWalletMenu();
    dotenv.config({ path: '.env' });
    await mainMenu();
  } else {
    console.log(chalk.red(' 🔴 Operasi dibatalkan.'));
    process.exit(0);
  }
};

// Main function to execute the flow
const main = async () => {
  displayWelcomeMessage();
  removeUnknownQuestionsFromPayloads(); // Panggil fungsi ini sebelum menjalankan menu utama
  await mainMenu();
};

// Run the main function
main();
