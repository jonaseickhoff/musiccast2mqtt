
export function queue(concurrency = 1) {
    let running = 0
    const taskQueue: (() => Promise<void>)[] = []

    const runTask = async (task: () => Promise<void>): Promise<void> => {
        running++;
        try {
            await task();
        }
        catch (error) {
        }
        running--;
        if (taskQueue.length > 0) {
            runTask(taskQueue.shift())
        }
    }

    const enqueueTask = (task: () => Promise<void>) => taskQueue.push(task)

    return {
        push: (task: () => Promise<void>) =>
            running < concurrency ? runTask(task) : enqueueTask(task),
    }
}