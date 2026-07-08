import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { GeocodeService } from './geocode.service.js';

const ReverseSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

@Controller('geocode')
export class GeocodeController {
  constructor(private readonly service: GeocodeService) {}

  @Get('reverse')
  async reverse(
    @Query(new ZodValidationPipe(ReverseSchema)) q: z.infer<typeof ReverseSchema>,
  ): Promise<{ endereco: string | null }> {
    return { endereco: await this.service.reverse(q.lat, q.lng) };
  }
}
