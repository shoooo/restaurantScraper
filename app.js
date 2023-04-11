// 1. Import all dependencies
const puppeteer = require("puppeteer");
const express = require('express');
const app = express();
const { GoogleSpreadsheet } = require('google-spreadsheet');
const fs = require('fs');
// The credentials are for OAuth2 from Google
const credentials = require('./credentials.json');
require('dotenv').config();

// 2. Defining a scraping function. I put all functions in here because they are not so long.
const scrape = async () => {

    // 3. Configuring Chrome options:
    // If you want to see code excuted on browser, set headless false
    const chromeOptions = {
        headless: true,
        defaultViewport: null,
        args: [
            "--incognito",
            "--no-sandbox",
            "--single-process",
            "--no-zygote"
        ],
    };

    // 4. Launching Puppeteer:
    // Launches a new instance of Chrome using Puppeteer and creates a new page. 
    // `fs` module reads the content of the `count.txt` file which contains an ID number of a page to scrape.
    const browser = await puppeteer.launch(chromeOptions);
    const page = await browser.newPage()
    const file = fs.readFileSync("count.txt").toString();

    // 5. Authenticating Google Sheets API:
    const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID);
    await doc.useServiceAccountAuth(credentials);
    await doc.loadInfo();
    const emailSheet = await doc.sheetsById[process.env.LIST_ID];

    await page.goto(`https://tabelog.com/rstLst/${file}/?LstCos=5`)

    // 6. Extracting data from the website:
    const list = await page.evaluate(() => {
        let results = [];
        let items = document.querySelectorAll('.list-rst__rst-name-target')

        items.forEach(async (item) => {
            results.push({
                name: item.innerHTML,
                url: item.href,
            })
        })

        return results
    })

    const restaurants = [];

    for (let i = 0; i < list.length; i++) {
        try {
            await page.goto(`${list[i].url}`);

            const restaurant = {};
            const name = await page.$eval('.rstdtl-crumb', name => name.innerHTML)
            const webURL = await page.evaluate(() => (document.querySelector('.homepage > a') ?? {}).href) ?? null;
            const instaURL = await page.evaluate(() => (document.querySelector('.rstinfo-sns-instagram') ?? {}).href) ?? null;
            const fbURL = await page.evaluate(() => (document.querySelector('.rstinfo-sns-facebook') ?? {}).href) ?? null;

            Object.assign(restaurant, { name, webURL, instaURL, fbURL });

            if (fbURL) {
                await page.goto(`${fbURL}`);

                const email = await page.evaluate(() => (document.querySelector('body')?.innerText.match(/(.+)@(.+){2,}\.(.+){2,}/) ?? null));
                restaurant.email = email != null ? email[0] : null;
            }

            console.log(restaurant)
            restaurants.push(restaurant);
        } catch { }
    }

    // Im having issues add rows to the spreadsheet. Probably because of permissions? Or wrong indexes?
    await emailSheet.addRows(restaurants, (err, row) => {
        console.log(err || row)
    });

    const count = parseInt(file)
    const inc = count + 1
    fs.writeFileSync('./count.txt', inc.toString());

    await browser.close()

    if (file < 30) {
        scrape()
    }
}

scrape()

// for (let i = 0; i < 2; i++) {
//     setTimeout(()=>{
//         scrape();
//      }, 10000); // multiple i by 1000
//   }


const PORT = process.env.PORT || 1000;

app.listen(PORT, () => {
    console.log(`Server has started on ${PORT}`);
})
