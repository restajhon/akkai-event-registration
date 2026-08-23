export function getDashboardRealtimeTopic(sessionId: string) {
  return `akkai:dashboard:${sessionId}`;
}

export function getStationDisplayRealtimeTopic(stationId: string) {
  return `akkai:display:station:${stationId}`;
}
