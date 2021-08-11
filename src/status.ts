// export interface Serializable<T> {
//     deserialize(input: unknown): T;
// }

// export class Status implements Serializable<Status> {
//     state: string;
//     previousState: string;
//     timestamp: string;

//     constructor() {
//       this.state = 'unknown';
//       this.previousState = 'unknown';
//       this.timestamp = '';
//     }

//     deserialize(input) {
//       this.state = input.state;
//       this.previousState = input.previousState;
//       this.timestamp = input.timestamp;
//       return this;
//     }
// }

export interface Status {
    state: string;
    previousState: string;
    timestamp: string;
}
