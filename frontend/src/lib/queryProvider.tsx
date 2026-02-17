import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import type { ReactNode } from 'react';

interface AppQueryProviderProps {
    children: ReactNode;
}

/**
 * React Query Provider for the application.
 * Configures default options for queries including:
 * - Retry behavior
 * - Stale time
 * - Refetch behavior
 */
export function AppQueryProvider({ children }: AppQueryProviderProps) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        // Don't retry failed requests immediately
                        retry: 1,
                        // Consider data stale after 10 seconds
                        staleTime: 10 * 1000,
                        // Refetch on window focus for fresh data
                        refetchOnWindowFocus: true,
                        // Don't refetch on reconnect automatically
                        refetchOnReconnect: true,
                    },
                    mutations: {
                        retry: 0,
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
