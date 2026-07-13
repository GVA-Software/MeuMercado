import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { NfceImportRepository } from '../../../modules/nfce/nfce-import.repository.js';
import { NfceImportEntity } from '../entities/nfce-import.entity.js';

@Injectable()
export class TypeOrmNfceImportRepository implements NfceImportRepository {
  constructor(
    @InjectRepository(NfceImportEntity)
    private readonly repo: Repository<NfceImportEntity>,
  ) {}

  async jaImportada(chave: string): Promise<boolean> {
    return (await this.repo.countBy({ chave })) > 0;
  }

  async registrar(chave: string, reporterId: string): Promise<boolean> {
    // Trava atômica: `INSERT ... ON CONFLICT DO NOTHING RETURNING chave`. Se duas
    // importações concorrerem, só uma insere (raw com 1 linha); a outra recebe raw
    // vazio → retorna false e o serviço aborta sem duplicar preços.
    const result = await this.repo
      .createQueryBuilder()
      .insert()
      .values({ chave, reporterId })
      .orIgnore()
      .returning('chave')
      .execute();
    return (result.raw as unknown[]).length > 0;
  }

  async remover(chave: string): Promise<void> {
    await this.repo.delete({ chave });
  }
}
