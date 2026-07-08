import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * Valida a entrada contra um schema zod de `@meumercado/contracts`. Assim o
 * MESMO schema que o front usa valida o corpo/query no back — sem DTOs duplicados
 * que divergem. Entrada inválida vira 400 com os detalhes (sem vazar internals).
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Falha de validação',
        issues: result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    return result.data;
  }
}
