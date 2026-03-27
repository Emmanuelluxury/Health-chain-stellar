import { Logger, UseGuards, Inject } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

interface LocationUpdatePayload {
  riderId: string;
  deliveryId: string;
  latitude: number;
  longitude: number;
  timestamp?: string;
  speed?: number;
  heading?: number;
}

interface DeliveryStatusPayload {
  deliveryId: string;
  status: string;
  riderId?: string;
  timestamp?: string;
}

interface ETAPayload {
  deliveryId: string;
  estimatedMinutes: number;
  distanceKm?: number;
  timestamp?: string;
}

@WebSocketGateway({
  namespace: '/tracking',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class TrackingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TrackingGateway.name);
  private readonly heartbeatInterval = 30_000; // 30 seconds
  private connectedClients = new Map<string, { userId?: string; rooms: Set<string> }>();

  constructor(private readonly jwtService: JwtService) {}

  afterInit(_server: Server): void {
    this.logger.log('TrackingGateway WebSocket server initialised');
  }

  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.token ?? client.handshake.query?.token;

    if (!token) {
      this.logger.warn(`Tracking WS connection rejected: no token (socket=${client.id})`);
      client.disconnect(true);
      return;
    }

    try {
      // Verify JWT token
      const payload = await this.jwtService.verifyAsync(token as string);
      const userId = payload.sub || payload.userId;

      // Store client info
      this.connectedClients.set(client.id, {
        userId,
        rooms: new Set(),
      });

      this.logger.log(`Tracking WS client connected: ${client.id} (user: ${userId})`);

      // Start heartbeat
      const interval = setInterval(() => {
        if (client.connected) {
          client.emit('heartbeat', { timestamp: new Date().toISOString() });
        }
      }, this.heartbeatInterval);

      client.on('disconnect', () => {
        clearInterval(interval);
        this.connectedClients.delete(client.id);
      });

      // Send welcome message
      client.emit('connected', {
        message: 'Successfully connected to tracking service',
        userId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Tracking WS connection rejected: invalid token (socket=${client.id})`, error);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Tracking WS client disconnected: ${client.id}`);
  }

  @SubscribeMessage('delivery.subscribe')
  handleDeliverySubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { deliveryId: string },
  ) {
    if (!data?.deliveryId) {
      client.emit('error', { message: 'Missing deliveryId' });
      return;
    }

    const clientInfo = this.connectedClients.get(client.id);
    if (!clientInfo) {
      client.emit('error', { message: 'Client not authenticated' });
      return;
    }

    const room = `delivery:${data.deliveryId}`;
    client.join(room);
    clientInfo.rooms.add(room);

    this.logger.debug(`Client ${client.id} (user: ${clientInfo.userId}) joined room ${room}`);

    client.emit('delivery.subscribed', {
      deliveryId: data.deliveryId,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('delivery.unsubscribe')
  handleDeliveryUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { deliveryId: string },
  ) {
    if (!data?.deliveryId) {
      client.emit('error', { message: 'Missing deliveryId' });
      return;
    }

    const clientInfo = this.connectedClients.get(client.id);
    if (!clientInfo) {
      client.emit('error', { message: 'Client not authenticated' });
      return;
    }

    const room = `delivery:${data.deliveryId}`;
    client.leave(room);
    clientInfo.rooms.delete(room);

    this.logger.debug(`Client ${client.id} (user: ${clientInfo.userId}) left room ${room}`);

    client.emit('delivery.unsubscribed', {
      deliveryId: data.deliveryId,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('rider.location')
  handleRiderLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: LocationUpdatePayload,
  ) {
    if (!data?.deliveryId || !data?.riderId) return;

    const room = `delivery:${data.deliveryId}`;
    this.server.to(room).emit('location.update', {
      riderId: data.riderId,
      deliveryId: data.deliveryId,
      latitude: data.latitude,
      longitude: data.longitude,
      speed: data.speed ?? null,
      heading: data.heading ?? null,
      timestamp: data.timestamp ?? new Date().toISOString(),
    });

    this.logger.debug(
      `Location update for delivery ${data.deliveryId}: (${data.latitude}, ${data.longitude})`,
    );
  }

  @SubscribeMessage('delivery.status')
  handleDeliveryStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: DeliveryStatusPayload,
  ) {
    if (!data?.deliveryId || !data?.status) return;

    const room = `delivery:${data.deliveryId}`;
    this.server.to(room).emit('delivery.status.updated', {
      deliveryId: data.deliveryId,
      status: data.status,
      riderId: data.riderId ?? null,
      timestamp: data.timestamp ?? new Date().toISOString(),
    });

    this.logger.log(
      `Delivery ${data.deliveryId} status updated to ${data.status}`,
    );
  }

  @SubscribeMessage('delivery.eta')
  handleETABroadcast(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ETAPayload,
  ) {
    if (!data?.deliveryId) return;

    const room = `delivery:${data.deliveryId}`;
    this.server.to(room).emit('delivery.eta.updated', {
      deliveryId: data.deliveryId,
      estimatedMinutes: data.estimatedMinutes,
      distanceKm: data.distanceKm ?? null,
      timestamp: data.timestamp ?? new Date().toISOString(),
    });

    this.logger.debug(
      `ETA update for delivery ${data.deliveryId}: ${data.estimatedMinutes} min`,
    );
  }

  emitLocationUpdate(payload: LocationUpdatePayload): void {
    const room = `delivery:${payload.deliveryId}`;
    this.server.to(room).emit('location.update', {
      ...payload,
      timestamp: payload.timestamp ?? new Date().toISOString(),
    });
  }

  emitDeliveryStatusUpdate(payload: DeliveryStatusPayload): void {
    const room = `delivery:${payload.deliveryId}`;
    this.server.to(room).emit('delivery.status.updated', {
      ...payload,
      timestamp: payload.timestamp ?? new Date().toISOString(),
    });
  }

  emitETAUpdate(payload: ETAPayload): void {
    const room = `delivery:${payload.deliveryId}`;
    this.server.to(room).emit('delivery.eta.updated', {
      ...payload,
      timestamp: payload.timestamp ?? new Date().toISOString(),
    });
  }
}
