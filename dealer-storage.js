(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DealerStorage = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function chooseNewestLegacySnapshot(localSnapshot, indexedSnapshot) {
    const candidates = [localSnapshot, indexedSnapshot].filter(snapshot => snapshot?.state);
    if (!candidates.length) return null;
    return candidates.reduce((newest, snapshot) =>
      Number(snapshot.savedAt || 0) > Number(newest.savedAt || 0) ? snapshot : newest
    );
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createQueuedRemoteSaver(client, onError = () => {}) {
    let tail = Promise.resolve();

    function save(state, options) {
      const snapshot = clone(state);
      const operation = tail.then(() => client.save(snapshot, options));
      tail = operation.catch(error => {
        onError(error);
      });
      return operation;
    }

    function flush() {
      return tail;
    }

    return { save, flush };
  }

  return { chooseNewestLegacySnapshot, createQueuedRemoteSaver };
});
