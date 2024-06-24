export enum Stages {
  Loading,
  Start,
  Settings,
  Play,
  End,
}

export class GameState {
  stage: Stages;
  loading: boolean;
  loadingPercent: number;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.stage = Stages.Loading;
    this.loading = true;
    this.loadingPercent = 0;
  }

  isLoading(): boolean {
    return this.loading;
  }
}
