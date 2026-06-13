export const FALLBACK_BUILD_VERSION = 'local';

/* global __APP_BUILD_VERSION__ */
const injectedBuildVersion = typeof __APP_BUILD_VERSION__ === 'string' ? __APP_BUILD_VERSION__ : '';

export const BUILD_VERSION = injectedBuildVersion || FALLBACK_BUILD_VERSION;
