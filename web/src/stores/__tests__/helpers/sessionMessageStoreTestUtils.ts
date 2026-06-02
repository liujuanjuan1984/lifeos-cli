interface SessionMessageStoreTestGlobal {
  __SESSION_MESSAGE_STORE_TEST_HOOKS__?: {
    resetSessionMessageStore: () => void;
  };
}

const getHooks = () => {
  const hooks = (globalThis as SessionMessageStoreTestGlobal)
    .__SESSION_MESSAGE_STORE_TEST_HOOKS__;
  if (!hooks) {
    throw new Error("Session message store test hooks are not registered");
  }
  return hooks;
};

export const resetSessionMessageStoreForTests = (): void => {
  getHooks().resetSessionMessageStore();
};
