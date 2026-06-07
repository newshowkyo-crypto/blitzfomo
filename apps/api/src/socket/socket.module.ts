// apps/api/src/socket/socket.module.ts
import { Global, Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';

@Global()
@Module({
  providers: [GameGateway],
  exports: [GameGateway],
})
export class SocketModule {}