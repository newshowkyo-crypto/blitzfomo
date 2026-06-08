// apps/api/src/socket/game.gateway.ts
// 实时推送核心（TDD 要求：game:state, game:purchase, round:settled）

import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
      : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:80'],
    credentials: true,
  },
  namespace: '/game',
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GameGateway.name);

  handleConnection(client: Socket) {
    const origin = client.handshake.headers.origin || '';
    const allowed = process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
      : ['https://blitzfomo.com', 'https://www.blitzfomo.com', 'http://localhost:5173', 'http://localhost:3000', 'http://localhost:80'];
    if (origin && !allowed.some(a => origin.startsWith(a))) {
      this.logger.warn(`Rejected connection from origin: ${origin}`);
      client.disconnect(true);
      return;
    }
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // 推送游戏状态更新
  broadcastGameState(state: any) {
    this.server.emit('game:state', state);
  }

  // 有人成功购买后推送
  broadcastPurchase(purchase: any) {
    this.server.emit('game:purchase', purchase);
  }

  // 结算完成后推送
  broadcastRoundSettled(data: { roundId: string; winner: any; newRound: any }) {
    this.server.emit('round:settled', data);
  }
}