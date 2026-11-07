/**
 * Map Melview `adaptortype` values to human-readable Wi-Fi module names.
 * Detection is based on Melview capability strings, not LAN probing.
 */
const ADAPTER_LABELS: Record<string, string> = {
  mac559: 'MAC-559IF-E',
  mac568: 'MAC-568IF-E',
  mac577: 'MAC-577IF-E',
  'mac-577if-e': 'MAC-577IF-E',
  'mac-577if-2e': 'MAC-577IF-2E',
  'mac-577if2-e': 'MAC-577IF-2E',
};

const LOCAL_SMART_PREFIXES = ['mac559', 'mac568', 'mac577'];

export function normalizeAdaptorType(adaptortype?: string): string {
  return (adaptortype ?? '').trim().toLowerCase();
}

export function formatWifiModule(adaptortype?: string): string {
  const key = normalizeAdaptorType(adaptortype);
  if (!key) {
    return 'Unknown';
  }
  return ADAPTER_LABELS[key] ?? adaptortype!.trim().toUpperCase();
}

/** Melview adapters that accept the encrypted `/smart` ESV LAN hop. */
export function supportsLocalSmart(adaptortype?: string): boolean {
  const key = normalizeAdaptorType(adaptortype);
  return LOCAL_SMART_PREFIXES.some((prefix) => key === prefix || key.startsWith(prefix));
}
