// Loaded only in the child of `node --watch`. A failed child must also stop
// its watcher so mise can report failure and stop the other application.
process.on("exit", (code) => {
  if (code !== 0) {
    process.kill(process.ppid, "SIGTERM");
  }
});
