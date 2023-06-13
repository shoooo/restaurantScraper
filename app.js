// 1. Import all dependencies
const puppeteer = require("puppeteer");
const express = require('express');
const app = express();
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { searchKeywords } = require("./api/gpt");

// The credentials are for OAuth2 from Google
const credentials = require('./credentials.json');
require('dotenv').config();

const scrapeEmail = async () => {
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

    const browser = await puppeteer.launch(chromeOptions);
    const page = await browser.newPage()

    const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID);
    await doc.useServiceAccountAuth(credentials);
    await doc.loadInfo();
    const emailSheet = await doc.sheetsById[process.env.LIST_ID];
    const rows = await emailSheet.getRows();

    // Set a limit for the number of attempts
    const maxAttempts = 5;
    let attempt = 0;

    for (const row of rows) {
        // if (attempt >= maxAttempts) {
        //     console.log('Maximum attempts reached. Exiting the loop.');
        //     break;
        // }

        try {
            const brandname = row['brandname'];

            await page.goto(`https://www.google.com/search?q=${encodeURIComponent(brandname)}`);
            await page.waitForSelector('#search');
            const websiteURL = await page.$eval('#search a', (element) => element.href);

            const navigationPromise = page.waitForNavigation(); // Add this line
            await Promise.all([
                page.click('#search a'), // Click on the link
                navigationPromise, // Wait for navigation to complete
            ]);

            await page.waitForTimeout(3500); // Adjust the delay as needed

            const keywords = ['特定商取引', 'プライバシーポリシー', 'お問い合わせ'];

            let matchingLink = null;
            for (const keyword of keywords) {
                try {
                    matchingLink = await page.evaluate((keyword) => {
                        const links = Array.from(document.querySelectorAll('a'));
                        const foundLink = links.find((link) => link.innerText.toLowerCase().includes(keyword));
                        return foundLink ? foundLink.href : null;
                    }, keyword.toLowerCase());

                    if (matchingLink) {
                        await page.goto(`${matchingLink}`)
                        const email = await page.evaluate(() => (document.querySelector('body')?.innerText.match(/(.+)@(.+){2,}\.(.+){2,}/) ?? null));
                        console.log(matchingLink)
                        row['checked page'] = matchingLink;
                        if (email != null) row['email'] = email[0];
                        break;
                    }
                } catch (error) {
                    console.log('An error occurred while evaluating the page:', error);
                }
            }

            row['website'] = websiteURL;

        } catch (e) { console.log(e) }

        // const fbURL = await page.evaluate(() => (document.querySelector('.rstinfo-sns-facebook') ?? {}).href) ?? null;
        // if (fbURL) {
        //     await page.goto(`${fbURL}`);

        //     const email = await page.evaluate(() => (document.querySelector('body')?.innerText.match(/(.+)@(.+){2,}\.(.+){2,}/) ?? null));
        //     restaurant.email = email != null ? email[0] : null;
        // }

        // Update the spreadsheet with the website URL and additional info

        await row.save(); // Save the updated row
        attempt++;
    }
    await browser.close()

    // await emailSheet.addRows(list, (err, row) => {
    //     console.log(err || row)
    // });

}

scrapeEmail()

const PORT = process.env.PORT || 1000;

app.listen(PORT, () => {
    console.log(`Server has started on ${PORT}`);
})
