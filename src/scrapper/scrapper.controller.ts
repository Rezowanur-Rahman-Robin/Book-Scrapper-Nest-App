import { Controller, Post, Body } from '@nestjs/common';
import { ScrapperService } from './scrapper.service';

@Controller('scrape')
export class ScrapperController {
  constructor(private readonly scrapperService: ScrapperService) {}

  @Post('csv')
  async scrapeBooksFromCsv(
    @Body('batchSize') batchSize: number,
    @Body('startIndex') startIndex: number,
    @Body('endIndex') endIndex: number,
  ) {
    return this.scrapperService.scrapLinksFromCSV(
      batchSize,
      startIndex,
      endIndex,
    );
  }

  @Post('links')
  async scrapeBooks(@Body('links') links: string[]) {
    return this.scrapperService.scrapLinks(links);
  }
}
