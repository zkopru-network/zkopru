import { SchemaTable, Relation } from '../types'

async function loadIncludedModels(
  models: any[],
  relation: Relation & { name: string },
  findMany: Function,
  include?: any,
) {
  const values = models.map(model => model[relation.localField])
  // load relevant submodels
  const submodels = await findMany(relation.foreignTable, {
    where: {
      [relation.foreignField]: values,
    },
    include: include as any, // load subrelations if needed
  })
  // key the submodels by their relation field
  const keyedSubmodels = {}
  for (const submodel of submodels) {
    // assign to the models
    keyedSubmodels[submodel[relation.foreignField]] = submodel
  }
  // Assign submodel onto model
  for (const model of models) {
    const submodel = keyedSubmodels[model[relation.localField]]
    Object.assign(model, {
      [relation.name]: submodel || null,
    })
  }
}

export async function loadIncluded(
  collection: string,
  options: {
    models: any[]
    include?: any
    findMany: Function
    table: SchemaTable
  },
) {
  const { models, include, table, findMany } = options
  if (!include) return
  if (!table) throw new Error(`Unable to find table ${collection} in schema`)
  for (const key of Object.keys(include)) {
    const relation = table.relations[key]
    if (!relation) {
      throw new Error(`Unable to find relation ${key} in ${collection}`)
    }
    if (include[key]) {
      await loadIncludedModels(
        models,
        relation,
        findMany,
        typeof include[key] === 'object' ? include[key] : undefined,
      )
    }
  }
}
