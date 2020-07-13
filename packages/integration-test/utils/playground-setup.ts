import puppeteer from 'puppeteer'

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH,
    args: ['--no-sandbos', '--disable-gpu'],
  })
  const coordinator = await browser.newPage()
  const wallet = await browser.newPage()
  coordinator.setDefaultTimeout(0)
  wallet.setDefaultTimeout(0)
  await coordinator.goto('http://localhost:1234')
  await wallet.goto('http://localhost:4321')
  // Coordinator wait loading
  await coordinator.waitForSelector('.xterm')
  const waitPrompt =
    'document.querySelector(".xterm").innerText.includes("Prompt")'
  await coordinator.waitForFunction(waitPrompt)
  // Coordinator: Register as a coordinator
  await coordinator.keyboard.type('jjjjj', { delay: 200 })
  await coordinator.keyboard.press('Enter', { delay: 200 })
  await coordinator.keyboard.type('j', { delay: 200 })
  await coordinator.keyboard.press('Enter', { delay: 200 })
  await coordinator.keyboard.press('Enter', { delay: 200 })
  // Coordinator: Run auto coordination
  await coordinator.keyboard.type('jjj', { delay: 200 })
  await coordinator.keyboard.press('Enter', { delay: 200 })
  // Wallet: Type password
  const waitPassword =
    'document.querySelector(".xterm").innerText.includes("password")'
  await wallet.waitForFunction(waitPassword)
  await wallet.keyboard.type('helloworld')
  await wallet.keyboard.press('Enter', { delay: 200 })
  // Wallet: Select account
  await wallet.waitForFunction(waitPrompt)
  await wallet.keyboard.press('Enter', { delay: 200 })
  // Wallet: Select deposit menu
  await wallet.keyboard.type('j', { delay: 200 })
  await wallet.keyboard.press('Enter', { delay: 200 })
  // Wallet: Select Ether menu
  await wallet.keyboard.type('j', { delay: 200 })
  await wallet.keyboard.press('Enter', { delay: 200 })
  // Wallet: Type amount of ETH to send
  await wallet.keyboard.type('1 ETH', { delay: 200 })
  await wallet.keyboard.press('Enter', { delay: 200 })
  // Wallet: Type amount of Fee to send
  await wallet.keyboard.type('1 ETH', { delay: 200 })
  await wallet.keyboard.press('Enter', { delay: 200 })
  // Wallet: Select yes
  await wallet.keyboard.type('Y', { delay: 200 })
  await wallet.keyboard.press('Enter', { delay: 200 })
  // Coordinator: go to setup menu
  await coordinator.keyboard.type('jjjjj', { delay: 200 })
  await coordinator.keyboard.press('Enter', { delay: 200 })
  // Coordinator: select commit deposit: manually commit the genesis mass deposit
  await coordinator.keyboard.type('jj', { delay: 200 })
  await coordinator.keyboard.press('Enter', { delay: 200 })
  await browser.close()
}

;(async () => {
  await main()
  process.exit()
})().catch(_ => {
  process.exit()
})
