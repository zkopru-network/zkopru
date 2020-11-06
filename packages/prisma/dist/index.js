"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var babyjubjub_1 = require("@zkopru/babyjubjub");
var utils_1 = require("@zkopru/utils");
var uuid_1 = require("uuid");
var bn_js_1 = __importDefault(require("bn.js"));
var path_1 = __importDefault(require("path"));
var fs_1 = __importDefault(require("fs"));
var async_lock_1 = __importDefault(require("async-lock"));
var postgres_1 = require("../generated/postgres");
var sqlite_1 = require("../generated/sqlite");
var TreeSpecies;
(function (TreeSpecies) {
    TreeSpecies[TreeSpecies["UTXO"] = 0] = "UTXO";
    TreeSpecies[TreeSpecies["WITHDRAWAL"] = 1] = "WITHDRAWAL";
})(TreeSpecies = exports.TreeSpecies || (exports.TreeSpecies = {}));
var BlockStatus;
(function (BlockStatus) {
    BlockStatus[BlockStatus["NOT_FETCHED"] = 0] = "NOT_FETCHED";
    BlockStatus[BlockStatus["FETCHED"] = 1] = "FETCHED";
    BlockStatus[BlockStatus["PARTIALLY_VERIFIED"] = 2] = "PARTIALLY_VERIFIED";
    BlockStatus[BlockStatus["FULLY_VERIFIED"] = 3] = "FULLY_VERIFIED";
    BlockStatus[BlockStatus["FINALIZED"] = 4] = "FINALIZED";
    BlockStatus[BlockStatus["INVALIDATED"] = 5] = "INVALIDATED";
    BlockStatus[BlockStatus["REVERTED"] = 6] = "REVERTED";
})(BlockStatus = exports.BlockStatus || (exports.BlockStatus = {}));
exports.NULLIFIER_TREE_ID = 'nullifier-tree';
var Lock;
(function (Lock) {
    Lock["EXCLUSIVE"] = "exclusive";
})(Lock || (Lock = {}));
var DB = (function () {
    function DB(option) {
        var _this = this;
        this.preset = {
            getCachedSiblings: function (depth, treeId, leafIndex) { return __awaiter(_this, void 0, void 0, function () {
                var siblingIndexes, leafPath, level, pathIndex, siblingIndex, cachedSiblings;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            siblingIndexes = Array(depth).fill('');
                            leafPath = new bn_js_1.default(1).shln(depth).or(babyjubjub_1.Field.toBN(leafIndex));
                            if (leafPath.lte(babyjubjub_1.Field.toBN(leafIndex)))
                                throw Error('Leaf index is out of range');
                            for (level = 0; level < depth; level += 1) {
                                pathIndex = leafPath.shrn(level);
                                siblingIndex = new bn_js_1.default(1).xor(pathIndex);
                                siblingIndexes[level] = utils_1.hexify(siblingIndex);
                            }
                            return [4, this.read(function (prisma) {
                                    return prisma.treeNode.findMany({
                                        where: {
                                            AND: [{ treeId: treeId }, { nodeIndex: { in: __spreadArrays(siblingIndexes) } }],
                                        },
                                    });
                                })];
                        case 1:
                            cachedSiblings = _a.sent();
                            return [2, cachedSiblings];
                    }
                });
            }); },
        };
        var client;
        if ((option === null || option === void 0 ? void 0 : option.datasources) && 'postgres' in option.datasources) {
            client = new postgres_1.PrismaClient(option);
        }
        else {
            client = new sqlite_1.PrismaClient(option);
        }
        this.prisma = client;
        this.lock = new async_lock_1.default();
    }
    DB.prototype.read = function (query) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.lock.isBusy(Lock.EXCLUSIVE)) return [3, 2];
                        return [4, this.lock.acquire(Lock.EXCLUSIVE, function () { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4, query(this.prisma)];
                                        case 1:
                                            result = _a.sent();
                                            return [2];
                                    }
                                });
                            }); })];
                    case 1:
                        _a.sent();
                        return [3, 4];
                    case 2: return [4, query(this.prisma)];
                    case 3:
                        result = _a.sent();
                        _a.label = 4;
                    case 4:
                        if (result === undefined)
                            throw Error('Failed to get data from db');
                        return [2, result];
                }
            });
        });
    };
    DB.prototype.write = function (query) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, this.lock.acquire([Lock.EXCLUSIVE], function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4, query(this.prisma)];
                                    case 1:
                                        result = _a.sent();
                                        return [2];
                                }
                            });
                        }); })];
                    case 1:
                        _a.sent();
                        if (result === undefined)
                            throw Error('Failed to write data to db');
                        return [2, result];
                }
            });
        });
    };
    DB.mockup = function (name) {
        return __awaiter(this, void 0, void 0, function () {
            var dbName, dbPath, dirPath, predefined, db, terminate;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dbName = name || ".mockup/" + uuid_1.v4() + ".db";
                        dbPath = path_1.default.join(path_1.default.resolve('.'), dbName);
                        dirPath = path_1.default.join(dbPath, '../');
                        fs_1.default.mkdirSync(dirPath, { recursive: true });
                        predefined = "" + path_1.default.join(path_1.default.resolve(__dirname), '../mockup.db');
                        return [4, fs_1.default.promises.copyFile(predefined, dbPath)];
                    case 1:
                        _a.sent();
                        db = new DB({
                            datasources: {
                                sqlite: { url: "file://" + dbPath },
                            },
                        });
                        terminate = function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        fs_1.default.unlinkSync(dbPath);
                                        return [4, db.prisma.$disconnect()];
                                    case 1:
                                        _a.sent();
                                        return [2];
                                }
                            });
                        }); };
                        return [2, { db: db, terminate: terminate }];
                }
            });
        });
    };
    return DB;
}());
exports.DB = DB;
//# sourceMappingURL=index.js.map