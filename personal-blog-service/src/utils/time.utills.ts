export class TimeUtils {
  private static SECOND = 1000;
  private static MINUTE = 60 * this.SECOND;
  private static HOUR = 60 * this.MINUTE;

  static getTicTimeHMS(
    hour: number,
    minute: number = 0,
    second: number = 0,
  ): number {
    return hour * this.HOUR + minute * this.MINUTE + second * this.SECOND;
  }

  static getTicTimeMS(minute: number, second: number = 0): number {
    return minute * this.MINUTE + second * this.SECOND;
  }

  static getTicTimeS(second: number): number {
    return second * this.SECOND;
  }
}
