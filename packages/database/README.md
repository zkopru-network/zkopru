# Database

A generic interface for data storage.

## Interface

This is the interface for a `DB` object. This is the primary way to interact with data storage. A `DB` object might be backed by an SQL database, indexedDB, or a simple in memory structure.

### Common Types

#### Where

The where clause is used in many different queries. It allows matches based on simple property comparison or more complex operators including `lt`, `lte`, `gt`, `gte`, `ne` (not equal), and `nin` (not in array).

A where clause may contain the top level keys `AND` or `OR`. Each may contain an array of where clauses to be combined using and/or logic respectively.

A where clause using all possible comparison operators is shown below.

```
{
  textField: 'simple value',
  // An array compares using the IN operator
  integerField: [1, 2, 3, 4, 5],
  // The IN operator may be used on any field type
  textField2: ['this', 'that', 'the other'],
  integer2Field: {
    gt: 5, // requires that this field be greater than 5
    lt: 10, // multiple operators may be used, they are combined using AND logic
  },
  textField2: { nin: [ 'not', 'these', 'words' ] },
  // a top level key named OR allows you to specify conditions combined by OR logic
  OR: [
    {
      // This returns documents where 5 < integer2Field < 10 or integer2Field is 12
      integer2Field: 12,
    },
    {
      textField: 'another simple value'
    }
  ],
  // a top level key named AND allows you to specify conditions combined by AND logic
  AND: [
    {
      integer2Field: { gt: 10 },
    },
    {
      integer2Field: { lt: 20 },
    }
  ]
}
```


#### OrderBy

The `orderBy` field may be used to order the returned documents. The field is a simple object with keys corresponding to either `asc` or `desc`. Muliple keys may be specified.

```
orderBy: {
  integerField: 'asc',
  stringField: 'desc',
}
```

#### Include

The include field may be used to retrieve related documents. The include field is an object with field names mapped to either `true` or an object specifying nested documents to load.

```
include: {
  // Load the car model document
  model: true,
  // Load the make document, and the company document that exists on the make document
  make: {
    company: true,
  }
}
```

### Create

Creates one or many documents.

`create(collection: string, doc: any): Promise<any>`

`collection`: The collection of documents to insert the new document(s) into. This can be thought of as a table. Collections must be specific in [the schema](#Schema).
`doc`: The document (or array of documents) to be inserted into the collection.

Returns: The document (or documents) inserted.

### Find One

Returns a single document matching the provided arguments.

`findOne(collection: string, options: FindOneOptions): Promise<any>`

- `collection`: The collection to search.
- `options`: An object with the following properties.

`FindOneOptions`:
  - `where`: [`WhereClause`](#Where)
  - `orderBy`: [`OrderByClause`](#OrderBy)
  - `include`: [`IncludeClause`](#Include)

### Find Many

Returns many documents matching the provided arguments.

`findMany(collection: string, options: FindManyOptions): Promise<any[]>`

- `collection`: The collection to search.
- `options`: An object with the following properties.

`FindManyOptions`:
  - `where`: [`WhereClause`](#Where)
  - `orderBy`: [`OrderByClause`](#OrderBy)
  - `include`: [`IncludeClause`](#Include)
  - `limit`: Integer representing the maximum number of documents to return.

### Count

Returns the number of documents matching a where clause.

`count(collection: string, where: WhereClause): Promise<number>`

- `collection`: The collection to count.
- `where`: A [`WhereClause`](#Where) filtering the documents.

### Update

Updates one or more documents returning the number of documents affected.

`update(collection: string, options: UpdateOptions): Promise<number>`

`UpdateOptions`:
- `where`: [`WhereClause`](#Where)
- `update`: An object with new keys and values.

### Upsert

Upserts a document by creating it if it doesn't exist, updating if it does exist.

`upsert(collection: string, options: UpsertOptions): Promise<number>`

`UpsertOptions`:
- `where`: [`WhereClause`](#Where) to determine if the document exists.
- `create`: The document to be created if necessary.
- `update`: An object with new values to be updated if necessary.
- `constraintKey` (optional): The key to use when determining if a document exists. Use this if the `where` clause includes multiple unique fields. Underlying implementations may not be able to determine which key to use when comparing.

### Delete

Delete documents matching a clause.

`delete(collection: string, options: DeleteOptions): Promise<number>`

`DeleteOptions`:
- `where`: [`WhereClause`](#Where)

### Transaction

Batch database operations to be executed at once. If any operation in the transaction fails all operations will be rolled back.

`transaction(operation: (db: TransactionDB) => void): Promise<void>`

`operation`: A function performing database operations.

`TransactionDB`: A pseudo object with the following functions: `create`, `update`, `upsert`, `delete`, `onCommit`, `onError`, `onComplete`. Each function behaves the same as the normal version BUT the functions are not asynchronous, they return immediately but data is not persisted until the transaction is committed. `onCommit` allows a function to be registered as a callback when the transaction is successfully committed. `onError` registers a callback that is executed if the transaction errors. `onComplete` is executed regardless of success or error.

Once the `operation` function finishes executing the transaction will be applied.

### Close

A function for closing and tearing down database instances. Call this when disposing of a `DB` reference.

`close(): Promise<void>`

## Schema

The schema is used to define how data should be stored. Each schema is an array of collections. Each collection specifies information about the documents contained within. A collection may be thought of as a table.

### Collection

A collection may specify the following keys:

- `name` - required - The name of the collection.
- `primaryKey` - optional - The primary key for the collection. This may be an array of keys. Each key must be specified in the `row` section.
- `rows` - required - An array of rows that are a part of each document in the collection.

### Rows

A row may specify the following keys:

- `name` - required - The name of the row.
- `optional` - optional - A boolean indicating whether a value for this field is required.
- `unique` - optional - A boolean indicating whether duplicate values for this field are allowed in the collection.
- `type` - required - One of `String`, `Int`, `Bool`, `Object`. Objects are automatically serialized and deserialized using JSON.
- `default` - optional - A function or value to be used as the default value.
- `relation` - optional - An object specifying information for a virtual row.

A relation must include the following keys:

- `localField`: The name of the local field to match against the remote document.
- `foreignField`: The name of the remote field to match against the local document.
- `foreignTable`: The remote collection.
