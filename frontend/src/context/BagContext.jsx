import { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * Slide-out bag state (RTR `CEBagComponent` analogue). The PDP adds a draft
 * rental — a complete booking payload plus display summary — and the drawer
 * collects the confirm step so shoppers can keep browsing without a page
 * refresh. Session-scoped: no persistence beyond the current tab.
 */
const BagContext = createContext(null);

export function BagProvider({ children }) {
  const [draft, setDraft] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  const addToBag = useCallback((payload, summary) => {
    setDraft({ payload, summary });
    setIsOpen(true);
  }, []);

  const openBag = useCallback(() => setIsOpen(true), []);
  const closeBag = useCallback(() => setIsOpen(false), []);

  const clearBag = useCallback(() => {
    setDraft(null);
    setIsOpen(false);
  }, []);

  const value = useMemo(
    () => ({ draft, isOpen, addToBag, openBag, closeBag, clearBag }),
    [draft, isOpen, addToBag, openBag, closeBag, clearBag],
  );

  return <BagContext.Provider value={value}>{children}</BagContext.Provider>;
}

export function useBag() {
  const context = useContext(BagContext);
  if (!context) {
    throw new Error('useBag must be used within a BagProvider.');
  }
  return context;
}
