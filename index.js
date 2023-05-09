const puppeteer = require("puppeteer-extra");
// Add stealth plugin and use defaults (all tricks to hide puppeteer usage)
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

// Add adblocker plugin to block all ads and trackers (saves bandwidth)
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker')
puppeteer.use(AdblockerPlugin({ blockTrackers: true }))

const xlsx = require("xlsx");

//Pupeeteer options
async function startBrowser() {
    let browser;
    try {
        console.log("Opening the browser......");
        browser = await puppeteer.launch({
            headless: false, //change this to true to make browser invisible
            args: ["--disable-setuid-sandbox"],
            ignoreHTTPSErrors: true,
        });
    } catch (err) {
        console.log("Could not create a browser instance => : ", err);
    }
    return browser;
}

async function scrapeAll(browserInstance) {
    let browser;
    try {
        browser = await browserInstance;
        await scraperObject.scraper(browser);
    } catch (err) {
        console.log("Could not resolve the browser instance => ", err);
    }
}

// insert query keywords here to scrape
const scraperObject = {
    //specify what do you want to search in the searchbox
    categoryURL: [
        "clinic",
        "doctor",
        "hospital",
    ].map(
        (p) => `https://www.yellowpages.my/services/l?what=${p}`
    ),
    async scraper(browser) {
        //initializing empty arrays to push into
        let totalData = [];

        //Loop thru every links in categoryURL
        let page = await browser.newPage();
        await page.setViewport({
            width: 1366,
            height: 768
        }); //setting wider viewport to load all products
        await page.setDefaultNavigationTimeout(1000000);

        await page.goto(this.categoryURL[0]);
        // console.log(`Navigating to ` + this.categoryURL[0]);

        //Loop thru every links in categoryURL
        for (let link of this.categoryURL) {
            console.log(
                "Going to Yellow Pages service page to search for " + link
            );

            //go to one category
            await page.goto(
                link,
            );

            //get the number of pages of the query
            await page.waitForSelector('.pages')
            scrapPage = await page.evaluate(() => {
                return Array.from(document.querySelectorAll("body > app-root > div > app-root > app-search > div > div > div > div > div > span:nth-child(2)")).map(x => x.textContent);
            })

            //divide total results by result per page, you get the page count
            const resultPerPage = 12
            let pagesCount = Math.floor(parseInt(scrapPage[0]) / resultPerPage) + 1;
            console.log('total pages: ', pagesCount)

            let currentPage = 1;    //set page counter
            //do loop while (currentPage <= pagesCount)
            do {
                const pageWithQuery = `${link}?page=${currentPage}`
                console.log(`It is page: ${currentPage}, url:${pageWithQuery}`)
                await page.goto(pageWithQuery, { waituntil: 'DOMContentLoaded' });
                await page.waitForSelector('app-expended-normal-listing > div > div > a')

                //get the array of link of all service in a page
                let servicesLinks = await page.evaluate(() => {
                    return Array.from(document.querySelectorAll("app-expended-normal-listing > div > div > a")).map(x => x.href)
                });
                
                let resultServicesLinks = servicesLinks.filter(el => {
                    if (el.split('/').length < 5) {
                        return el
                    }
                })

                let linkQueue = [...resultServicesLinks]  //deep copy

                while(linkQueue.length) {
                    let indivService = linkQueue.shift()
                    try{
                        await page.goto(indivService, { waituntil: 'DOMContentLoaded' });
                        console.log('Scraping: ', indivService)
                        await page.waitForSelector('body > app-root > div > app-root > app-profile > div > div > div> div > div > div > div > div.title')
    
                        //get the title of the service
                        titleName = await page.evaluate(() => {
                            str = Array.from(document.querySelectorAll("body > app-root > div > app-root > app-profile > div > div > div> div > div > div > div > div.title")).map(x => x.textContent)[0]
                            return {
                                titleName: str.trim()
                            }
                        });
                        //get the address of the service
                        address = await page.evaluate(() => {
    
                            str = Array.from(document.querySelectorAll("body > app-root > div > app-root > app-profile > div > div > div > div > div > div > div > div > div > div > a > div")).map(x => x.textContent)[1]
                            return {
                                address: str.trim()
                            }
                        });
    
                        //get the info of the service
                        otherInfo = await page.evaluate(() => {
                            const infos = Array.from(document.querySelectorAll("body > app-root > div > app-root > app-profile > div > div > div > div > div > div > div > div > div > div > div > a")).map(x => x.textContent)
                            temp = {
                                tel: '',
                                fax: '',
                                email: ''
                            }
    
                            infos.forEach(e => {
                                if (e.includes('Tel: ')) {
                                    temp.tel = e.split('Tel: ')[1].trim()
                                } else if (e.includes('Fax: ')) {
                                    temp.fax = e.split('Fax: ')[1].trim()
                                } else if (e.includes('Email: ')) {
                                    temp.email = e.split('Email: ')[1].trim()
                                }
                            })
                            return temp
                        });
                        // console.log(otherInfo)
    
                        serviceData = {
                            ...titleName,
                            ...address,
                            ...otherInfo
                        }
                        console.log(serviceData)
    
                        //push the data into totalData
                        totalData.push(serviceData);


                    }catch{
                        await new Promise(r => setTimeout(r, 3000));
                        linkQueue.unshift(indivService)
                    }
                }

                //update the current page
                currentPage++;
            } while (currentPage <= pagesCount)
            console.log(totalData,' length of: ', totalData.length)
        }


        // Get the current date
        var today = new Date();
        var dd = String(today.getDate()).padStart(2, '0');
        var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
        var yyyy = today.getFullYear();

        today = dd + '-' + mm + '-' + yyyy;


        const workbookname = 'data.xlsx';
        // Saving to an excel file
        try {
            const wb = xlsx.readFile(workbookname);
            const ws = xlsx.utils.json_to_sheet(totalData);
            xlsx.utils.book_append_sheet(wb, ws, today, true);
            xlsx.writeFile(wb, workbookname);
        } catch (error) {
            const wb = xlsx.utils.book_new();
            const ws = xlsx.utils.json_to_sheet(totalData);
            xlsx.utils.book_append_sheet(wb, ws, today, true);
            xlsx.writeFile(wb, workbookname);
        }
        console.log("Done!");
        // browser.close();
    }
}


scrapeAll(startBrowser());
