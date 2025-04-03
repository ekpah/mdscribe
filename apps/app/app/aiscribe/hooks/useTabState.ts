import { useState } from 'react';

type TabState = 'input' | 'output' | 'disposition';

export function useTabState() {
  const [activeTab, setActiveTab] = useState<TabState>('input');
  const [isInputExpanded, setIsInputExpanded] = useState<boolean>(true);
  const [isOutputExpanded, setIsOutputExpanded] = useState<boolean>(false);
  const [isDispositionExpanded, setIsDispositionExpanded] =
    useState<boolean>(false);

  const toggleInputTab = () => {
    setActiveTab('input');
    setIsInputExpanded(true);
    setIsOutputExpanded(false);
    setIsDispositionExpanded(false);
  };

  const toggleOutputTab = () => {
    setActiveTab('output');
    setIsInputExpanded(false);
    setIsDispositionExpanded(false);
    setIsOutputExpanded(true);
  };

  const toggleDispositionTab = () => {
    setActiveTab('disposition');
    setIsInputExpanded(false);
    setIsOutputExpanded(false);
    setIsDispositionExpanded(true);
  };

  return {
    activeTab,
    isInputExpanded,
    isOutputExpanded,
    isDispositionExpanded,
    toggleInputTab,
    toggleOutputTab,
    toggleDispositionTab,
  };
}
