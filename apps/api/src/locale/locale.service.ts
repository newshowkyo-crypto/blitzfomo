// apps/api/src/locale/locale.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LocaleService {
  constructor(private readonly prisma: PrismaService) {}

  async getLocaleByLang(lang: string) {
    return this.prisma.locale.findUnique({ where: { lang } });
  }

  async getAllLocales() {
    return this.prisma.locale.findMany();
  }
}
