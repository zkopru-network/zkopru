export async function execAndCallback(
  operation: () => Promise<any>,
  funcs: {
    onError: Function[]
    onSuccess: Function[]
    onComplete: Function[]
  },
) {
  try {
    const result = await operation()
    for (const cb of [...funcs.onSuccess, ...funcs.onComplete]) {
      await Promise.resolve(cb()).catch(err => {
        console.error(err)
        console.warn('Uncaught error in DB transaction success callback')
      })
    }
    return result
  } catch (err) {
    for (const cb of [...funcs.onError, ...funcs.onComplete]) {
      await Promise.resolve(cb()).catch(err => {
        console.error(err)
        console.warn('Uncaught error in DB transaction error callback')
      })
    }
    throw err
  }
}
