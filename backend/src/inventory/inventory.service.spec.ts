import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InventoryService } from './inventory.service';
import { InventoryStockEntity } from './entities/inventory-stock.entity';

const mockStock = (overrides: Partial<InventoryStockEntity> = {}): InventoryStockEntity =>
  ({
    id: 'stock-1',
    bloodBankId: 'BB-001',
    bloodType: 'O+',
    availableUnits: 5,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as InventoryStockEntity);

describe('InventoryService – optimistic locking', () => {
  let service: InventoryService;
  let findOne: jest.Mock;
  let qb: Record<string, jest.Mock>;

  beforeEach(async () => {
    findOne = jest.fn();
    qb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn(),
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryEntity } from './entities/inventory.entity';
import { InventoryRepository } from './repositories/inventory.repository';

describe('InventoryService', () => {
  let service: InventoryService;
  let typeormRepo: jest.Mocked<Repository<InventoryEntity>>;
  let inventoryRepo: jest.Mocked<InventoryRepository>;

  beforeEach(async () => {
    const mockTypeormRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    const mockInventoryRepo = {
      findByHospital: jest.fn(),
      findByHospitalAndBloodType: jest.fn(),
      getLowStockItems: jest.fn(),
      getCriticalStockItems: jest.fn(),
      getStockAggregationByBloodType: jest.fn(),
      getInventoryStats: jest.fn(),
      getReorderSummary: jest.fn(),
      adjustStock: jest.fn(),
      reserveStock: jest.fn(),
      releaseStock: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        {
          provide: getRepositoryToken(InventoryStockEntity),
          useValue: {
            findOne,
            find: jest.fn().mockResolvedValue([]),
            create: jest.fn((dto) => dto),
            save: jest.fn((e) => Promise.resolve(e)),
            merge: jest.fn((e, u) => ({ ...e, ...u })),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(() => qb),
          },
          provide: getRepositoryToken(InventoryEntity),
          useValue: mockTypeormRepo,
        },
        {
          provide: InventoryRepository,
          useValue: mockInventoryRepo,
        },
      ],
    }).compile();

    service = module.get(InventoryService);
  });

  describe('reserveStockOrThrow', () => {
    it('throws ConflictException when quantity is zero', async () => {
      await expect(service.reserveStockOrThrow('BB-001', 'O+', 0)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ConflictException when no stock record exists', async () => {
      findOne.mockResolvedValue(null);
      await expect(service.reserveStockOrThrow('BB-001', 'O+', 1)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ConflictException when available units are insufficient', async () => {
      findOne.mockResolvedValue(mockStock({ availableUnits: 0 }));
      await expect(service.reserveStockOrThrow('BB-001', 'O+', 1)).rejects.toThrow(
        ConflictException,
      );
    });

    it('succeeds when version matches and units are sufficient', async () => {
      findOne.mockResolvedValue(mockStock());
      qb.execute.mockResolvedValue({ affected: 1 });
      await expect(service.reserveStockOrThrow('BB-001', 'O+', 3)).resolves.toBeUndefined();
    });

    it('retries once on version mismatch then throws ConflictException', async () => {
      findOne.mockResolvedValue(mockStock());
      qb.execute.mockResolvedValue({ affected: 0 });
      await expect(service.reserveStockOrThrow('BB-001', 'O+', 1)).rejects.toThrow(
        ConflictException,
      );
      expect(findOne).toHaveBeenCalledTimes(2);
    });
  });

  describe('restoreStockOrThrow', () => {
    it('throws ConflictException when quantity is zero', async () => {
      await expect(service.restoreStockOrThrow('BB-001', 'O+', 0)).rejects.toThrow(
        ConflictException,
      );
    });

    it('creates a new stock record when none exists', async () => {
      findOne.mockResolvedValue(null);
      const repo = service['inventoryRepo'] as any;
      await expect(service.restoreStockOrThrow('BB-001', 'O+', 2)).resolves.toBeUndefined();
      expect(repo.save).toHaveBeenCalled();
    });

    it('succeeds when version matches', async () => {
      findOne.mockResolvedValue(mockStock());
      qb.execute.mockResolvedValue({ affected: 1 });
      await expect(service.restoreStockOrThrow('BB-001', 'O+', 2)).resolves.toBeUndefined();
    });

    it('retries once on version mismatch then throws ConflictException', async () => {
      findOne.mockResolvedValue(mockStock());
      qb.execute.mockResolvedValue({ affected: 0 });
      await expect(service.restoreStockOrThrow('BB-001', 'O+', 2)).rejects.toThrow(
        ConflictException,
      );
      expect(findOne).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateStock', () => {
    it('throws NotFoundException when item does not exist', async () => {
      findOne.mockResolvedValue(null);
      await expect(service.updateStock('missing-id', 10)).rejects.toThrow(NotFoundException);
    });

    it('saves updated quantity', async () => {
      const stock = mockStock();
      findOne.mockResolvedValue(stock);
      const repo = service['inventoryRepo'] as any;
      await service.updateStock('stock-1', 20);
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ availableUnits: 20 }));
    service = module.get<InventoryService>(InventoryService);
    typeormRepo = module.get(getRepositoryToken(InventoryEntity));
    inventoryRepo = module.get(InventoryRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all inventory items when no hospitalId provided', async () => {
      const mockItems = [
        { id: '1', hospitalId: 'h1', bloodType: 'A+', quantity: 10 },
        { id: '2', hospitalId: 'h2', bloodType: 'O-', quantity: 20 },
      ];
      typeormRepo.find.mockResolvedValue(mockItems as any);

      const result = await service.findAll();

      expect(typeormRepo.find).toHaveBeenCalledWith({
        order: { bloodType: 'ASC', hospitalId: 'ASC' },
      });
      expect(result.data).toEqual(mockItems);
    });

    it('should filter by hospitalId when provided', async () => {
      const mockItems = [{ id: '1', hospitalId: 'h1', bloodType: 'A+' }];
      inventoryRepo.findByHospital.mockResolvedValue(mockItems as any);

      const result = await service.findAll('h1');

      expect(inventoryRepo.findByHospital).toHaveBeenCalledWith('h1');
      expect(result.data).toEqual(mockItems);
    });
  });

  describe('findOne', () => {
    it('should return inventory item by id', async () => {
      const mockItem = { id: '1', hospitalId: 'h1', bloodType: 'A+' };
      typeormRepo.findOne.mockResolvedValue(mockItem as any);

      const result = await service.findOne('1');

      expect(result.data).toEqual(mockItem);
    });

    it('should throw NotFoundException when item not found', async () => {
      typeormRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create new inventory item', async () => {
      const dto = {
        hospitalId: 'h1',
        bloodType: 'A+',
        quantity: 10,
        reorderLevel: 5,
      };
      inventoryRepo.findByHospitalAndBloodType.mockResolvedValue(null);
      typeormRepo.create.mockReturnValue(dto as any);
      typeormRepo.save.mockResolvedValue({ id: '1', ...dto } as any);

      const result = await service.create(dto);

      expect(inventoryRepo.findByHospitalAndBloodType).toHaveBeenCalledWith('h1', 'A+');
      expect(result.data).toHaveProperty('id');
    });

    it('should throw BadRequestException when inventory already exists', async () => {
      const dto = { hospitalId: 'h1', bloodType: 'A+', quantity: 10 };
      inventoryRepo.findByHospitalAndBloodType.mockResolvedValue({ id: '1' } as any);

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateStock', () => {
    it('should update stock quantity', async () => {
      const mockItem = { id: '1', quantity: 10 };
      typeormRepo.findOne.mockResolvedValueOnce(mockItem as any);
      typeormRepo.findOne.mockResolvedValueOnce({ ...mockItem, quantity: 15 } as any);

      const result = await service.updateStock('1', 5);

      expect(inventoryRepo.adjustStock).toHaveBeenCalledWith('1', 5);
      expect(result.data.quantity).toBe(15);
    });

    it('should throw BadRequestException when reducing below zero', async () => {
      const mockItem = { id: '1', quantity: 5 };
      typeormRepo.findOne.mockResolvedValue(mockItem as any);

      await expect(service.updateStock('1', -10)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when item not found', async () => {
      typeormRepo.findOne.mockResolvedValue(null);

      await expect(service.updateStock('999', 5)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getLowStockItems', () => {
    it('should return low stock items', async () => {
      const mockItems = [
        { id: '1', bloodType: 'A+', quantity: 5, deficit: 5 },
      ];
      inventoryRepo.getLowStockItems.mockResolvedValue(mockItems as any);

      const result = await service.getLowStockItems(10);

      expect(inventoryRepo.getLowStockItems).toHaveBeenCalledWith(10);
      expect(result.data).toEqual(mockItems);
    });
  });

  describe('reserveStock', () => {
    it('should reserve stock successfully', async () => {
      const mockItem = { id: '1', quantity: 10, reservedQuantity: 5 };
      inventoryRepo.reserveStock.mockResolvedValue(true);
      typeormRepo.findOne.mockResolvedValue(mockItem as any);

      const result = await service.reserveStock('1', 3);

      expect(inventoryRepo.reserveStock).toHaveBeenCalledWith('1', 3);
      expect(result.message).toContain('reserved successfully');
    });

    it('should throw BadRequestException when insufficient stock', async () => {
      inventoryRepo.reserveStock.mockResolvedValue(false);

      await expect(service.reserveStock('1', 100)).rejects.toThrow(BadRequestException);
    });
  });

  describe('releaseStock', () => {
    it('should release reserved stock', async () => {
      const mockItem = { id: '1', quantity: 10, reservedQuantity: 2 };
      typeormRepo.findOne.mockResolvedValue(mockItem as any);

      const result = await service.releaseStock('1', 2);

      expect(inventoryRepo.releaseStock).toHaveBeenCalledWith('1', 2);
      expect(result.message).toContain('released successfully');
    });
  });

  describe('getStockAggregation', () => {
    it('should return stock aggregation by blood type', async () => {
      const mockAggregation = [
        { bloodType: 'A+', totalQuantity: 100, totalReserved: 20 },
      ];
      inventoryRepo.getStockAggregationByBloodType.mockResolvedValue(mockAggregation as any);

      const result = await service.getStockAggregation();

      expect(result.data).toEqual(mockAggregation);
    });
  });

  describe('getInventoryStats', () => {
    it('should return inventory statistics', async () => {
      const mockStats = {
        totalItems: 10,
        totalQuantity: 500,
        lowStockCount: 2,
      };
      inventoryRepo.getInventoryStats.mockResolvedValue(mockStats as any);

      const result = await service.getInventoryStats();

      expect(inventoryRepo.getInventoryStats).toHaveBeenCalledWith(undefined);
      expect(result.data).toEqual(mockStats);
    });

    it('should filter stats by hospitalId', async () => {
      const mockStats = { totalItems: 5, totalQuantity: 200 };
      inventoryRepo.getInventoryStats.mockResolvedValue(mockStats as any);

      await service.getInventoryStats('h1');

      expect(inventoryRepo.getInventoryStats).toHaveBeenCalledWith('h1');
    });
  });
});
