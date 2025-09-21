import { config } from '@vue/test-utils'
import { Quasar } from 'quasar'

const plugins = config.global.plugins ?? []
plugins.push([Quasar, {}])
config.global.plugins = plugins

config.global.stubs = {
  ...(config.global.stubs ?? {}),
  transition: false,
  'transition-group': false,
}

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverMock
}
