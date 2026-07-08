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

  async registrar(chave: string, reporterId: string): Promise<void> {
    // `orIgnore`: se duas importações concorrerem, a segunda não quebra.
    await this.repo
      .createQueryBuilder()
      .insert()
      .values({ chave, reporterId })
      .orIgnore()
      .execute();
  }
}
