## Cross-Browser Testing and Web Scraping with Selenium and BrowserStack

This project demonstrates the use of **Selenium WebDriver** in conjunction with **BrowserStack** for **cross-browser testing** and **web scraping**. The script scrapes article titles, content and images from the **El País** website, translates the article titles to English using the **DeepL API** and then analyzes repeated words from the translated headers.

## Features

- **Cross-browser testing**: The solution is configured to run tests on both **desktop** and **mobile** 
                             browsers using BrowserStack.
- **Parallel execution**: Tests are run across **5 different browser configurations** (both desktop and mobile) 
                          in parallel.
- **Web scraping**: The script extracts article titles, content, and images from the **El País** website.
- **Translation**: Article titles are translated using the **DeepL API**.
- **Data saving**: The scraped data is saved in a `scraped_data.json` file.
- **Repeated word analysis**: Analyzes repeated words in the translated article titles.

## Prerequisites

- **Node.js** installed on your local machine.
- **BrowserStack account**: You will need a BrowserStack username and access key to run the tests on their 
                            platform.
- **DeepL API key**: You will need a DeepL API key for translation

-**NOTE**: All required keys like DeepL API key , BrowserStack username and access key are inside .env file 
