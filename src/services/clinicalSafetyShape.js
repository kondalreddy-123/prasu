export function normalizeClinicalSafetyResult(result) {
  return {
    allergyAlerts: Array.isArray(result?.allergyAlerts) ? result.allergyAlerts : [],
    duplicateAlerts: Array.isArray(result?.duplicateAlerts) ? result.duplicateAlerts : [],
    interactionAlerts: Array.isArray(result?.interactionAlerts) ? result.interactionAlerts : [],
    repeatTestAlerts: Array.isArray(result?.repeatTestAlerts) ? result.repeatTestAlerts : [],
  };
}
