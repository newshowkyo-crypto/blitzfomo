// apps/api/src/locale/locale.controller.ts
import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { LocaleService } from './locale.service';

@Controller('api/locales')
export class LocaleController {
  constructor(private readonly localeService: LocaleService) {}

  @Get(':lang')
  async getLocale(@Param('lang') lang: string) {
    const locale = await this.localeService.getLocaleByLang(lang);
    if (!locale) {
      throw new NotFoundException(`Locale ${lang} not found`);
    }
    return locale.content;
  }
}
