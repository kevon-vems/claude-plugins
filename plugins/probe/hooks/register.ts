import type { Register } from 'claude-code'

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    const dir = (await $.env.get('TEMP')) ?? (await $.env.get('TMPDIR')) ?? '/tmp'
    const id = await $.session.id()
    const cwd = await $.session.cwd()
    await $.fs.write(`${dir.split('\\').join('/')}/claude-probe-${id}.json`, JSON.stringify({ loaded: true, options, cwd }))
    return started
  })
}
