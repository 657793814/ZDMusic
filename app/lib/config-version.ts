let _configVersion = 1;

export function getConfigVersion(): number {
  return _configVersion;
}

export function incrementConfigVersion(): number {
  _configVersion++;
  return _configVersion;
}
