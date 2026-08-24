export interface DeterministicSensorResult<TDetails = unknown> {
  sensor: string;
  score: number;
  details: TDetails;
}
