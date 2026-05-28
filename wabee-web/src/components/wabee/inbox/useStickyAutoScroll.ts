import { useEffect, useRef, useCallback } from 'react';

export function useStickyAutoScroll(
    containerRef: React.RefObject<HTMLElement | null>,
    deps: any[],
    threadId?: string
) {
    const isNearBottomRef = useRef(true);
    const shouldAutoScrollRef = useRef(false);
    const previousThreadIdRef = useRef(threadId);

    const NEAR_BOTTOM_PX = 120;

    const computeNearBottom = useCallback(() => {
        if (!containerRef.current) return false;
        const container = containerRef.current;
        return container.scrollHeight - container.scrollTop - container.clientHeight < NEAR_BOTTOM_PX;
    }, [containerRef]);

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
        if (containerRef.current) {
            containerRef.current.scrollTo({
                top: containerRef.current.scrollHeight,
                behavior
            });
        }
    }, [containerRef]);

    const handleScroll = useCallback(() => {
        isNearBottomRef.current = computeNearBottom();
    }, [computeNearBottom]);

    const markShouldScroll = useCallback(() => {
        shouldAutoScrollRef.current = true;
    }, []);

    useEffect(() => {
        // If thread changed, force scroll to bottom on first load
        if (threadId !== previousThreadIdRef.current) {
            previousThreadIdRef.current = threadId;
            setTimeout(() => {
                scrollToBottom('auto');
            }, 0);
            return;
        }

        if (shouldAutoScrollRef.current || isNearBottomRef.current) {
            setTimeout(() => {
                scrollToBottom('auto');
            }, 0);
            shouldAutoScrollRef.current = false;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...deps, threadId]);

    return {
        isNearBottomRef,
        handleScroll,
        markShouldScroll,
        scrollToBottom
    };
}
