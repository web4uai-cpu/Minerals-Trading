import { Injectable, OnModuleInit, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MINERAL_SEEDS } from './seed/minerals.seed';

@Injectable()
export class CatalogService implements OnModuleInit {
  private readonly logger = new Logger(CatalogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.seedMinerals();
  }

  /** Seed minerals if the table is empty. Idempotent. */
  private async seedMinerals(): Promise<void> {
    const count = await this.prisma.mineral.count();
    if (count > 0) {
      this.logger.log(`Minerals table has ${count} entries — skipping seed`);
      return;
    }

    for (const seed of MINERAL_SEEDS) {
      await this.prisma.mineral.create({
        data: {
          name: seed.name,
          category: seed.category,
          hsnCode: seed.hsnCode,
          defaultUnit: seed.defaultUnit,
          gradeParams: seed.gradeParams as object,
        },
      });
    }

    this.logger.log(`Seeded ${MINERAL_SEEDS.length} minerals`);
  }

  /** List all minerals. */
  async findAll() {
    return this.prisma.mineral.findMany({
      orderBy: { name: 'asc' },
    });
  }

  /** Get a single mineral by ID. */
  async findOne(id: string) {
    const mineral = await this.prisma.mineral.findUnique({ where: { id } });
    if (!mineral) {
      throw new NotFoundException({ code: 'MINERAL_NOT_FOUND', message: 'Mineral not found' });
    }
    return mineral;
  }

  /** Find mineral by name (case-insensitive). Used by AI search to resolve mineral names. */
  async findByName(name: string) {
    return this.prisma.mineral.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
  }
}
