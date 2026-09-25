import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module';
import { OutboxProcessor } from './outbox.processor';

@Module({
  imports: [AccountingModule],
  providers: [OutboxProcessor],
})
export class EventsModule {}
