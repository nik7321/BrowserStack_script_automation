const { Builder, By, until } = require("selenium-webdriver");
const fs = require("fs");
const axios = require("axios");
const dotenv = require("dotenv");
const deepl = require("deepl-node");

dotenv.config();

const username = process.env.BROWSERSTACK_USERNAME;
const accessKey = process.env.BROWSERSTACK_ACCESS_KEY; 
const authKey = process.env.DEEPL_AUTH_KEY; 
const translator = new deepl.Translator(authKey);

// Translation function
async function translateText(text, targetLang) {
  try {
    const result = await translator.translateText(text, null, targetLang);
    return result.text;
  } catch (error) {
    console.error("Translation Error:", error.message);
    return text;
  }
}

// Retry function for connection
async function retryConnection(fn, retries = 3, delay = 5000) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${attempt} failed: ${error.message}`);
      if (attempt < retries) {
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

// Cross-browser testing
const capabilities = [
  {
    browserName: "chrome",
    browser_version: "latest",
    os: "Windows",
    os_version: "10",
    name: "Chrome Test on Windows 10 (Desktop)",
    build: "Cross-Browser Testing",
    "browserstack.local": "false",
    "browserstack.debug": "true",
  },
  {
    browserName: "chrome",
    browser_version: "latest",
    os: "Android",
    os_version: "10",
    name: "Chrome Test on Android (Mobile)",
    build: "Cross-Browser Testing",
    "browserstack.local": "false",
    "browserstack.debug": "true",
  },
  {
    browserName: "microsoftedge",
    browser_version: "latest",
    os: "Windows",
    os_version: "10",
    name: "Edge Test on Windows 10 (Desktop)",
    build: "Cross-Browser Testing",
    "browserstack.local": "false",
    "browserstack.debug": "true",
  },
  {
    browserName: "firefox",
    browser_version: "latest",
    os: "OS X",
    os_version: "Monterey",
    name: "Firefox Test on MacOS Monterey (Desktop)",
    build: "Cross-Browser Testing",
    "browserstack.local": "false",
    "browserstack.debug": "true",
  },
  {
    browserName: "safari",
    browser_version: "latest",
    os: "iOS",
    os_version: "14",
    name: "Safari Test on iOS (Mobile)",
    build: "Cross-Browser Testing",
    "browserstack.local": "false",
    "browserstack.debug": "true",
  },
];

// Function to run tests parallely on different browsers
async function runTest(capability) {
  let driver;
  const data = [];
  const visitedTitles = new Set();
  const wordCount = {};

  try {
    driver = await retryConnection(() => {
      return new Builder()
        .usingServer(`https://${username}:${accessKey}@hub-cloud.browserstack.com/wd/hub`)
        .withCapabilities(capability)
        .build();
    });

    console.log(`Running test on ${capability.browserName}...`);
    await driver.get("https://elpais.com");

    // Handle cookie dialog (if any)
    try {
      const acceptButton = await driver.wait(
        until.elementLocated(By.css(".didomi-dismiss-button")),
        5000
      );
      await acceptButton.click();
    } catch {
      console.log("No cookies dialog detected.");
    }

    // Navigate to the Opinion section
    let opinionLink;
    try {
      opinionLink = await driver.wait(
        until.elementLocated(By.partialLinkText("Opinión")),
        20000
      );

      // Scroll the element into view to ensure it's clickable
      await driver.executeScript("arguments[0].scrollIntoView(true);", opinionLink);
      await driver.sleep(1000); // Give time for animations or transitions

      // Click the element using JavaScript to bypass obstruction
      await driver.executeScript("arguments[0].click();", opinionLink);
      console.log("Navigated to Opinion section.");
    } catch (error) {
      console.error("Error navigating to Opinion section:", error.message);
    }

    await driver.sleep(3000);

    // Fetch article links
    const articles = await driver.findElements(
      By.css(".b-d_a a, .b-d_b.b_op._g._g-md.b_op-1-2 a, .b-d_d.b_col-h.b_st.b_st-r-lg a")
    );
    const articleLinks = [];
    for (const article of articles) {
      const link = await article.getAttribute("href");
      if (link && link.endsWith(".html") && !articleLinks.includes(link)) {
        articleLinks.push(link);
      }
      if (articleLinks.length === 5) break;
    }

    console.log(`Filtered article links: ${articleLinks}`);

    // Process articles
    for (let i = 0; i < articleLinks.length; i++) {
      const link = articleLinks[i];
      await driver.get(link);
      await driver.sleep(5000);

      // Fetch title
      let title = "";
      try {
        title = await driver.findElement(By.css("header h1")).getText();
        if (visitedTitles.has(title)) continue;
        visitedTitles.add(title);
        console.log(`Original Title: ${title}`);
      } catch {
        console.log(`Error fetching title for Article ${i + 1}`);
        continue;
      }

      // Translate title
      const translatedTitle = await translateText(title, "en-US");
      console.log(`Translated Title: ${translatedTitle}`);

      // Fetch content
      let content = "";
      try {
        const paragraphs = await driver.findElements(By.css("div.a_c.clearfix p"));
        for (const paragraph of paragraphs) {
          const paragraphText = await paragraph.getText();
          content += paragraphText + "\n";
        }
      } catch {
        console.log(`Error fetching content for Article ${i + 1}`);
      }

      // Fetch and download cover image
      let coverImage = null;
      try {
        const imageElement = await driver.findElement(By.css("span.a_m_w img"));
        await driver.executeScript("arguments[0].scrollIntoView(true);", imageElement);
        await driver.sleep(2000);
        coverImage = await imageElement.getAttribute("src");
        if (coverImage && coverImage.startsWith("http")) {
          const imagePath = `article_image_${i + 1}.jpg`;
          const response = await axios.get(coverImage, { responseType: "stream" });
          response.data.pipe(fs.createWriteStream(imagePath));
        }
      } catch {
        console.log("No cover image found.");
      }

      data.push({ originalTitle: title, translatedTitle, content, coverImage });
    }

    // Analyze repeated words
    data.forEach((article) => {
      const words = article.translatedTitle.toLowerCase().split(/\s+/);
      words.forEach((word) => {
        const cleanedWord = word.replace(/[^\w\s]/gi, "");
        if (cleanedWord) wordCount[cleanedWord] = (wordCount[cleanedWord] || 0) + 1;
      });
    });

    const repeatedWords = {};
    for (const [word, count] of Object.entries(wordCount)) {
      if (count > 2) repeatedWords[word] = count;
    }

    console.log("Repeated words in translated headers:", repeatedWords);

    // Save scraped data to JSON file
    const finalData = {
      articles: data,
      repeatedWords: repeatedWords,
    };

    fs.writeFileSync("scraped_data.json", JSON.stringify(finalData, null, 2));
    console.log("Scraped data saved to scraped_data.json");

  } catch (error) {
    console.error(`Error on ${capability.browserName}:`, error.message);
  } finally {
    if (driver) await driver.quit();
  }
}

//call to run the tests parallely
(async function runParallelTests() {
  const promises = capabilities.map((capability) => runTest(capability));
  await Promise.all(promises);
  console.log("All tests completed.");
})();
