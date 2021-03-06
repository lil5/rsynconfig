const Rsync = require('rsync')
const path = require('path')

// functions
// ---

const isString = str => !!(typeof str === 'string' || str instanceof String) && str !== ''

const sshPath = (sshConfig) => {
  if (!(
    isString(sshConfig.host) ||
    isString(sshConfig.user) ||
    isString(sshConfig.path)
  )) {
    throw new Error('ssh config not complete')
  }

  sshConfig.user = setEnvironment(sshConfig.user)
  sshConfig.path = setEnvironment(sshConfig.path)

  return path.join(
    sshConfig.user + '@' + sshConfig.host + ':' + sshConfig.path
  )
}

const setEnvironment = (src) => {
  let env = process.env

  if (src.search(/\$(USER|HOME|LOGNAME)/) !== -1) {
    ;['USER', 'PWD', 'HOME', 'LOGNAME'].forEach(envProp => {
      src = src.replace(new RegExp('\\$' + envProp), env[envProp])
    })
  }

  return src
}

/**
 * Create rsync Object using config.
 * @param {Object} config
 * @return {rsync} rsync Object
 * @throw {Error}
 */
module.exports = function createRsyncObj (config) {
  let rsync = new Rsync()
  rsync.cwd(config.cwd)
  if (!global.QUIET) rsync.progress()
  if (!global.QUIET && global.DEBUG) {
    rsync.set('info', 'progress2')
    rsync.set('stats')
  }

  // value in config is value in rsync
  ;[
    'flags',
    'include',
    'exclude',
    'chmod',
  ].forEach(el => {
    if (config[el]) rsync[el](config[el])
  })

  // if value true in config enable in rsync
  ;['delete', 'dry'].forEach(el => {
    if (config[el] === true) rsync[el]()
  })

  if (!(config.filter === false)) {
    rsync.set('filter', 'dir-merge /.rsync-filter')
  }

  // define destination and source

  // ssh
  if ((typeof config.ssh === 'object') && (config.ssh !== null)) {
    if (config.ssh.dest) {
      rsync.destination(sshPath(config.ssh.dest))
    }
    if (config.ssh.src) {
      if (config.ssh.dest) {
        throw new Error('the source and destination cannot both be remote')
      }
      rsync.source(sshPath(config.ssh.src))
    }

    if (config.ssh.key) {
      let keyFile = path.resolve(config.cwd, setEnvironment(config.ssh.key))
      rsync.shell(`ssh -i "${keyFile}"`)
    } else {
      rsync.shell('ssh')
    }
  }

  // local
  if (!isString(rsync.source()[0])) {
    if (config.src) {
      config.src = setEnvironment(config.src)
      rsync.source(config.src)
    } else {
      throw new Error('source not set')
    }
  }

  if (!isString(rsync.destination())) {
    if (config.dest) {
      config.dest = setEnvironment(config.dest)
      rsync.destination(config.dest)
    } else {
      throw new Error('destination not set')
    }
  }

  return rsync
}
