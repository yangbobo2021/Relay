// This package is installed only in disposable acceptance profiles. Expose the
// public context to the runner so a silently inactive plugin cannot pass QA.
window.__ModuleLoader__.load({ id: 'relay-dsh-client-acceptance-fixture', factory: () => ({
  inject: ['slots', 'connection', 'sessions', 'workspaces'],
  apply(ctx) {
    window.__RELAY_DSH_TEST__ = ctx;
    return () => { delete window.__RELAY_DSH_TEST__; };
  },
}) });
