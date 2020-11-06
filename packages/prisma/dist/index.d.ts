import { F } from '@zkopru/babyjubjub';
import AsyncLock from 'async-lock';
import { TreeNode, Utxo, Withdrawal, Migration, PrismaClient } from '../generated/base';
import { PrismaClientOptions as PostgresClientOptions } from '../generated/postgres';
import { PrismaClientOptions as SqliteClientOptions } from '../generated/sqlite';
export declare type NoteSql = Utxo | Withdrawal | Migration;
export declare enum TreeSpecies {
    UTXO = 0,
    WITHDRAWAL = 1
}
export declare enum BlockStatus {
    NOT_FETCHED = 0,
    FETCHED = 1,
    PARTIALLY_VERIFIED = 2,
    FULLY_VERIFIED = 3,
    FINALIZED = 4,
    INVALIDATED = 5,
    REVERTED = 6
}
export declare const NULLIFIER_TREE_ID = "nullifier-tree";
export { LightTree, TreeNode, Keystore, EncryptedWallet, Block, Header, Bootstrap, BootstrapCreateInput, Config, Deposit, MassDeposit, Proposal, Withdrawal, TokenRegistry, Tracker, } from '../generated/base';
export interface MockupDB {
    db: DB;
    terminate: () => Promise<void>;
}
declare type PrismaClientOptions = PostgresClientOptions | SqliteClientOptions;
export declare class DB {
    lock: AsyncLock;
    constructor(option?: PrismaClientOptions);
    prisma: PrismaClient;
    read<T>(query: (prisma: PrismaClient) => Promise<T>): Promise<T>;
    write<T>(query: (prisma: PrismaClient) => Promise<T>): Promise<T>;
    preset: {
        getCachedSiblings: (depth: number, treeId: string, leafIndex: F) => Promise<TreeNode[]>;
    };
    static mockup(name?: string): Promise<MockupDB>;
}
//# sourceMappingURL=index.d.ts.map