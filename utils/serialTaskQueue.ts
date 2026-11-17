/** Runs asynchronous tasks in insertion order, even when an earlier task fails. */
export class SerialTaskQueue {
	private tail: Promise<void> = Promise.resolve();

	enqueue<T>(task: () => Promise<T> | T): Promise<T> {
		const next = this.tail.then(task);
		this.tail = next.then(
			() => undefined,
			() => undefined,
		);
		return next;
	}
}
