import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('minerals')
@UseGuards(JwtAuthGuard)
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  /** GET /minerals — list all minerals (cached in the future). */
  @Get()
  async findAll() {
    return this.catalogService.findAll();
  }

  /** GET /minerals/:id — single mineral detail. */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.catalogService.findOne(id);
  }
}
