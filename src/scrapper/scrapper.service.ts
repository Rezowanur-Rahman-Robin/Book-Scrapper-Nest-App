import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parser';
import * as fastcsv from 'fast-csv';
@Injectable()
export class ScrapperService {
  private readonly filePath: string;

  constructor() {
    this.filePath = path.join(__dirname, '../../src/files/allBooks.csv'); // Adjust path if needed
  }
  async scrapLinks(links) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    const results = [];

    for (const link of links) {
      try {
        await page.goto(link, { waitUntil: 'domcontentloaded' });

        // Scraping Description
        const description = await page.$eval(
          '#js--summary-description',
          (element) => element.innerHTML,
        );

        // Scraping Rating, RatingsNum, and Reviews
        const rating = await page.$eval(
          '.review-wrapper__rating-summary .summary-title',
          (element) => element.textContent.trim(),
        );
        const ratingsNum = await page.$eval(
          '#js--rating-review-count-summary',
          (element) => {
            const match = element.textContent.match(/(\d+)\sRatings/);
            return match ? match[1] : 'No';
          },
        );
        const reviews = await page.$eval(
          '#js--rating-review-count-summary',
          (element) => {
            const match = element.textContent.match(/and\s(\d+)\sReviews/);
            return match ? match[1] : 'No';
          },
        );

        // Store the result
        results.push({
          link,
          description,
          rating,
          ratingsNum,
          reviews,
        });
      } catch (error) {
        console.log({ error });
        results.push({
          link,
          error: 'Failed to scrape description, rating, or reviews',
        });
      }
    }

    await browser.close();
    return results;
  }

  async scrapLinksFromCSV(batchSize, last, lengthLimit) {
    let lastProcessedIndex = last;
    const books = await this.readCSV();

    while (lastProcessedIndex < lengthLimit) {
      const batch = books.slice(
        lastProcessedIndex,
        lastProcessedIndex + batchSize,
      );
      if (batch.length === 0) break;

      console.log(`Processing batch from index ${lastProcessedIndex}`);

      await this.scrapBatch(batch);
      lastProcessedIndex += batchSize;
      await this.writeCSV(books); // Save progress after each batch
    }

    console.log('Scraping complete');
    return {
      message: 'Scraping complete',
      lastProcessedIndex: lastProcessedIndex,
    };
  }

  private async scrapBatch(batch: any[]) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    for (const book of batch) {
      if (
        (!book.Summary || !book.Rating || !book.RatingsNum || !book.Reviews) &&
        book.urlID
      ) {
        const link = `https://www.rokomari.com/book/${book.urlID}`;
        try {
          await page.goto(link, { waitUntil: 'domcontentloaded' });
          const description = await page.$eval(
            '#js--summary-description',
            (el) => el.innerHTML,
          );

          // Scraping Rating, RatingsNum, and Reviews
          const rating = await page.$eval(
            '.review-wrapper__rating-summary .summary-title',
            (element) => element.textContent.trim(),
          );
          const ratingsNum = await page.$eval(
            '#js--rating-review-count-summary',
            (element) => {
              const match = element.textContent.match(/(\d+)\sRatings/);
              return match ? match[1] : '';
            },
          );
          const reviews = await page.$eval(
            '#js--rating-review-count-summary',
            (element) => {
              const match = element.textContent.match(/and\s(\d+)\sReviews/);
              return match ? match[1] : '';
            },
          );
          if (description) {
            book.Summary = description;
          }
          if (rating) {
            book.Rating = rating;
          }
          if (ratingsNum) {
            book.RatingsNum = ratingsNum;
          }
          if (reviews) {
            book.Reviews = reviews;
          }
          console.log(
            `${link}  Rating: ${rating}  RatingsNum: ${ratingsNum}  Reviews: ${reviews}   Summary: ${description.slice(0, 10)}  `,
          );
        } catch (error) {
          console.log(`Failed to scrape ${link}:`, error.message);
        }
      }
    }

    await browser.close();
  }

  private readCSV(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const books = [];
      fs.createReadStream(this.filePath)
        .pipe(csv())
        .on('data', (row) => {
          if (!row.Summary) row.Summary = ''; // Ensure Summary column exists
          books.push(row);
        })
        .on('end', () => resolve(books))
        .on('error', (error) => reject(error));
    });
  }

  private writeCSV(data: any[]) {
    return new Promise<void>((resolve, reject) => {
      const ws = fs.createWriteStream(this.filePath);
      fastcsv
        .write(data, { headers: true })
        .pipe(ws)
        .on('finish', resolve)
        .on('error', reject);
    });
  }
}
